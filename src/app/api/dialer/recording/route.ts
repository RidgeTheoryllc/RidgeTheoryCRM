import { NextResponse } from 'next/server'
import { getRequestUserId, requireAdmin } from '@/lib/dialer/server'

/** Streams a call recording (Twilio requires Basic auth, so the browser can't fetch it directly). */
export async function GET(request: Request) {
  const userId = await getRequestUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) return NextResponse.json({ error: 'Twilio is not configured' }, { status: 500 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { data: log, error } = await requireAdmin()
    .from('call_logs')
    .select('twilio_recording_sid')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!log?.twilio_recording_sid) return NextResponse.json({ error: 'Recording not found' }, { status: 404 })

  const upstream = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${log.twilio_recording_sid}.mp3`,
    { headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}` } },
  )
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Recording unavailable' }, { status: 502 })
  }

  return new Response(upstream.body, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=3600' },
  })
}
