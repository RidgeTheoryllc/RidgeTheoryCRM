// ─────────────────────────────────────────────────────────────
// Dialer types (ported from Call_Number_Rotation)
// ─────────────────────────────────────────────────────────────

export type DidStatus = 'active' | 'cooldown' | 'retired'
export type CallResult = 'answered' | 'no_answer' | 'busy' | 'failed' | 'spam_flagged'

export interface DidRecord {
  id: string
  user_id: string
  did: string
  area_code: string
  status: DidStatus
  calls_today: number
  total_calls: number
  answer_rate: number
  spam_score: number
  last_used: string | null
  created_at?: string
}

export interface CallLogRecord {
  id: string
  user_id: string | null
  lead_id: string | null
  sequence_task_id: string | null
  phone: string
  did: string
  direction: 'inbound' | 'outbound'
  result: CallResult
  duration: number | null
  call_notes: string | null
  conference_name: string | null
  twilio_recording_sid: string | null
  recording_url: string | null
  timestamp: string
}

export const CALL_RESULT_LABEL: Record<CallResult, string> = {
  answered: 'Answered',
  no_answer: 'No answer',
  busy: 'Busy',
  failed: 'Failed',
  spam_flagged: 'Spam flagged',
}
