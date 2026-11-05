import { NextResponse } from 'next/server'
import {
  agentIdentity,
  getPublicBaseUrl,
  getRequestUserId,
  getTwilioClient,
  requireAdmin,
  selectBestDid,
} from '@/lib/dialer/server'
import { toE164 } from '@/lib/dialer/phone'

/**
 * Click-to-call: picks the best caller ID from the rep's DID pool, then rings the rep's
 * browser. When the rep's leg connects, /api/twilio/voice dials the lead.
 */
export async function POST(request: Request) {
  const userId = await getRequestUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json()
  const leadId = typeof body.lead_id === 'string' ? body.lead_id.trim() : ''
  const sequenceTaskId = typeof body.sequence_task_id === 'string' ? body.sequence_task_id.trim() : ''
  if (!leadId) return NextResponse.json({ error: 'lead_id is required' }, { status: 400 })

  try {
    const { data: lead, error: leadError } = await requireAdmin()
      .from('leads')
      .select('id, phone')
      .eq('id', leadId)
      .maybeSingle()
    if (leadError) throw leadError
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const to = toE164(lead.phone ?? '')
    if (to.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ error: 'Lead has no valid phone number.' }, { status: 400 })
    }

    const { bestDid } = await selectBestDid(to, userId)
    if (!bestDid) {
      return NextResponse.json(
        { error: 'No caller ID available. Add an active number on the Dialer page (or wait for daily caps to reset).' },
        { status: 409 },
      )
    }

    const callerId = toE164(bestDid.did)
    const baseUrl = getPublicBaseUrl(new URL(request.url).origin)
    const params = new URLSearchParams({ to, callerId, leadId, userId, taskId: sequenceTaskId })

    const call = await getTwilioClient().calls.create({
      from: callerId,
      to: `client:${agentIdentity(userId)}`,
      url: `${baseUrl}/api/twilio/voice?${params}`,
      method: 'POST',
      statusCallback: `${baseUrl}/api/twilio/call-status?${params}`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['completed'],
    })

    return NextResponse.json({ callSid: call.sid, did: callerId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Call could not be started' },
      { status: 502 },
    )
  }
}
