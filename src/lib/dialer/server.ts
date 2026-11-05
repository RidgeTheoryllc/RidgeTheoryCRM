// ─────────────────────────────────────────────────────────────
// Server-only dialer helpers: auth, Twilio client, DID pool queries.
// ─────────────────────────────────────────────────────────────

import twilio from 'twilio'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getDidCallsToday, pickBestDid, updateDidScoreAfterCall } from './didEngine'
import { extractAreaCode, normalizePhone, toFixedNum } from './phone'
import type { CallResult, DidRecord } from './types'

export function requireAdmin(): SupabaseClient {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }
  return supabase
}

/** Resolves the signed-in rep from the `Authorization: Bearer <access token>` header. */
export async function getRequestUserId(request: Request): Promise<string | null> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!token) return null
  const supabase = getSupabaseAdmin()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

export function agentIdentity(userId: string): string {
  return `agent-${userId}`
}

export function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) {
    throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN')
  }
  return twilio(accountSid, authToken)
}

/** Public URL Twilio can reach for webhooks (use an ngrok/cloudflared URL when running locally). */
export function getPublicBaseUrl(fallbackOrigin: string): string {
  const configured =
    process.env.TWILIO_WEBHOOK_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim()
  return (configured || fallbackOrigin).replace(/\/$/, '')
}

export function isConferenceCallsEnabled(): boolean {
  const flag = process.env.TWILIO_CONFERENCE_CALLS?.trim().toLowerCase()
  return flag === '1' || flag === 'true' || flag === 'yes'
}

/**
 * Parses a Twilio webhook body and verifies its X-Twilio-Signature against the public URL.
 * Set TWILIO_VALIDATE_WEBHOOKS=false to skip (e.g. behind a proxy that rewrites URLs).
 */
export async function readTwilioWebhook(request: Request) {
  const form = await request.formData()
  const params: Record<string, string> = {}
  form.forEach((value, key) => {
    params[key] = String(value)
  })

  const authToken = process.env.TWILIO_AUTH_TOKEN
  const skip = process.env.TWILIO_VALIDATE_WEBHOOKS?.trim().toLowerCase() === 'false'
  if (skip || !authToken) return { params, valid: true }

  const requestUrl = new URL(request.url)
  const publicUrl = `${getPublicBaseUrl(requestUrl.origin)}${requestUrl.pathname}${requestUrl.search}`
  const signature = request.headers.get('x-twilio-signature') ?? ''
  return { params, valid: twilio.validateRequest(authToken, signature, publicUrl, params) }
}

export function forbidden() {
  return new Response('Invalid Twilio signature', { status: 403 })
}

export function twimlResponse(xml: string, status = 200) {
  return new Response(xml, { status, headers: { 'Content-Type': 'text/xml' } })
}

export async function listDidPool(userId: string): Promise<DidRecord[]> {
  const { data, error } = await requireAdmin()
    .from('did_pool')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DidRecord[]
}

export async function selectBestDid(leadPhone: string, userId: string) {
  const leadAreaCode = extractAreaCode(leadPhone)
  const dids = await listDidPool(userId)
  return { bestDid: pickBestDid(dids, leadAreaCode), leadAreaCode }
}

/** Re-scores a DID after a call: spam score, status, answer rate, daily counter. */
export async function updateDidAfterCall(didNumber: string, callResult: CallResult, userId: string) {
  const supabase = requireAdmin()
  const normalized = normalizePhone(didNumber)
  const did = (await listDidPool(userId)).find((row) => normalizePhone(row.did) === normalized)
  if (!did) return

  const { data: logs, error: logsError } = await supabase
    .from('call_logs')
    .select('did, result')
    .eq('user_id', userId)
  if (logsError) throw logsError

  const didLogs = (logs ?? []).filter((log) => normalizePhone(log.did) === normalized)
  const answered = didLogs.filter((log) => log.result === 'answered').length
  const answerRate = didLogs.length > 0 ? toFixedNum((answered / didLogs.length) * 100) : 0

  const { error } = await supabase
    .from('did_pool')
    .update({
      ...updateDidScoreAfterCall(did, callResult),
      answer_rate: answerRate,
      calls_today: getDidCallsToday(did) + 1,
      total_calls: didLogs.length,
      last_used: new Date().toISOString(),
    })
    .eq('id', did.id)
  if (error) throw error
}
