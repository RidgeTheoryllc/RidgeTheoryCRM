import type { SupabaseClient } from '@supabase/supabase-js'
import { textToTrackingHtml } from '@/lib/resendEmail'

export function resolveOutreachFromEmail(): string | null {
  const outreachFrom = process.env.OUTREACH_FROM_EMAIL?.trim()
  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim()
  if (outreachFrom && !outreachFrom.includes('your-outreach-domain')) return outreachFrom
  return resendFrom || null
}

export interface SendSequenceEmailParams {
  to: string
  subject: string
  text: string
  leadId: string
  sequenceTaskId: string
  supabase: SupabaseClient
}

export interface SendSequenceEmailResult {
  ok: boolean
  resendId?: string
  taskLinked?: boolean
  error?: string
}

export async function sendSequenceEmail(
  params: SendSequenceEmailParams,
): Promise<SendSequenceEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = resolveOutreachFromEmail()

  if (!apiKey || !from) {
    return {
      ok: false,
      error: 'RESEND_API_KEY or RESEND_FROM_EMAIL is not configured',
    }
  }

  const { to, subject, text, leadId, sequenceTaskId, supabase } = params
  const tags: { name: string; value: string }[] = [
    { name: 'sequence_task_id', value: sequenceTaskId },
    { name: 'lead_id', value: leadId },
  ]

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html: textToTrackingHtml(text),
      tags,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    const message =
      typeof data.message === 'string' ? data.message
      : typeof data.error === 'string' ? data.error
      : JSON.stringify(data)
    return { ok: false, error: message }
  }

  const resendId = typeof data.id === 'string' ? data.id : ''
  let taskLinked = false

  if (sequenceTaskId && resendId) {
    const sentAt = new Date().toISOString()
    const { error: taskError } = await supabase
      .from('sequence_tasks')
      .update({
        resend_email_id: resendId,
        status: 'sent',
        sent_at: sentAt,
        completed_at: sentAt,
      })
      .eq('id', sequenceTaskId)
      .eq('status', 'pending')

    if (taskError) {
      console.error('Failed to link resend_email_id on sequence_task:', taskError.message)
    } else {
      taskLinked = true
    }
  }

  if (leadId) {
    const { data: lead } = await supabase
      .from('leads')
      .select('email_engagement')
      .eq('id', leadId)
      .maybeSingle()

    if (!lead || lead.email_engagement === 'none' || !lead.email_engagement) {
      await supabase.from('leads').update({ email_engagement: 'sent' }).eq('id', leadId)
    }
  }

  return { ok: true, resendId, taskLinked }
}
