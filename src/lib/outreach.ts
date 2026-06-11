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
