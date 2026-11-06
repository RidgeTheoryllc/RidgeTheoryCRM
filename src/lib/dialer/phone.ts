export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '')
}

/** US-first E.164: 10 digits → +1…, 11 digits starting with 1 → +…. */
export function toE164(phone: string): string {
  const stripped = normalizePhone(phone)
  const digits = stripped.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (stripped.startsWith('+')) return stripped
  return digits ? `+${digits}` : ''
}

export function extractAreaCode(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 11 && digits.startsWith('1')) return digits.slice(1, 4)
  return digits.slice(0, 3)
}

export function toFixedNum(value: number, places = 2): number {
  return Number(value.toFixed(places))
}
