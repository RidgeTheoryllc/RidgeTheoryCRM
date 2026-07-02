import type { Lead, SequenceTask } from '@/types'
import { resolveOutreachCompany, resolveOutreachSignal } from '@/lib/outreach'

export function isEmailReady(task: SequenceTask, lead?: Pick<Lead, 'email'>): boolean {
  return Boolean(lead?.email && task.generated_subject && task.generated_body)
}

export async function requestProspectingDraft(lead: Lead, task: SequenceTask) {
  const response = await fetch('/api/ai/prospecting-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leadName: lead.name,
      title: lead.title,
      company: resolveOutreachCompany(lead),
      website: lead.website,
      source: lead.source,
      signal: resolveOutreachSignal(lead),
      painTheme: lead.pain_theme,
      rankTier: lead.rank_tier,
      channel: task.channel,
      dayNumber: task.day_number,
      stepTitle: task.title,
      purpose: task.purpose,
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Draft generation failed')
  return data as { subject?: string; body?: string; script?: string }
}

export async function requestSendEmail(to: string, subject: string, text: string) {
  const response = await fetch('/api/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, text }),
  })
  const data = await response.json()
  if (!response.ok) {
    const err = typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
    throw new Error(err || 'Email send failed')
  }
  return data as { id?: string }
}
