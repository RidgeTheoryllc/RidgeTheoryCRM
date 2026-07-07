import type { SequenceChannel, SequenceTask, SequenceTaskStatus, SequenceTriggerType } from '@/types'

export const CLOSE_LOOP_TITLE = 'Close Loop'

export interface EngagementStepTemplate {
  day_number: number
  channel: SequenceChannel
  title: string
  purpose: string
  trigger_type: SequenceTriggerType
}

/** 2 emails → LinkedIn → phone → close. Each step unlocks only after the prior step completes. */
export const ENGAGEMENT_GATED_SEQUENCE: EngagementStepTemplate[] = [
  {
    day_number: 1,
    channel: 'email',
    title: 'Email 1',
    purpose: 'Short signal-led opener. Must be opened to receive Email 2.',
    trigger_type: 'automatic',
  },
  {
    day_number: 2,
    channel: 'email',
    title: 'Email 2',
    purpose: 'Follow-up with a useful angle. Must be opened to enter prospecting.',
    trigger_type: 'automatic',
  },
  {
    day_number: 3,
    channel: 'linkedin',
    title: 'LinkedIn',
    purpose: 'Connection or engagement after both emails were opened.',
    trigger_type: 'manual',
  },
  {
    day_number: 4,
    channel: 'phone',
    title: 'Call Attempt',
    purpose: 'Reference your emails and the business signal.',
    trigger_type: 'manual',
  },
  {
    day_number: 5,
    channel: 'email',
    title: CLOSE_LOOP_TITLE,
    purpose: 'Polite closing email for engaged prospects.',
    trigger_type: 'automatic',
  },
]

const TERMINAL_STATUSES: SequenceTaskStatus[] = ['done', 'sent', 'skipped']

export function isEngagementStepComplete(status: SequenceTaskStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export function isCloseLoopTask(task: Pick<SequenceTask, 'title' | 'channel'>): boolean {
  return task.channel === 'email' && task.title === CLOSE_LOOP_TITLE
}

export function findSequenceTaskByChannel(
  tasks: SequenceTask[],
  sequenceId: string,
  channel: 'linkedin' | 'phone',
): SequenceTask | undefined {
  return tasks.find((task) => task.sequence_id === sequenceId && task.channel === channel)
}

export function findCloseLoopTask(
  tasks: SequenceTask[],
  sequenceId: string,
): SequenceTask | undefined {
  return tasks.find((task) => task.sequence_id === sequenceId && isCloseLoopTask(task))
}

export const SEQUENCE_STEP_TABS = [
  { id: 'email1', day_number: 1, label: 'Email 1', shortLabel: '1', channel: 'email' as const },
  { id: 'email2', day_number: 2, label: 'Email 2', shortLabel: '2', channel: 'email' as const },
  { id: 'linkedin', day_number: 3, label: 'LinkedIn', shortLabel: '3', channel: 'linkedin' as const },
  { id: 'call', day_number: 4, label: 'Call', shortLabel: '4', channel: 'phone' as const },
  { id: 'close', day_number: 5, label: 'Close', shortLabel: '5', channel: 'email' as const },
] as const

export type SequenceStepTabId = (typeof SEQUENCE_STEP_TABS)[number]['id']

export function getTasksForStep(
  tasks: SequenceTask[],
  dayNumber: number,
  today: string,
  options?: { dueOnly?: boolean },
): SequenceTask[] {
  return tasks
    .filter((task) => {
      if (task.day_number !== dayNumber) return false
      if (options?.dueOnly !== false) {
        if (task.status !== 'pending') return false
        if (task.due_date > today) return false
        if (!isOutreachTaskActionable(task, tasks)) return false
      }
      return true
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
}

/** Sent emails at this step still waiting for an open (unlocks next step). */
export function getWaitingForOpenTasks(tasks: SequenceTask[], dayNumber: number): SequenceTask[] {
  return tasks.filter(
    (task) =>
      task.day_number === dayNumber &&
      task.channel === 'email' &&
      task.status === 'sent' &&
      !task.opened_at &&
      !task.bounced_at,
  )
}

export function isOutreachTaskActionable(task: SequenceTask, allTasks: SequenceTask[]): boolean {
  if (task.status !== 'pending') return true

  if (task.channel === 'phone') {
    const linkedin = findSequenceTaskByChannel(allTasks, task.sequence_id, 'linkedin')
    return linkedin ? isEngagementStepComplete(linkedin.status) : false
  }

  if (isCloseLoopTask(task)) {
    const phone = findSequenceTaskByChannel(allTasks, task.sequence_id, 'phone')
    return phone ? isEngagementStepComplete(phone.status) : false
  }

  return true
}

export type SequenceStepDisplayState = 'complete' | 'pending' | 'locked'

/** Whether a single step counts as finished for the progress flowchart. */
export function isStepCompleteForProgress(task: SequenceTask): boolean {
  if (task.status === 'skipped' || task.status === 'done') return true

  if (task.channel === 'email') {
    if (isCloseLoopTask(task)) return task.status === 'sent'
    return task.status === 'sent' && Boolean(task.opened_at)
  }

  return false
}

export function getSequenceStepDisplayState(task: SequenceTask): SequenceStepDisplayState {
  if (task.status === 'locked') return 'locked'
  if (isStepCompleteForProgress(task)) return 'complete'
  return 'pending'
}

export function isEngagementSequenceComplete(
  tasks: SequenceTask[],
  sequenceStatus?: string,
): boolean {
  if (sequenceStatus === 'completed') return true
  if (!tasks.length) return false

  const ordered = [...tasks].sort((a, b) => a.day_number - b.day_number)
  return ordered.every((task) => isStepCompleteForProgress(task))
}

export interface SequenceStepProgress {
  step: (typeof SEQUENCE_STEP_TABS)[number]
  task?: SequenceTask
  state: SequenceStepDisplayState
}

/** Ordered step states for the progress flowchart (one pending step at a time). */
export function getSequenceStepProgress(tasks: SequenceTask[]): SequenceStepProgress[] {
  let foundCurrent = false

  return SEQUENCE_STEP_TABS.map((step) => {
    const task = tasks.find((row) => row.day_number === step.day_number)
    if (!task || task.status === 'locked') {
      return { step, task, state: 'locked' as const }
    }
    if (isStepCompleteForProgress(task)) {
      return { step, task, state: 'complete' as const }
    }
    if (!foundCurrent) {
      foundCurrent = true
      return { step, task, state: 'pending' as const }
    }
    return { step, task, state: 'pending' as const }
  })
}

export interface LeadSequenceTrackingRow {
  sequenceId: string
  leadId: string
  sequenceStatus: string
  tasks: SequenceTask[]
  isComplete: boolean
  stepProgress: SequenceStepProgress[]
  latestActivityAt: string | null
}

export function buildLeadSequenceTrackingRows(
  sequences: Array<{ id: string; lead_id: string; status: string; tier: string }>,
  tasks: SequenceTask[],
  options?: { includeCompleted?: boolean },
): LeadSequenceTrackingRow[] {
  const engagementSequences = sequences.filter((seq) => seq.tier === 'engagement')
  const filtered = options?.includeCompleted !== false
    ? engagementSequences.filter((seq) => seq.status === 'active' || seq.status === 'completed')
    : engagementSequences.filter((seq) => seq.status === 'active')

  return filtered
    .map((sequence) => {
      const sequenceTasks = tasks
        .filter((task) => task.sequence_id === sequence.id)
        .sort((a, b) => a.day_number - b.day_number)

      const hasStarted = sequenceTasks.some((task) => task.status !== 'locked')
      if (!hasStarted) return null

      const latestActivityAt = sequenceTasks.reduce<string | null>((latest, task) => {
        const candidates = [task.sent_at, task.completed_at, task.opened_at].filter(Boolean) as string[]
        const taskLatest = candidates.sort().pop() ?? null
        if (!taskLatest) return latest
        if (!latest || taskLatest > latest) return taskLatest
        return latest
      }, null)

      const isComplete = isEngagementSequenceComplete(sequenceTasks, sequence.status)

      return {
        sequenceId: sequence.id,
        leadId: sequence.lead_id,
        sequenceStatus: sequence.status,
        tasks: sequenceTasks,
        isComplete,
        stepProgress: getSequenceStepProgress(sequenceTasks),
        latestActivityAt,
      }
    })
    .filter((row): row is LeadSequenceTrackingRow => row !== null)
    .sort((a, b) => (b.latestActivityAt ?? '').localeCompare(a.latestActivityAt ?? ''))
}
