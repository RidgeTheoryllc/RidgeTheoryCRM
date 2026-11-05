import twilio from 'twilio'
import { forbidden, readTwilioWebhook, twimlResponse } from '@/lib/dialer/server'

/** <Dial> action for direct-bridge calls: end the rep's leg once the lead leg resolves. */
export async function POST(request: Request) {
  const { valid } = await readTwilioWebhook(request)
  if (!valid) return forbidden()

  const response = new twilio.twiml.VoiceResponse()
  response.hangup()
  return twimlResponse(response.toString())
}
