import { forbidden, readTwilioWebhook } from '@/lib/dialer/server'
import { disconnectAgentWhenLeadLeaves, endConferenceSession } from '@/lib/dialer/conference'

/** Conference lifecycle: lead leaving releases the rep; conference end closes the session. */
export async function POST(request: Request) {
  const { params, valid } = await readTwilioWebhook(request)
  if (!valid) return forbidden()

  const conferenceName = new URL(request.url).searchParams.get('name')
  if (!conferenceName) return new Response(null, { status: 204 })

  const event = (params.StatusCallbackEvent ?? '').toLowerCase()
  if (event === 'participant-leave') {
    await disconnectAgentWhenLeadLeaves(conferenceName, params.CallSid?.trim() || null)
  } else if (event === 'conference-end') {
    await endConferenceSession(conferenceName)
  }

  return new Response(null, { status: 204 })
}
