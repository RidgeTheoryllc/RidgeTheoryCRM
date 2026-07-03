import type { Lead, SequenceTask } from '@/types'
import type { EmailEngagement } from '@/lib/emailEngagement'
import { formatEngagementRelativeTime } from '@/lib/emailEngagement'
import { Badge } from '@/components/ui/atoms'

type LeadEngagementProps = {
  variant: 'lead'
  lead: Pick<
    Lead,
    | 'email_engagement'
    | 'total_email_opens'
    | 'last_email_opened_at'
    | 'total_email_clicks'
    | 'last_email_clicked_at'
  >
}

type TaskEngagementProps = {
  variant: 'task'
  task: Pick<
    SequenceTask,
    'opened_at' | 'open_count' | 'clicked_at' | 'click_count' | 'bounced_at' | 'bounce_reason'
  >
}

type EngagementBadgeProps = LeadEngagementProps | TaskEngagementProps

export function EngagementBadge(props: EngagementBadgeProps) {
  if (props.variant === 'task') {
    const { task } = props
    if (task.bounced_at) {
      return (
        <span title={task.bounce_reason ?? 'Bounced'}>
          <Badge className="shrink-0 bg-red-100 text-red-700">Bounced</Badge>
        </span>
      )
    }
    if (task.clicked_at) {
      return <Badge className="shrink-0 bg-green-100 text-green-700">Clicked</Badge>
    }
    if (task.opened_at) {
      const count = task.open_count ?? 1
      return (
        <span title={`Opened ${count} time${count === 1 ? '' : 's'}`}>
          <Badge className="shrink-0 bg-amber-100 text-amber-700">
            Opened {count}x
          </Badge>
        </span>
      )
    }
    return null
  }

  const eng = (props.lead.email_engagement ?? 'none') as EmailEngagement
  if (eng === 'none') return <span className="text-muted-foreground">—</span>

  if (eng === 'bounced') {
    return <Badge className="shrink-0 bg-red-100 text-red-700">Bounced</Badge>
  }
  if (eng === 'clicked') {
    return <Badge className="shrink-0 bg-green-100 text-green-700">Clicked</Badge>
  }
  if (eng === 'opened') {
    const count = props.lead.total_email_opens ?? 0
    const relative = formatEngagementRelativeTime(props.lead.last_email_opened_at)
    return (
      <span title={relative ? `Last opened ${relative}` : undefined}>
        <Badge className="shrink-0 bg-amber-100 text-amber-700">
          Opened {count > 0 ? `${count}x` : ''}
        </Badge>
      </span>
    )
  }
  if (eng === 'delivered') {
    return <Badge className="shrink-0 bg-blue-100 text-blue-700">Delivered</Badge>
  }
  if (eng === 'sent') {
    return <Badge className="shrink-0 bg-slate-100 text-slate-600">Sent</Badge>
  }
  return null
}
