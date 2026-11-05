import { forbidden, readTwilioWebhook, twimlResponse } from '@/lib/dialer/server'
import { buildJoinConferenceTwiml } from '@/lib/dialer/conference'

/** TwiML for the lead's PSTN leg: join the rep's conference room. */
export async function POST(request: Request) {
  const { valid } = await readTwilioWebhook(request)
  if (!valid) return forbidden()

  const query = new URL(request.url).searchParams
  const name = query.get('name')?.trim()
  if (!name) return new Response('Missing conference name', { status: 400 })

  return twimlResponse(
    buildJoinConferenceTwiml({
      conferenceName: name,
      callerId: query.get('callerId')?.trim() || undefined,
      startConferenceOnEnter: false,
      endConferenceOnExit: false,
    }),
  )
}
