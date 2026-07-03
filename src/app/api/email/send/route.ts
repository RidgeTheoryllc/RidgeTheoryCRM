import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

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
      text: body.text,
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

  const leadId = typeof body.lead_id === 'string' ? body.lead_id.trim() : ''
  if (leadId) {
    try {
      const supabase = getSupabaseAdmin()
      if (supabase) {
        const { data: lead } = await supabase
          .from('leads')
          .select('email_engagement')
          .eq('id', leadId)
          .maybeSingle()

        if (!lead || lead.email_engagement === 'none' || !lead.email_engagement) {
          await supabase
            .from('leads')
            .update({ email_engagement: 'sent' })
            .eq('id', leadId)
        }
      }
    } catch (err) {
      console.error('Failed to update lead engagement after send:', err)
    }
  }

  return NextResponse.json({ id: data.id })
}
