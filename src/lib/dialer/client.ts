// ─────────────────────────────────────────────────────────────
// Browser-side dialer helpers
// ─────────────────────────────────────────────────────────────

import type { Call } from '@twilio/voice-sdk'
import { supabase } from '@/lib/supabase'

/** fetch() that sends the Supabase session so dialer APIs know which rep is calling. */
export async function dialerFetch(input: string, init: RequestInit = {}) {
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
  const token = data.session?.access_token
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(input, { ...init, headers })
}

export async function dialerJson<T>(input: string, init: RequestInit = {}): Promise<T> {
  const response = await dialerFetch(input, init)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Request failed')
  return data as T
}

/** Browser noise suppression, echo cancellation, and auto gain on the rep's mic. */
export const TWILIO_AUDIO_TRACK_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

export const TWILIO_RTC_CONSTRAINTS: MediaStreamConstraints = { audio: TWILIO_AUDIO_TRACK_CONSTRAINTS }

const PREFERRED_MIC_KEY = 'twilio-preferred-input-device-id'

export function readPreferredMicId(): string | null {
  try {
    return localStorage.getItem(PREFERRED_MIC_KEY)
  } catch {
    return null
  }
}

export function writePreferredMicId(deviceId: string) {
  try {
    localStorage.setItem(PREFERRED_MIC_KEY, deviceId)
  } catch {
    // Private mode / blocked storage
  }
}

/** Twilio call SID of the rep's browser leg. */
export function getAgentCallSid(call: Call | null): string | undefined {
  const sid = call?.parameters?.CallSid
  return typeof sid === 'string' && sid ? sid : undefined
}
