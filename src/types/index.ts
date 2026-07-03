// ─────────────────────────────────────────────────────────────
// Core CRM Types
// TODO (Supabase): These map 1:1 to your database table schemas
// ─────────────────────────────────────────────────────────────

export type AppRole = 'admin' | 'manager' | 'sales'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: AppRole
  created_at: string
}

export interface OwnedRecord {
  owner_id?: string | null
}

export type Industry =
  | 'SaaS' | 'Fintech' | 'Healthcare' | 'Retail'
  | 'Manufacturing' | 'Consulting' | 'Other'

export type CompanySize = '1-10' | '11-50' | '51-200' | '201-1000' | '1000+'

export interface Company extends OwnedRecord {
  id: string
  name: string
  industry: Industry
  website: string
  size: CompanySize
  tags: string[]
  created_at: string
}

export type ContactStatus = 'Lead' | 'Prospect' | 'Customer' | 'Churned'
export type LeadSource = 'Website' | 'LinkedIn' | 'Referral' | 'Cold Outreach' | 'Event' | 'Other'
export type LeadIngestionSource = 'auto' | 'manual'
export type LeadRankTier = 'high' | 'low'
export type LeadSegment = 'raw' | 'warm'
export type EmailEngagement = 'none' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced'
export type LeadStatus =
  | 'Generated' | 'Augmented' | 'Cleaned' | 'Entered'
  | 'Prospecting' | 'Qualified' | 'Disqualified'

export interface Lead extends OwnedRecord {
  id: string
  name: string
  title: string
  email: string
  phone: string
  company_name: string
  website: string
  source: LeadSource
  ingestion_source: LeadIngestionSource
  status: LeadStatus
  segment?: LeadSegment
  responded_at?: string | null
  notes: string
  tags: string[]
  interest_score?: number
  decision_maker_score?: number
  fit_score?: number
  overall_score?: number
  rank_tier?: LeadRankTier
  signal?: string
  pain_theme?: string
  email_status?: string | null
  email_valid?: boolean | null
  email_validated_at?: string | null
  email_engagement?: EmailEngagement
  last_email_opened_at?: string | null
  total_email_opens?: number
  last_email_clicked_at?: string | null
  total_email_clicks?: number
  company_id: string | null
  contact_id: string | null
  created_at: string
}

export interface Contact extends OwnedRecord {
  id: string
  name: string
  title: string
  email: string
  phone: string
  linked_in: string
  lead_source: LeadSource
  status: ContactStatus
  tags: string[]
  company_id: string | null
  created_at: string
}

export type DealStage =
  | 'Lead' | 'Qualified' | 'Proposal'
  | 'Negotiation' | 'Closed Won' | 'Closed Lost'

export interface Deal extends OwnedRecord {
  id: string
  title: string
  value: number
  stage: DealStage
  probability: number
  close_date: string
  notes: string
  company_id: string | null
  contact_id: string | null
  created_at: string
}

export type ActivityType = 'note' | 'call' | 'email' | 'meeting'

export interface Activity extends OwnedRecord {
  id: string
  type: ActivityType
  body: string
  timestamp: string
  deal_id: string
}

export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'open' | 'done'
export type SequenceTier = 'high' | 'low' | 'engagement'
export type SequenceStatus = 'active' | 'paused' | 'completed'
export type SequenceChannel = 'email' | 'linkedin' | 'phone'
export type SequenceTriggerType = 'automatic' | 'manual'
export type SequenceTaskStatus = 'pending' | 'sent' | 'done' | 'skipped' | 'locked'

export interface ProspectingSequence extends OwnedRecord {
  id: string
  lead_id: string
  tier: SequenceTier
  status: SequenceStatus
  start_date: string
  created_at: string
}

export interface SequenceTask extends OwnedRecord {
  id: string
  sequence_id: string
  lead_id: string
  day_number: number
  channel: SequenceChannel
  title: string
  purpose: string
  due_date: string
  trigger_type: SequenceTriggerType
  status: SequenceTaskStatus
  generated_subject: string
  generated_body: string
  generated_script: string
  resend_email_id: string
  sent_at: string | null
  completed_at: string | null
  delivered_at?: string | null
  opened_at?: string | null
  open_count?: number
  clicked_at?: string | null
  click_count?: number
  bounced_at?: string | null
  bounce_reason?: string | null
  created_at: string
}

export interface Task extends OwnedRecord {
  id: string
  title: string
  due_date: string
  priority: TaskPriority
  status: TaskStatus
  deal_id: string | null
  contact_id: string | null
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const STAGES: DealStage[] = [
  'Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost',
]

export const STAGE_PROBABILITY: Record<DealStage, number> = {
  Lead: 10,
  Qualified: 25,
  Proposal: 50,
  Negotiation: 75,
  'Closed Won': 100,
  'Closed Lost': 0,
}

export const STAGE_COLOR: Record<DealStage, string> = {
  Lead: 'bg-gray-100 text-gray-700',
  Qualified: 'bg-blue-100 text-blue-700',
  Proposal: 'bg-purple-100 text-purple-700',
  Negotiation: 'bg-amber-100 text-amber-700',
  'Closed Won': 'bg-green-100 text-green-700',
  'Closed Lost': 'bg-red-100 text-red-700',
}

export const STATUS_COLOR: Record<ContactStatus, string> = {
  Lead: 'bg-blue-100 text-blue-700',
  Prospect: 'bg-purple-100 text-purple-700',
  Customer: 'bg-green-100 text-green-700',
  Churned: 'bg-gray-100 text-gray-700',
}

export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
}

export const ACTIVITY_COLOR: Record<ActivityType, string> = {
  note: 'bg-gray-100 text-gray-600',
  call: 'bg-blue-100 text-blue-700',
  email: 'bg-teal-100 text-teal-700',
  meeting: 'bg-purple-100 text-purple-700',
}

export const LEAD_SOURCES: LeadSource[] = [
  'Website', 'LinkedIn', 'Referral', 'Cold Outreach', 'Event', 'Other',
]
export const LEAD_INGESTION_SOURCES: LeadIngestionSource[] = ['auto', 'manual']
export const LEAD_STATUSES: LeadStatus[] = [
  'Generated', 'Augmented', 'Cleaned', 'Entered', 'Prospecting', 'Qualified', 'Disqualified',
]

export const CONTACT_STATUSES: ContactStatus[] = [
  'Lead', 'Prospect', 'Customer', 'Churned',
]

export const INDUSTRIES: Industry[] = [
  'SaaS', 'Fintech', 'Healthcare', 'Retail', 'Manufacturing', 'Consulting', 'Other',
]

export const COMPANY_SIZES: CompanySize[] = [
  '1-10', '11-50', '51-200', '201-1000', '1000+',
]

export const ACTIVITY_TYPES: ActivityType[] = ['note', 'call', 'email', 'meeting']
export const TASK_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high']
