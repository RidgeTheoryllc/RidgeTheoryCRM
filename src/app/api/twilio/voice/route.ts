import twilio from 'twilio'
import {
  forbidden,
  getPublicBaseUrl,
  isConferenceCallsEnabled,
  readTwilioWebhook,
  twimlResponse,
} from '@/lib/dialer/server'
import {
  buildJoinConferenceTwiml,
  buildRecordingStatusCallbackUrl,
  conferenceNameFromCallSid,
  createConferenceSession,
  dialLeadIntoConference,
  setConferenceLeadCallSid,
} from '@/lib/dialer/conference'

/** TwiML for the rep's browser leg once it is answered: bridge to the lead. */
export async function POST(request: Request) {
  const { params, valid } = await readTwilioWebhook(request)
  if (!valid) return forbidden()

  const query = new URL(request.url).searchParams
  const to = query.get('to')?.trim() ?? ''
  const callerId = query.get('callerId')?.trim() ?? ''
  const leadId = query.get('leadId')
  const userId = query.get('userId')?.trim() ?? ''
  const callSid = params.CallSid ?? ''

  if (!to || !callerId) {
    // Not a CRM click-to-call (e.g. someone calling a pool number directly).
    const response = new twilio.twiml.VoiceResponse()
    response.say('Thanks for calling. Please try again later.')
    response.hangup()
    return twimlResponse(response.toString())
  }

  if (isConferenceCallsEnabled() && callSid && userId) {
    const baseUrl = getPublicBaseUrl(new URL(request.url).origin)
    const conferenceName = conferenceNameFromCallSid(callSid)

    try {
      await createConferenceSession({ userId, conferenceName, leadPhone: to, callerId, leadId, agentCallSid: callSid })

      void dialLeadIntoConference({ baseUrl, to, from: callerId, conferenceName, agentCallSid: callSid })
        .then((leadCall) => setConferenceLeadCallSid(conferenceName, leadCall.sid))
        .catch((error) => console.error('[twilio/voice] failed to dial lead into conference', error))

      const statusUrl = new URL('/api/twilio/conference/status', baseUrl)
      statusUrl.searchParams.set('name', conferenceName)

      return twimlResponse(
        buildJoinConferenceTwiml({
          conferenceName,
          startConferenceOnEnter: true,
          endConferenceOnExit: true,
          statusCallback: statusUrl.toString(),
          recordingStatusCallback: buildRecordingStatusCallbackUrl(baseUrl, conferenceName),
        }),
      )
    } catch (error) {
      console.error('[twilio/voice] conference setup failed, falling back to direct dial', error)
    }
  }

  // Direct bridge (no keypad-to-lead, no recording).
  const actionUrl = new URL('/api/twilio/voice-status', getPublicBaseUrl(new URL(request.url).origin))
  const response = new twilio.twiml.VoiceResponse()
  const dial = response.dial({
    callerId,
    timeout: 30,
    answerOnBridge: true,
    action: actionUrl.toString(),
    method: 'POST',
  })
  dial.number(to)
  return twimlResponse(response.toString())
}
