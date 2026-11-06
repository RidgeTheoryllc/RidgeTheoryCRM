import { NextResponse } from 'next/server'
import { getRequestUserId, isConferenceCallsEnabled } from '@/lib/dialer/server'
import { sendDigitsToLeadLeg } from '@/lib/dialer/conference'

/** IVR keypad: plays DTMF on the lead's leg. Falls back to the browser SDK when not in conference mode. */
export async function POST(request: Request) {
  const userId = await getRequestUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json()
  const digits = typeof body.digits === 'string' ? body.digits : ''
  if (!digits) return NextResponse.json({ error: 'digits is required' }, { status: 400 })

  if (!isConferenceCallsEnabled()) {
    return NextResponse.json({ success: false, fallback: 'client' })
  }

  try {
    const result = await sendDigitsToLeadLeg({ userId, digits })
    if (result.ok) return NextResponse.json({ success: true })
    return NextResponse.json({ success: false, fallback: 'client', message: result.message })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send digits'
    return NextResponse.json({ error: message }, { status: message.startsWith('Invalid DTMF') ? 400 : 502 })
  }
}
