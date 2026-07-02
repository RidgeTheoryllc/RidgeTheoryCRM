import type { Lead } from '@/types'
import { stripCleansingNotes } from '@/lib/emailCleansing'

export const OUTREACH_SENDER_NAME = 'RidgeTheory'

export const DEFAULT_OUTREACH_PHONE = '(424) 273-5737'

export function formatOutreachPhone(phone?: string | null) {
  const value = phone?.trim()
  return value || DEFAULT_OUTREACH_PHONE
}

export function buildEmailSignoff(phone?: string | null) {
  return `Best,\n${OUTREACH_SENDER_NAME}\n${formatOutreachPhone(phone)}`
}

export function buildEmailPs(website?: string | null) {
  if (website?.trim()) {
    return 'PS We could also take a quick look at your current website setup if that would be useful.'
  }
  return 'PS Happy to take a quick look at how things are set up today if that would be useful.'
}

export function firstName(name: string) {
  return name.split(' ')[0] || name
}

/** Business context for outreach — never includes email verification or internal CRM notes. */
export function resolveOutreachSignal(
  lead: Pick<Lead, 'signal' | 'notes' | 'company_name' | 'source' | 'title' | 'pain_theme'>,
): string {
  if (lead.signal?.trim()) return lead.signal.trim()

  const cleanNotes = stripCleansingNotes(lead.notes ?? '')
  if (cleanNotes) {
    const firstLine = cleanNotes.split('\n').find((line) => line.trim())?.trim()
    if (firstLine) return firstLine
  }

  return inferOutreachSignal(lead)
}

function inferOutreachSignal(
  lead: Pick<Lead, 'company_name' | 'source' | 'title' | 'pain_theme'>,
): string {
  const theme = lead.pain_theme || 'operations'
  if (lead.source === 'Website') return `${lead.company_name || 'your team'} came through the site`
  if (lead.source === 'Referral') return `a referral mentioned ${lead.company_name || 'your team'}`
  if (lead.title) return `your role around ${theme}`
  return `what ${lead.company_name || 'your team'} is likely focused on right now`
}
