import { NextResponse } from 'next/server'
import AccessToken from 'twilio/lib/jwt/AccessToken'
import { agentIdentity, getRequestUserId } from '@/lib/dialer/server'

const { VoiceGrant } = AccessToken

export async function GET(request: Request) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const apiKey = process.env.TWILIO_API_KEY
  const apiSecret = process.env.TWILIO_API_SECRET
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID

  if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
    return NextResponse.json(
      { error: 'Calling is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, and TWILIO_TWIML_APP_SID.' },
      { status: 500 },
    )
  }

  const userId = await getRequestUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const identity = agentIdentity(userId)
  const token = new AccessToken(accountSid, apiKey, apiSecret, {
    identity,
    ttl: 3600,
    // Allow for minor clock skew to avoid immediate 20104 errors.
    nbf: Math.floor(Date.now() / 1000) - 10,
  })
  token.addGrant(new VoiceGrant({ outgoingApplicationSid: twimlAppSid, incomingAllow: true }))

  return NextResponse.json({ token: token.toJwt(), identity })
}
