import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.OUTREACH_FROM_EMAIL || process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY and OUTREACH_FROM_EMAIL (or RESEND_FROM_EMAIL) must be configured' },
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
    return NextResponse.json({ error: data }, { status: response.status })
  }

  return NextResponse.json({ id: data.id })
}
