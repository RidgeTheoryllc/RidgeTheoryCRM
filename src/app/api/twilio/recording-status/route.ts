import { forbidden, readTwilioWebhook } from '@/lib/dialer/server'
import { saveRecordingForConference } from '@/lib/dialer/recording'

/** Conference recordingStatusCallback — attaches the recording to call_logs. */
export async function POST(request: Request) {
  const { params, valid } = await readTwilioWebhook(request)
  if (!valid) return forbidden()

  const conferenceName = new URL(request.url).searchParams.get('name')?.trim()
  const recordingSid = params.RecordingSid?.trim()
  const recordingUrl = params.RecordingUrl?.trim()
  if (!conferenceName || params.RecordingStatus?.toLowerCase() !== 'completed' || !recordingSid || !recordingUrl) {
    return new Response(null, { status: 204 })
  }

  try {
    await saveRecordingForConference({
      conferenceName,
      recordingSid,
      recordingUrl,
      recordingDuration: Number.parseInt(params.RecordingDuration ?? '0', 10) || null,
    })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('[twilio/recording-status]', error)
    return new Response(null, { status: 500 })
  }
}
