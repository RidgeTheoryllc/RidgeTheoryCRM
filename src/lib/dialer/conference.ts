// ─────────────────────────────────────────────────────────────
// Twilio conference calls: agent browser leg + lead PSTN leg in one room.
// Conference mode enables the IVR keypad and call recording.
// ─────────────────────────────────────────────────────────────

import twilio from 'twilio'
import { getTwilioClient, requireAdmin } from './server'
import { normalizePhone } from './phone'

const DTMF_PATTERN = /^[0-9*#w]+$/i

export function normalizeSendDigits(digits: string): string | null {
  const trimmed = digits.trim()
  return trimmed && DTMF_PATTERN.test(trimmed) ? trimmed : null
}

export function conferenceNameFromCallSid(callSid: string): string {
  return `cnf-${callSid.replace(/[^A-Za-z0-9]/g, '')}`
}

export function buildRecordingStatusCallbackUrl(baseUrl: string, conferenceName: string): string {
  const url = new URL('/api/twilio/recording-status', baseUrl)
  url.searchParams.set('name', conferenceName)
  return url.toString()
}

export function buildJoinConferenceTwiml(options: {
  conferenceName: string
  callerId?: string
  startConferenceOnEnter: boolean
  endConferenceOnExit: boolean
  statusCallback?: string
  recordingStatusCallback?: string
}) {
  const response = new twilio.twiml.VoiceResponse()
  const dial = response.dial(options.callerId ? { callerId: options.callerId } : {})
  dial.conference(
    {
      startConferenceOnEnter: options.startConferenceOnEnter,
      endConferenceOnExit: options.endConferenceOnExit,
      beep: 'false',
      ...(options.statusCallback
        ? { statusCallback: options.statusCallback, statusCallbackEvent: ['end', 'leave'] }
        : {}),
      ...(options.recordingStatusCallback
        ? {
            record: 'record-from-start',
            recordingStatusCallback: options.recordingStatusCallback,
            recordingStatusCallbackMethod: 'POST',
            recordingStatusCallbackEvent: ['completed'],
          }
        : {}),
    },
    options.conferenceName,
  )
  return response.toString()
}

export async function createConferenceSession(input: {
  userId: string
  conferenceName: string
  leadPhone: string
  callerId: string
  leadId?: string | null
  agentCallSid: string
}) {
  const supabase = requireAdmin()
  await supabase
    .from('call_conference_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('user_id', input.userId)
    .eq('status', 'active')

  const { error } = await supabase.from('call_conference_sessions').insert({
    user_id: input.userId,
    conference_name: input.conferenceName,
    direction: 'outbound',
    lead_phone: normalizePhone(input.leadPhone),
    caller_id: normalizePhone(input.callerId),
    agent_identity: `agent-${input.userId}`,
    lead_id: input.leadId || null,
    agent_call_sid: input.agentCallSid,
    status: 'active',
  })
  if (error) throw error
}

async function getActiveSession(column: 'conference_name' | 'user_id', value: string) {
  const { data, error } = await requireAdmin()
    .from('call_conference_sessions')
    .select('*')
    .eq(column, value)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as {
    conference_name: string
    caller_id: string
    agent_call_sid: string | null
    lead_call_sid: string | null
  } | null
}

export async function setConferenceLeadCallSid(conferenceName: string, leadCallSid: string) {
  await requireAdmin()
    .from('call_conference_sessions')
    .update({ lead_call_sid: leadCallSid })
    .eq('conference_name', conferenceName)
    .eq('status', 'active')
}

export async function endConferenceSession(conferenceName: string) {
  await requireAdmin()
    .from('call_conference_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('conference_name', conferenceName)
    .eq('status', 'active')
}

export async function hangupCallBySid(callSid: string) {
  const client = getTwilioClient()
  try {
    const call = await client.calls(callSid).fetch()
    if (call.status !== 'completed' && call.status !== 'canceled') {
      await client.calls(callSid).update({ status: 'completed' })
    }
  } catch {
    // Leg already ended.
  }
}

/** Dials the lead into the conference; when that leg ends, the agent leg is released. */
export async function dialLeadIntoConference(input: {
  baseUrl: string
  to: string
  from: string
  conferenceName: string
  agentCallSid: string
}) {
  const joinUrl = new URL('/api/twilio/conference/join', input.baseUrl)
  joinUrl.searchParams.set('name', input.conferenceName)
  joinUrl.searchParams.set('callerId', input.from)

  const leadStatusUrl = new URL('/api/twilio/conference/lead-leg-status', input.baseUrl)
  leadStatusUrl.searchParams.set('conferenceName', input.conferenceName)
  leadStatusUrl.searchParams.set('agentCallSid', input.agentCallSid)

  return getTwilioClient().calls.create({
    to: input.to,
    from: input.from,
    url: joinUrl.toString(),
    method: 'POST',
    statusCallback: leadStatusUrl.toString(),
    statusCallbackMethod: 'POST',
    statusCallbackEvent: ['completed'],
  })
}

/** When the lead leaves the conference, hang up the agent's browser leg so the UI resets. */
export async function disconnectAgentWhenLeadLeaves(conferenceName: string, leftCallSid: string | null) {
  if (!leftCallSid) return
  const session = await getActiveSession('conference_name', conferenceName)
  if (!session?.agent_call_sid || !session.lead_call_sid) return
  if (leftCallSid !== session.lead_call_sid) return

  // A DTMF redirect briefly removes the lead leg from the conference while the call stays live.
  await new Promise((resolve) => setTimeout(resolve, 1200))
  try {
    const leftCall = await getTwilioClient().calls(leftCallSid).fetch()
    if (['queued', 'ringing', 'in-progress'].includes(leftCall.status)) return
  } catch {
    // Twilio no longer has the leg — treat it as ended.
  }

  await hangupCallBySid(session.agent_call_sid)
  await endConferenceSession(conferenceName)
}

/**
 * Plays DTMF on the lead's PSTN leg, then rejoins it to the conference.
 * (Digits sent from the browser leg are swallowed by the conference.)
 */
export async function sendDigitsToLeadLeg(input: { userId: string; digits: string }) {
  const digits = normalizeSendDigits(input.digits)
  if (!digits) throw new Error('Invalid DTMF. Use 0-9, *, #, or w for pause.')

  const session = await getActiveSession('user_id', input.userId)
  if (!session?.lead_call_sid) {
    return { ok: false as const, message: 'Lead line is not ready yet. Try again in a moment.' }
  }

  const response = new twilio.twiml.VoiceResponse()
  response.play({ digits })
  const dial = response.dial(session.caller_id ? { callerId: session.caller_id } : {})
  dial.conference(
    { startConferenceOnEnter: false, endConferenceOnExit: false, beep: 'false' },
    session.conference_name,
  )

  await getTwilioClient().calls(session.lead_call_sid).update({ twiml: response.toString() })
  return { ok: true as const }
}
