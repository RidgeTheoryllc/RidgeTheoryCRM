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

const COMPANY_NAME_PATTERN =
  /\b(LLC|L\.L\.C\.|INC|INCORPORATED|CORP|CORPORATION|CO\.|COMPANY|LTD|LIMITED|LP|PLLC|TRUCKING|ENTERPRISES|SERVICES|GROUP|HOLDINGS|LOGISTICS|TRANSPORT|TRANSPORTATION)\b/i

export function looksLikeCompanyName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  if (COMPANY_NAME_PATTERN.test(trimmed)) return true
  return trimmed === trimmed.toUpperCase() && /\s/.test(trimmed)
}

export function toDisplayCase(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return trimmed
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    const acronyms = new Set(['LLC', 'INC', 'CORP', 'LTD', 'LP', 'PLLC', 'CO'])
    return trimmed
      .toLowerCase()
      .split(/\s+/)
      .map((word) => {
        const bare = word.replace(/\./g, '').toUpperCase()
        if (acronyms.has(bare)) return bare
        return word.charAt(0).toUpperCase() + word.slice(1)
      })
      .join(' ')
  }
  return trimmed
}

/** Company label for outreach when company_name is missing from import. */
export function resolveOutreachCompany(
  lead: Pick<Lead, 'name' | 'company_name'>,
): string {
  if (lead.company_name?.trim()) return toDisplayCase(lead.company_name.trim())
  const name = lead.name?.trim() ?? ''
  if (looksLikeCompanyName(name)) return toDisplayCase(name)
  return name ? toDisplayCase(name) : 'your team'
}

/** Greeting name — "there" when the lead record is company-only (no person name). */
export function resolveOutreachGreetingName(
  lead: Pick<Lead, 'name' | 'company_name'>,
): string {
  const name = lead.name?.trim() ?? ''
  if (!name) return 'there'
  if (looksLikeCompanyName(name)) return 'there'
  return toDisplayCase(firstName(name))
}

export function sanitizeEmailSubject(subject: string, dayNumber?: number): string {
  let value = subject.trim().replace(/\s+/g, ' ')
  if (!value) return value

  if (dayNumber === 1 && /^re:\s*/i.test(value)) {
    value = value.replace(/^re:\s*/i, '').trim()
  }

  if (/your team\b/i.test(value) && value.split(/\s+/).length <= 4) {
    value = value.replace(/\byour team\b/gi, 'your ops')
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Business context for outreach — never includes email verification or internal CRM notes. */
export function resolveOutreachSignal(
  lead: Pick<Lead, 'signal' | 'notes' | 'company_name' | 'name' | 'source' | 'title' | 'pain_theme'>,
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
  lead: Pick<Lead, 'company_name' | 'name' | 'source' | 'title' | 'pain_theme'>,
): string {
  const company = resolveOutreachCompany(lead)
  const theme = lead.pain_theme || 'operations'
  if (lead.source === 'Website') return `${company} came through the site`
  if (lead.source === 'Referral') return `a referral mentioned ${company}`
  if (lead.title) return `your role around ${theme}`
  return `what ${company} is likely focused on right now`
}
