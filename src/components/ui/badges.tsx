import { Badge } from './atoms'
import { STAGE_COLOR, STATUS_COLOR, PRIORITY_COLOR, ACTIVITY_COLOR } from '@/types'
import type { DealStage, ContactStatus, TaskPriority, ActivityType } from '@/types'

export function StageBadge({ stage }: { stage: DealStage }) {
  return <Badge className={STAGE_COLOR[stage]}>{stage}</Badge>
}

export function StatusBadge({ status }: { status: ContactStatus }) {
  return <Badge className={STATUS_COLOR[status]}>{status}</Badge>
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge className={PRIORITY_COLOR[priority]}>{priority}</Badge>
}

export function ActivityBadge({ type }: { type: ActivityType }) {
  return <Badge className={ACTIVITY_COLOR[type]}>{type}</Badge>
}

export function TagBadge({ tag }: { tag: string }) {
  return (
    <Badge className="bg-gray-100 text-gray-600">{tag}</Badge>
  )
}
