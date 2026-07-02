import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY
  const outreachFrom = process.env.OUTREACH_FROM_EMAIL?.trim()
  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim()
  // OUTREACH_FROM_EMAIL wins when set; ignore placeholder values from .env.example
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

  return NextResponse.json({ id: data.id })
}
