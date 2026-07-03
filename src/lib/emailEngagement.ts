import { formatDistanceToNow } from 'date-fns'

export type EmailEngagement = 'none' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced'

export const ENGAGEMENT_PRIORITY: Record<EmailEngagement, number> = {
  none: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  bounced: 5,
}

export function canUpgradeEngagement(
  current: EmailEngagement | string | null | undefined,
  next: EmailEngagement,
): boolean {
  const cur = (current ?? 'none') as EmailEngagement
  if (cur === 'bounced' || cur === 'clicked') return false
  if (next === 'bounced') return true
  if (cur === 'opened' && (next === 'delivered' || next === 'sent')) return false
  return ENGAGEMENT_PRIORITY[next] > ENGAGEMENT_PRIORITY[cur]
}

export function compareEngagementForSort(
  a: {
    email_engagement?: EmailEngagement | string | null
    total_email_opens?: number | null
    total_email_clicks?: number | null
    overall_score?: number | null
  },
  b: {
    email_engagement?: EmailEngagement | string | null
    total_email_opens?: number | null
    total_email_clicks?: number | null
    overall_score?: number | null
  },
): number {
  const aEng = (a.email_engagement ?? 'none') as EmailEngagement
  const bEng = (b.email_engagement ?? 'none') as EmailEngagement

  const positiveRank = (eng: EmailEngagement) => {
    if (eng === 'clicked') return 4
    if (eng === 'opened') return 3
    if (eng === 'delivered') return 2
    if (eng === 'sent') return 1
    return 0
  }

  const aRank = positiveRank(aEng)
  const bRank = positiveRank(bEng)
  if (aRank !== bRank) return bRank - aRank

  const aClicks = a.total_email_clicks ?? 0
  const bClicks = b.total_email_clicks ?? 0
  if (aClicks !== bClicks) return bClicks - aClicks

  const aOpens = a.total_email_opens ?? 0
  const bOpens = b.total_email_opens ?? 0
  if (aOpens !== bOpens) return bOpens - aOpens

  return (b.overall_score ?? 0) - (a.overall_score ?? 0)
}

export function formatEngagementRelativeTime(iso?: string | null): string | null {
  if (!iso) return null
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return null
  }
}

export function matchesEngagementFilter(
  lead: { email_engagement?: EmailEngagement | string | null },
  filter: 'all' | 'never_opened' | 'opened' | 'clicked' | 'bounced',
): boolean {
  const eng = (lead.email_engagement ?? 'none') as EmailEngagement
  if (filter === 'all') return true
  if (filter === 'never_opened') return eng === 'none' || eng === 'sent' || eng === 'delivered'
  if (filter === 'opened') return eng === 'opened' || eng === 'clicked'
  if (filter === 'clicked') return eng === 'clicked'
  if (filter === 'bounced') return eng === 'bounced'
  return true
}
