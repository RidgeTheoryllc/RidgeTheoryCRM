/*
 * Resend dashboard setup (manual):
 * 1. Go to Resend dashboard → Domains → select sending domain
 * 2. Enable "Open Tracking" and "Click Tracking" toggles
 * 3. Go to Webhooks → Add Webhook
 * 4. Endpoint URL: https://yourapp.com/api/email/webhook
 * 5. Select events: email.sent, email.delivered, email.opened,
 *    email.clicked, email.bounced, email.complained
 * 6. Copy the signing secret into RESEND_WEBHOOK_SECRET in .env.local
 */

import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { canUpgradeEngagement, type EmailEngagement } from '@/lib/emailEngagement'
import { resolveResendEmailId } from '@/lib/resendEmail'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { filterLeadAfterBounce, handleEngagementGate } from '@/lib/sequenceGating'

interface ResendWebhookPayload {
  type: string
  created_at?: string
  data?: {
    email_id?: string
    created_at?: string
    bounce?: { message?: string }
    click?: { link?: string }
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('RESEND_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const payload = await request.text()
  const resend = new Resend(process.env.RESEND_API_KEY)

  let event: ResendWebhookPayload
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: request.headers.get('svix-id') ?? '',
        timestamp: request.headers.get('svix-timestamp') ?? '',
        signature: request.headers.get('svix-signature') ?? '',
      },
      webhookSecret,
    }) as ResendWebhookPayload
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  try {
    await processWebhookEvent(event)
  } catch (err) {
    console.error('Webhook processing error:', err)
  }

  return NextResponse.json({ received: true })
}

/** GET — quick config check (no secrets exposed). */
export async function GET() {
  return NextResponse.json({
    webhook_secret_set: Boolean(process.env.RESEND_WEBHOOK_SECRET),
    supabase_admin_set: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    resend_api_key_set: Boolean(process.env.RESEND_API_KEY),
  })
}

async function processWebhookEvent(event: ResendWebhookPayload) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    console.error('SUPABASE_SERVICE_ROLE_KEY missing — webhook cannot update engagement')
    return
  }

  const emailId = resolveResendEmailId(event)
  if (!emailId) {
    console.warn('Webhook event missing email_id:', event.type, JSON.stringify(event.data ?? {}))
    return
  }

  const eventType = event.type.replace('email.', '')
  const eventAt = event.created_at ?? event.data?.created_at ?? new Date().toISOString()

  const { data: eventRow, error: insertError } = await supabase
    .from('email_events')
    .insert({
      resend_message_id: emailId,
      event_type: eventType,
      raw_payload: event,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Failed to insert email_events:', insertError)
  }

  const { data: task } = await supabase
    .from('sequence_tasks')
    .select('id, lead_id, sequence_id, day_number, channel, status, delivered_at, opened_at, open_count, clicked_at, click_count, bounced_at')
    .eq('resend_email_id', emailId)
    .maybeSingle()

  if (!task) {
    console.warn(
      `No sequence_task for resend_email_id=${emailId} (event=${event.type}). ` +
      'Ensure SUPABASE_SERVICE_ROLE_KEY is set and send route saves sequence_task_id.',
    )
    return
  }

  if (eventRow?.id) {
    await supabase
      .from('email_events')
      .update({ sequence_task_id: task.id, lead_id: task.lead_id })
      .eq('id', eventRow.id)
  }

  const { data: lead } = await supabase
    .from('leads')
    .select('id, email_engagement, total_email_opens, total_email_clicks')
    .eq('id', task.lead_id)
    .maybeSingle()

  if (!lead) return

  const taskUpdates: Record<string, unknown> = {}
  const leadUpdates: Record<string, unknown> = {}

  switch (event.type) {
    case 'email.sent':
      if (canUpgradeEngagement(lead.email_engagement, 'sent')) {
        leadUpdates.email_engagement = 'sent'
      }
      break

    case 'email.delivered':
      if (!task.delivered_at) taskUpdates.delivered_at = eventAt
      if (canUpgradeEngagement(lead.email_engagement, 'delivered')) {
        leadUpdates.email_engagement = 'delivered'
      }
      break

    case 'email.opened':
      await handleEngagementGate(supabase, task, eventAt)
      if (!task.opened_at) taskUpdates.opened_at = eventAt
      taskUpdates.open_count = (task.open_count ?? 0) + 1
      leadUpdates.last_email_opened_at = eventAt
      leadUpdates.total_email_opens = (lead.total_email_opens ?? 0) + 1
      if (canUpgradeEngagement(lead.email_engagement, 'opened')) {
        leadUpdates.email_engagement = 'opened'
      }
      break

    case 'email.clicked':
      await handleEngagementGate(supabase, task, eventAt, true)
      if (!task.clicked_at) taskUpdates.clicked_at = eventAt
      taskUpdates.click_count = (task.click_count ?? 0) + 1
      leadUpdates.last_email_clicked_at = eventAt
      leadUpdates.total_email_clicks = (lead.total_email_clicks ?? 0) + 1
      leadUpdates.email_engagement = 'clicked'
      break

    case 'email.bounced':
      if (!task.bounced_at) taskUpdates.bounced_at = eventAt
      taskUpdates.bounce_reason = event.data?.bounce?.message ?? 'Email bounced'
      leadUpdates.email_engagement = 'bounced'
      leadUpdates.email_valid = false
      leadUpdates.email_status = 'invalid'
      await filterLeadAfterBounce(supabase, task.lead_id, task.sequence_id)
      break

    case 'email.complained':
      console.error(
        `SPAM COMPLAINT for lead ${task.lead_id}, email_id ${emailId} — affects sender reputation`,
      )
      leadUpdates.email_engagement = 'bounced'
      leadUpdates.email_valid = false
      leadUpdates.email_status = 'invalid'
      await filterLeadAfterBounce(supabase, task.lead_id, task.sequence_id)
      break

    default:
      break
  }

  if (Object.keys(taskUpdates).length > 0) {
    const { error } = await supabase.from('sequence_tasks').update(taskUpdates).eq('id', task.id)
    if (error) console.error('Failed to update sequence_task:', error)
  }

  if (Object.keys(leadUpdates).length > 0) {
    const { error } = await supabase.from('leads').update(leadUpdates).eq('id', lead.id)
    if (error) console.error('Failed to update lead:', error)
  }
}
