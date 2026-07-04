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
import { canUpgradeEngagement } from '@/lib/emailEngagement'
import { resolveResendEmailId } from '@/lib/resendEmail'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { filterLeadAfterBounce, handleEngagementGate } from '@/lib/sequenceGating'
import { checkEngagementSchema, resolveWebhookSequenceTask } from '@/lib/webhookTaskLookup'

interface ResendWebhookPayload {
  type: string
  created_at?: string
  data?: {
    email_id?: string
    id?: string
    created_at?: string
    to?: string[]
    tags?: Record<string, string>
    bounce?: { message?: string }
    click?: { link?: string }
  }
}

export async function GET() {
  const supabase = getSupabaseAdmin()
  const base = {
    webhook_secret_set: Boolean(process.env.RESEND_WEBHOOK_SECRET),
    supabase_admin_set: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    resend_api_key_set: Boolean(process.env.RESEND_API_KEY),
    engagement_columns_ok: false,
    engagement_columns_error: null as string | null,
    email_events_count: null as number | null,
  }

  if (supabase) {
    const schema = await checkEngagementSchema(supabase)
    base.engagement_columns_ok = schema.ok
    base.engagement_columns_error = schema.error

    const { count, error } = await supabase
      .from('email_events')
      .select('*', { count: 'exact', head: true })

    if (!error) base.email_events_count = count
  }

  return NextResponse.json(base)
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
        id: request.headers.get('svix-id') ?? request.headers.get('webhook-id') ?? '',
        timestamp:
          request.headers.get('svix-timestamp') ?? request.headers.get('webhook-timestamp') ?? '',
        signature:
          request.headers.get('svix-signature') ?? request.headers.get('webhook-signature') ?? '',
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

  const { error: insertError } = await supabase.from('email_events').insert({
    resend_message_id: emailId,
    event_type: eventType,
    raw_payload: event,
  })

  if (insertError) {
    console.error('Failed to insert email_events (run email-engagement.sql?):', insertError.message)
  }

  const { task } = await resolveWebhookSequenceTask(supabase, event)

  if (!task) {
    console.warn(
      `No sequence_task for email_id=${emailId} event=${event.type} to=${JSON.stringify(event.data?.to ?? [])}`,
    )
    return
  }

  const taskId = task.id as string
  const leadId = task.lead_id as string
  const sequenceId = task.sequence_id as string

  await supabase
    .from('email_events')
    .update({ sequence_task_id: taskId, lead_id: leadId })
    .eq('resend_message_id', emailId)
    .is('sequence_task_id', null)

  const { data: lead } = await supabase
    .from('leads')
    .select('id, email_engagement, total_email_opens, total_email_clicks')
    .eq('id', leadId)
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
      taskUpdates.open_count = Number(task.open_count ?? 0) + 1
      leadUpdates.last_email_opened_at = eventAt
      leadUpdates.total_email_opens = Number(lead.total_email_opens ?? 0) + 1
      if (canUpgradeEngagement(lead.email_engagement, 'opened')) {
        leadUpdates.email_engagement = 'opened'
      }
      break

    case 'email.clicked':
      await handleEngagementGate(supabase, task, eventAt, true)
      if (!task.clicked_at) taskUpdates.clicked_at = eventAt
      taskUpdates.click_count = Number(task.click_count ?? 0) + 1
      leadUpdates.last_email_clicked_at = eventAt
      leadUpdates.total_email_clicks = Number(lead.total_email_clicks ?? 0) + 1
      leadUpdates.email_engagement = 'clicked'
      break

    case 'email.bounced':
      if (!task.bounced_at) taskUpdates.bounced_at = eventAt
      taskUpdates.bounce_reason = event.data?.bounce?.message ?? 'Email bounced'
      leadUpdates.email_engagement = 'bounced'
      leadUpdates.email_valid = false
      leadUpdates.email_status = 'invalid'
      await filterLeadAfterBounce(supabase, leadId, sequenceId)
      break

    case 'email.complained':
      console.error(`SPAM COMPLAINT for lead ${leadId}, email_id ${emailId}`)
      leadUpdates.email_engagement = 'bounced'
      leadUpdates.email_valid = false
      leadUpdates.email_status = 'invalid'
      await filterLeadAfterBounce(supabase, leadId, sequenceId)
      break

    default:
      break
  }

  if (Object.keys(taskUpdates).length > 0) {
    const { error } = await supabase.from('sequence_tasks').update(taskUpdates).eq('id', taskId)
    if (error) {
      console.error('Failed to update sequence_task:', error.message, taskUpdates)
    }
  }

  if (Object.keys(leadUpdates).length > 0) {
    const { error } = await supabase.from('leads').update(leadUpdates).eq('id', lead.id)
    if (error) {
      console.error('Failed to update lead:', error.message, leadUpdates)
    }
  }
}
