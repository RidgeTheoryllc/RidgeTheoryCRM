import type { SequenceChannel, SequenceTask, SequenceTriggerType } from '@/types'

export const CLOSE_LOOP_TITLE = 'Close Loop'

export interface EngagementStepTemplate {
  day_number: number
  channel: SequenceChannel
  title: string
  purpose: string
  trigger_type: SequenceTriggerType
}

/** 2 emails → LinkedIn → phone → close. Opens unlock next email; Email 2 open unlocks LinkedIn + phone; close unlocks after both are done. */
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

export function isCloseLoopTask(task: Pick<SequenceTask, 'title' | 'channel'>): boolean {
  return task.channel === 'email' && task.title === CLOSE_LOOP_TITLE
}

export function areManualEngagementStepsComplete(
  tasks: SequenceTask[],
  sequenceId: string,
): boolean {
  const manual = tasks.filter(
    (task) =>
      task.sequence_id === sequenceId &&
      (task.channel === 'linkedin' || task.channel === 'phone'),
  )
  return (
    manual.length >= 2 &&
    manual.every((task) => task.status === 'done' || task.status === 'sent' || task.status === 'skipped')
  )
}

export function findCloseLoopTask(
  tasks: SequenceTask[],
  sequenceId: string,
): SequenceTask | undefined {
  return tasks.find((task) => task.sequence_id === sequenceId && isCloseLoopTask(task))
}

/** Hide close-loop email until LinkedIn and phone are marked done. */
export function isOutreachTaskActionable(task: SequenceTask, allTasks: SequenceTask[]): boolean {
  if (!isCloseLoopTask(task) || task.status !== 'pending') return true
  return areManualEngagementStepsComplete(allTasks, task.sequence_id)
}
