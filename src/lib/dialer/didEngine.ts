// ─────────────────────────────────────────────────────────────
// DID rotation scoring — picks the best caller ID for each lead.
// score = local presence (+50) + answer_rate×0.5 − spam×0.3 − calls_today×0.2
// ─────────────────────────────────────────────────────────────

import type { CallResult, DidRecord } from './types'
import { toFixedNum } from './phone'

const APP_TIMEZONE = process.env.DIALER_TIMEZONE || 'Asia/Manila'

export function getAppDateKey(value: Date | string): string | null {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function getDidCallsToday(did: DidRecord, now = new Date()): number {
  const todayKey = getAppDateKey(now)
  const lastUsedDay = did.last_used ? getAppDateKey(did.last_used) : null
  if (!todayKey || todayKey !== lastUsedDay) return 0
  return Math.max(0, did.calls_today ?? 0)
}

/** Daily cap ramps up as a number ages (warmup), tightened for spammy numbers. */
export function getDidWarmupCap(did: DidRecord): number {
  const createdAt = did.created_at ? new Date(did.created_at) : null
  let ageDays = 0
  if (createdAt && !Number.isNaN(createdAt.getTime())) {
    ageDays = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86_400_000))
  }

  let cap = 100
  if (ageDays <= 1) cap = 50
  else if (ageDays === 2) cap = 70
  else if (ageDays === 3) cap = 85

  if (did.answer_rate >= 25 && did.spam_score < 20) cap += 5
  if (did.spam_score > 60) cap = Math.min(cap, 10)

  return Math.max(5, Math.min(100, cap))
}

export function scoreDid(did: DidRecord, leadAreaCode: string): number {
  const localPresenceBoost = did.area_code === leadAreaCode ? 50 : 0
  return localPresenceBoost + did.answer_rate * 0.5 - did.spam_score * 0.3 - getDidCallsToday(did) * 0.2
}

export function getClosestAreaCodeMatch(candidates: DidRecord[], leadAreaCode: string) {
  if (!candidates.length) return null
  const leadAreaNum = Number(leadAreaCode)
  if (Number.isNaN(leadAreaNum)) return candidates[0]
  return [...candidates].sort(
    (a, b) => Math.abs(Number(a.area_code) - leadAreaNum) - Math.abs(Number(b.area_code) - leadAreaNum),
  )[0]
}

export function pickBestDid(dids: DidRecord[], leadAreaCode: string): DidRecord | null {
  const available = dids.filter(
    (did) => did.status === 'active' && getDidCallsToday(did) < getDidWarmupCap(did) && did.spam_score < 80,
  )
  if (!available.length) return null

  const scored = available
    .map((did) => ({ did, score: scoreDid(did, leadAreaCode) }))
    .sort((a, b) => b.score - a.score)
  let best = scored[0].did

  // Prefer a nearby area code when it scores almost as well.
  if (best.area_code !== leadAreaCode) {
    const closest = getClosestAreaCodeMatch(available, leadAreaCode)
    if (closest && scoreDid(closest, leadAreaCode) >= scored[0].score - 8) best = closest
  }

  return best
}

export function updateDidScoreAfterCall(did: DidRecord, callResult: CallResult) {
  let spamScore = Number(did.spam_score)
  if (callResult === 'answered') spamScore = Math.max(0, spamScore - 1)
  else if (callResult === 'no_answer') spamScore = Math.min(100, spamScore + 1)
  else if (callResult === 'spam_flagged') spamScore = Math.min(100, spamScore + 18)
  else spamScore = Math.min(100, spamScore + 5)

  let status = did.status
  if (spamScore > 95) status = 'retired'
  else if (spamScore > 80) status = 'cooldown'

  return { spam_score: toFixedNum(spamScore), status }
}
