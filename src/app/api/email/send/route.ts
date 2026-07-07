import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveOutreachFromEmail, sendSequenceEmail } from '@/lib/sendSequenceEmail'
import { textToTrackingHtml } from '@/lib/resendEmail'

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY
  const from = resolveOutreachFromEmail()

  if (!apiKey || !from) {
    return NextResponse.json(
      {
        error: 'Email is not configured on the server. Set RESEND_API_KEY and RESEND_FROM_EMAIL (or OUTREACH_FROM_EMAIL) in your hosting environment variables, then redeploy.',
      },
      { status: 400 },
    )
  }

  const body = await request.json()
  if (!body.to || !body.subject || !body.text) {
    return NextResponse.json(
      { error: 'to, subject, and text are required' },
      { status: 400 },
    )
  }

  const leadId = typeof body.lead_id === 'string' ? body.lead_id.trim() : ''
  const sequenceTaskId = typeof body.sequence_task_id === 'string' ? body.sequence_task_id.trim() : ''
  const text = String(body.text)
  const supabase = getSupabaseAdmin()

  if (supabase && sequenceTaskId && leadId) {
    const result = await sendSequenceEmail({
      to: body.to,
      subject: body.subject,
      text,
      leadId,
      sequenceTaskId,
      supabase,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ id: result.resendId, task_linked: result.taskLinked ?? false })
  }

  const tags: { name: string; value: string }[] = []
  if (sequenceTaskId) tags.push({ name: 'sequence_task_id', value: sequenceTaskId })
  if (leadId) tags.push({ name: 'lead_id', value: leadId })

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: body.to,
      subject: body.subject,
      text,
      html: textToTrackingHtml(text),
      ...(tags.length > 0 ? { tags } : {}),
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    const message =
      typeof data.message === 'string' ? data.message
      : typeof data.error === 'string' ? data.error
      : JSON.stringify(data)
    return NextResponse.json({ error: message }, { status: response.status })
  }

  const resendId = typeof data.id === 'string' ? data.id : ''
  let taskLinked = false

  if (supabase && sequenceTaskId && resendId) {
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

    if (!taskError) taskLinked = true
  }

  return NextResponse.json({ id: resendId, task_linked: taskLinked })
}
