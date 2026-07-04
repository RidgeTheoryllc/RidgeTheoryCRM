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

/** Hide phone/close-loop until the prior engagement step is marked done. */
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
