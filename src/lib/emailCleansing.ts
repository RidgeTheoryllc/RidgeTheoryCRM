import type { LeadStatus } from '@/types'
import { advanceLeadStatus } from '@/lib/leadStatus'

export type ReoonEmailStatus =
  | 'valid'
  | 'safe'
  | 'invalid'
  | 'catch_all'
  | 'unknown'
  | 'disposable'
  | 'role'
  | 'disabled'
  | 'spamtrap'
  | 'inbox_full'
  | string

export interface EmailCleansingResult {
  email: string
  status: ReoonEmailStatus
  valid: boolean
  is_deliverable: boolean
  is_safe_to_send: boolean
  is_disposable: boolean
  is_role_account: boolean
  is_catch_all: boolean
  summary: string
  validated_at: string
}

const INVALID_REOON_STATUSES = new Set([
  'invalid',
  'disposable',
  'spamtrap',
  'disabled',
  'inbox_full',
  'role',
])

export function isReoonEmailValid(data: {
  status?: ReoonEmailStatus
  is_deliverable?: boolean
  is_safe_to_send?: boolean
  is_disposable?: boolean
  is_spamtrap?: boolean
}): boolean {
  if (data.is_disposable || data.is_spamtrap) return false
  if (data.status && INVALID_REOON_STATUSES.has(data.status)) return false
  if (data.is_deliverable === true && data.is_safe_to_send === true) return true
  if (data.status === 'valid' || data.status === 'safe') return true
  return false
}

export function buildCleansingSummary(result: Pick<EmailCleansingResult, 'status' | 'is_deliverable' | 'is_disposable' | 'is_role_account' | 'is_catch_all'>): string {
  const flags: string[] = []
  if (result.is_disposable) flags.push('disposable')
  if (result.is_role_account) flags.push('role account')
  if (result.is_catch_all) flags.push('catch-all')
  const flagText = flags.length ? ` (${flags.join(', ')})` : ''
  const deliverable = result.is_deliverable ? 'deliverable' : 'not deliverable'
  return `Reoon: ${result.status}${flagText} - ${deliverable}`
}

const CLEANSING_NOTE_PATTERN = /^reoon:/i

export function isCleansingNoteLine(line: string): boolean {
  return CLEANSING_NOTE_PATTERN.test(line.trim())
}

export function stripCleansingNotes(notes: string): string {
  return notes
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !isCleansingNoteLine(line))
    .join('\n')
    .trim()
}

export function appendCleansingNote(notes: string, summary: string): string {
  const trimmed = notes.trim()
  if (!trimmed) return summary
  if (trimmed.includes(summary)) return trimmed
  return `${trimmed}\n${summary}`
}

export function statusAfterEmailCleansing(currentStatus: LeadStatus, emailValid: boolean | null | undefined): LeadStatus {
  if (emailValid === true) return advanceLeadStatus(currentStatus, 'Cleaned')
  return currentStatus
}

export async function verifyLeadEmail(email: string): Promise<EmailCleansingResult | null> {
  const response = await fetch('/api/email/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (response.status === 503) return null

  const data = await response.json()
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Email verification failed')
  }

  return data as EmailCleansingResult
}
