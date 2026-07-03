/** Escape text for a minimal HTML body so Resend can attach open/click tracking. */
export function textToTrackingHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.5;">${escaped.replace(/\n/g, '<br>')}</div>`
}

export function resolveResendEmailId(payload: {
  type?: string
  data?: { email_id?: string; id?: string }
}): string | null {
  const id = payload.data?.email_id ?? payload.data?.id
  return typeof id === 'string' && id.trim() ? id.trim() : null
}
