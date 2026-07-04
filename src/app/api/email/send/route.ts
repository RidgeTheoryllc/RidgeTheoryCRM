import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { textToTrackingHtml } from '@/lib/resendEmail'

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY
  const outreachFrom = process.env.OUTREACH_FROM_EMAIL?.trim()
  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim()
  const from = outreachFrom && !outreachFrom.includes('your-outreach-domain')
    ? outreachFrom
    : resendFrom

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
  const supabase = getSupabaseAdmin()
  if (supabase) {
    try {
      if (sequenceTaskId && resendId) {
        const { error: taskError } = await supabase
          .from('sequence_tasks')
          .update({
            resend_email_id: resendId,
            status: 'sent',
            sent_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          })
          .eq('id', sequenceTaskId)

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
          const { error: leadError } = await supabase
            .from('leads')
            .update({ email_engagement: 'sent' })
            .eq('id', leadId)

          if (leadError) {
            console.error('Failed to update lead engagement after send:', leadError)
          }
        }
      }
    } catch (err) {
      console.error('Post-send Supabase update failed:', err)
    }
  } else if (sequenceTaskId || leadId) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set — resend_email_id not saved server-side; webhooks cannot match emails')
  }

  return NextResponse.json({ id: resendId, task_linked: taskLinked })
}
