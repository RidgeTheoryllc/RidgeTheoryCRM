import type { LeadIngestionSource, LeadStatus } from '@/types'

export type LeadBucket = 'all' | 'new' | 'prospecting' | 'qualified' | 'disqualified'

export const LEAD_BUCKETS: { id: LeadBucket; label: string; description: string; statuses: LeadStatus[] }[] = [
  { id: 'all', label: 'All', description: 'Every lead', statuses: [] },
  {
    id: 'new',
    label: 'New',
    description: 'Imported or added, not yet in a sequence',
    statuses: ['Generated', 'Augmented', 'Cleaned', 'Entered'],
  },
  { id: 'prospecting', label: 'Prospecting', description: 'Enrolled in an active sequence', statuses: ['Prospecting'] },
  { id: 'qualified', label: 'Qualified', description: 'Sequence completed', statuses: ['Qualified'] },
  { id: 'disqualified', label: 'Disqualified', description: 'Removed from outreach', statuses: ['Disqualified'] },
]

const PIPELINE: LeadStatus[] = [
  'Generated', 'Augmented', 'Cleaned', 'Entered', 'Prospecting', 'Qualified',
]

export function matchesLeadBucket(status: LeadStatus, bucket: LeadBucket): boolean {
  if (bucket === 'all') return true
  const match = LEAD_BUCKETS.find((item) => item.id === bucket)
  return match ? match.statuses.includes(status) : true
}

export function countLeadsByBucket(leads: { status: LeadStatus }[], bucket: LeadBucket): number {
  return leads.filter((lead) => matchesLeadBucket(lead.status, bucket)).length
}

export function statusForIngestion(source: LeadIngestionSource): LeadStatus {
  return source === 'auto' ? 'Generated' : 'Entered'
}

export function resolveNewLeadStatus(
  status: LeadStatus,
  ingestionSource: LeadIngestionSource,
): LeadStatus {
  if (status !== 'Generated') return status
  return statusForIngestion(ingestionSource)
}

export function advanceLeadStatus(current: LeadStatus, target: LeadStatus): LeadStatus {
  if (target === 'Disqualified') return 'Disqualified'
  if (current === 'Disqualified') return current

  const currentIdx = PIPELINE.indexOf(current)
  const targetIdx = PIPELINE.indexOf(target)
  if (targetIdx === -1 || currentIdx === -1) return target
  return targetIdx > currentIdx ? target : current
}
