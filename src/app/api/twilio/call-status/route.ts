import { NextResponse } from 'next/server'
import {
  forbidden,
  getTwilioClient,
  readTwilioWebhook,
  requireAdmin,
  updateDidAfterCall,
} from '@/lib/dialer/server'
import { conferenceNameFromCallSid } from '@/lib/dialer/conference'
import { mergePendingRecordingOntoCallLog } from '@/lib/dialer/recording'
import { normalizePhone } from '@/lib/dialer/phone'
import type { CallResult } from '@/lib/dialer/types'

function mapLeadLegResult(status: string, duration: number): CallResult {
  if (status === 'in-progress') return 'answered'
  if (status === 'busy') return 'busy'
  if (status === 'no-answer' || status === 'canceled' || status === 'queued' || status === 'ringing') return 'no_answer'
  if (status === 'completed') return duration > 0 ? 'answered' : 'no_answer'
  return 'failed'
}

/**
 * The agent leg's own duration includes ring time, so the outcome is read from the
 * lead's PSTN leg: the conference session's lead_call_sid, or the <Dial> child call.
 */
async function resolveLeadLeg(agentCallSid: string, conferenceName: string) {
  const client = getTwilioClient()
  const { data: session } = await requireAdmin()
    .from('call_conference_sessions')
    .select('lead_call_sid')
    .eq('conference_name', conferenceName)
    .maybeSingle()

  const leadCallSid =
    (session?.lead_call_sid as string | null) ??
    (await client.calls.list({ parentCallSid: agentCallSid, limit: 5 })).find((c) => !c.to?.startsWith('client:'))?.sid
  if (!leadCallSid) return null

  const leadCall = await client.calls(leadCallSid).fetch()
  return { status: leadCall.status, duration: Number.parseInt(String(leadCall.duration ?? '0'), 10) || 0 }
}

/** Status callback for the rep's browser leg — logs the call and re-scores the DID. */
export async function POST(request: Request) {
  const { params, valid } = await readTwilioWebhook(request)
  if (!valid) return forbidden()

  const query = new URL(request.url).searchParams
  const userId = query.get('userId')
  const leadId = query.get('leadId')
  const taskId = query.get('taskId')
  const to = query.get('to')
  const callerId = query.get('callerId')
  if (!userId || !leadId || !to || !callerId) {
    return NextResponse.json({ error: 'Missing callback query params' }, { status: 400 })
  }

  try {
    const agentCallSid = params.CallSid ?? ''
    const conferenceName = agentCallSid ? conferenceNameFromCallSid(agentCallSid) : null

    let result: CallResult = 'failed'
    let duration = 0
    if (agentCallSid && conferenceName) {
      const leadLeg = await resolveLeadLeg(agentCallSid, conferenceName).catch(() => null)
      if (leadLeg) {
        result = mapLeadLegResult(leadLeg.status, leadLeg.duration)
        duration = leadLeg.duration
      }
    }

    const supabase = requireAdmin()
    const { data: log, error } = await supabase
      .from('call_logs')
      .insert({
        user_id: userId,
        lead_id: leadId,
        sequence_task_id: taskId || null,
        phone: normalizePhone(to),
        did: normalizePhone(callerId),
        direction: 'outbound',
        result,
        duration,
        conference_name: conferenceName,
      })
      .select('id')
      .single()
    if (error) throw error

    if (conferenceName) await mergePendingRecordingOntoCallLog(conferenceName, log.id)
    await updateDidAfterCall(callerId, result, userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[twilio/call-status]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 500 })
  }
}
