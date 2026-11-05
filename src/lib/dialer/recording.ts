import { requireAdmin } from './server'

export async function saveRecordingForConference(input: {
  conferenceName: string
  recordingSid: string
  recordingUrl: string
  recordingDuration: number | null
}) {
  const supabase = requireAdmin()
  const duration = input.recordingDuration && input.recordingDuration > 0 ? input.recordingDuration : null

  const { data: updated, error } = await supabase
    .from('call_logs')
    .update({
      twilio_recording_sid: input.recordingSid,
      recording_url: input.recordingUrl,
      ...(duration ? { duration } : {}),
    })
    .eq('conference_name', input.conferenceName)
    .select('id')
  if (error) throw error

  if ((updated ?? []).length > 0) {
    await supabase.from('pending_call_recordings').delete().eq('conference_name', input.conferenceName)
    return
  }

  // The call log isn't written yet — buffer until the status callback creates it.
  const { error: pendingError } = await supabase.from('pending_call_recordings').upsert(
    {
      conference_name: input.conferenceName,
      twilio_recording_sid: input.recordingSid,
      recording_url: input.recordingUrl,
      recording_duration: duration,
    },
    { onConflict: 'conference_name' },
  )
  if (pendingError) throw pendingError
}

export async function mergePendingRecordingOntoCallLog(conferenceName: string, callLogId: string) {
  const supabase = requireAdmin()
  const { data: pending, error } = await supabase
    .from('pending_call_recordings')
    .select('twilio_recording_sid, recording_url, recording_duration')
    .eq('conference_name', conferenceName)
    .maybeSingle()
  if (error) throw error
  if (!pending) return

  const duration = pending.recording_duration as number | null
  const { error: updateError } = await supabase
    .from('call_logs')
    .update({
      twilio_recording_sid: pending.twilio_recording_sid,
      recording_url: pending.recording_url,
      ...(duration && duration > 0 ? { duration } : {}),
    })
    .eq('id', callLogId)
  if (updateError) throw updateError

  await supabase.from('pending_call_recordings').delete().eq('conference_name', conferenceName)
}
