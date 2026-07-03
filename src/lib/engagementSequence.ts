import type { SequenceChannel, SequenceTriggerType } from '@/types'

export interface EngagementStepTemplate {
  day_number: number
  channel: SequenceChannel
  title: string
  purpose: string
  trigger_type: SequenceTriggerType
}

/** 2 emails → LinkedIn → phone → close. Steps after email 1 unlock on opens. */
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
    title: 'Close Loop',
    purpose: 'Polite closing email for engaged prospects.',
    trigger_type: 'automatic',
  },
]
