import { STAGE_PROBABILITY } from '@/types'
import type {
  Activity, Company, Contact, Deal, Lead, ProspectingSequence, SequenceTask, Task,
} from '@/types'
import {
  SEED_COMPANIES, SEED_CONTACTS, SEED_DEALS,
  SEED_ACTIVITIES, SEED_LEADS, SEED_TASKS,
} from '@/lib/seed'

export interface CRMData {
  companies: Company[]
  leads: Lead[]
  contacts: Contact[]
  deals: Deal[]
  activities: Activity[]
  tasks: Task[]
  prospectingSequences: ProspectingSequence[]
  sequenceTasks: SequenceTask[]
}

export function loadKey<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveKey<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

export function loadLocalCRMData(): CRMData {
  return {
    companies: loadKey('crm:companies', SEED_COMPANIES),
    leads: loadKey('crm:leads', SEED_LEADS),
    contacts: loadKey('crm:contacts', SEED_CONTACTS),
    deals: loadKey('crm:deals', SEED_DEALS),
    activities: loadKey('crm:activities', SEED_ACTIVITIES),
    tasks: loadKey('crm:tasks', SEED_TASKS),
    prospectingSequences: loadKey('crm:prospectingSequences', []),
    sequenceTasks: loadKey('crm:sequenceTasks', []),
  }
}

export function normalizeCompany(row: Company): Company {
  return {
    ...row,
    owner_id: row.owner_id ?? null,
    industry: row.industry ?? 'Other',
    website: row.website ?? '',
    size: row.size ?? '11-50',
    tags: row.tags ?? [],
    created_at: row.created_at ?? new Date().toISOString(),
  }
}

export function normalizeLead(row: Lead): Lead {
  return {
    ...row,
    owner_id: row.owner_id ?? null,
    title: row.title ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    company_name: row.company_name ?? '',
    website: row.website ?? '',
    source: row.source ?? 'Other',
    ingestion_source: row.ingestion_source ?? 'manual',
    status: row.status ?? 'Generated',
    notes: row.notes ?? '',
    tags: row.tags ?? [],
    interest_score: Number(row.interest_score ?? 0),
    decision_maker_score: Number(row.decision_maker_score ?? 0),
    fit_score: Number(row.fit_score ?? 0),
    overall_score: Number(row.overall_score ?? 0),
    rank_tier: row.rank_tier ?? 'low',
    signal: row.signal ?? '',
    pain_theme: row.pain_theme ?? '',
    company_id: row.company_id ?? null,
    contact_id: row.contact_id ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
  }
}

export function normalizeContact(row: Contact): Contact {
  return {
    ...row,
    owner_id: row.owner_id ?? null,
    title: row.title ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    linked_in: row.linked_in ?? '',
    lead_source: row.lead_source ?? 'Other',
    status: row.status ?? 'Lead',
    tags: row.tags ?? [],
    company_id: row.company_id ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
  }
}

export function normalizeDeal(row: Deal): Deal {
  return {
    ...row,
    owner_id: row.owner_id ?? null,
    value: Number(row.value ?? 0),
    stage: row.stage ?? 'Lead',
    probability: row.probability ?? STAGE_PROBABILITY[row.stage ?? 'Lead'],
    close_date: row.close_date ?? '',
    notes: row.notes ?? '',
    company_id: row.company_id ?? null,
    contact_id: row.contact_id ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
  }
}

export function normalizeActivity(row: Activity): Activity {
  return {
    ...row,
    owner_id: row.owner_id ?? null,
    body: row.body ?? '',
    timestamp: row.timestamp ?? new Date().toISOString(),
  }
}

export function normalizeTask(row: Task): Task {
  return {
    ...row,
    owner_id: row.owner_id ?? null,
    due_date: row.due_date ?? '',
    priority: row.priority ?? 'medium',
    status: row.status ?? 'open',
    deal_id: row.deal_id ?? null,
    contact_id: row.contact_id ?? null,
  }
}

export function normalizeProspectingSequence(row: ProspectingSequence): ProspectingSequence {
  return {
    ...row,
    owner_id: row.owner_id ?? null,
    tier: row.tier ?? 'low',
    status: row.status ?? 'active',
    start_date: row.start_date ?? new Date().toISOString().slice(0, 10),
    created_at: row.created_at ?? new Date().toISOString(),
  }
}

export function normalizeSequenceTask(row: SequenceTask): SequenceTask {
  return {
    ...row,
    owner_id: row.owner_id ?? null,
    day_number: Number(row.day_number ?? 1),
    channel: row.channel ?? 'email',
    title: row.title ?? '',
    purpose: row.purpose ?? '',
    due_date: row.due_date ?? new Date().toISOString().slice(0, 10),
    trigger_type: row.trigger_type ?? 'manual',
    status: row.status ?? 'pending',
    generated_subject: row.generated_subject ?? '',
    generated_body: row.generated_body ?? '',
    generated_script: row.generated_script ?? '',
    resend_email_id: row.resend_email_id ?? '',
    sent_at: row.sent_at ?? null,
    completed_at: row.completed_at ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
  }
}
