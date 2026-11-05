import { forbidden, readTwilioWebhook } from '@/lib/dialer/server'
import { hangupCallBySid } from '@/lib/dialer/conference'

/** The lead's leg ended (hung up, busy, no answer) — release the rep's browser call. */
export async function POST(request: Request) {
  const { valid } = await readTwilioWebhook(request)
  if (!valid) return forbidden()

  const agentCallSid = new URL(request.url).searchParams.get('agentCallSid')?.trim()
  if (agentCallSid) await hangupCallBySid(agentCallSid)

  return new Response(null, { status: 204 })
}
