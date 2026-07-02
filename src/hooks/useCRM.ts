'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  createActivity, createCompany, createContact, createDeal, createTask,
  createLead,
  createProspectingSequence, createSequenceTask,
  deleteCompanyRecord, deleteContactRecord, deleteDealRecord, deleteTaskRecord,
  deleteLeadRecord,
  fetchCRMData, loadLocalCRMData, loadKey, saveKey,
  updateSequenceTaskRecord,
  updateCompanyRecord, updateContactRecord, updateDealRecord, updateTaskRecord,
  updateLeadRecord,
} from '@/backend/crm'
import type { CRMData } from '@/backend/crm'
import type {
  Company, Contact, Deal, Activity, Lead, Task, DealStage, Profile,
  ProspectingSequence, SequenceTask, SequenceTaskStatus,
} from '@/types'
import { STAGE_PROBABILITY } from '@/types'
import { scoreLead } from '@/lib/leadScoring'
import { advanceLeadStatus, resolveNewLeadStatus } from '@/lib/leadStatus'
import { statusAfterEmailCleansing, verifyLeadEmail } from '@/lib/emailCleansing'
import { buildSequenceTask, getSequenceTemplate } from '@/lib/prospecting'
import {
  companyFromLead, contactFromLead, findCompanyForLead, findContactForLead,
  findSiblingLeadContactId,
} from '@/lib/leadPromotion'

function isTerminalTaskStatus(status: SequenceTaskStatus) {
  return status === 'sent' || status === 'done' || status === 'skipped'
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

// Module-level cache — populated client-side only, never on the server.
let cachedCRMData: CRMData | null = null

function applyData(
  data: CRMData,
  setters: {
    setCompanies: (v: Company[]) => void
    setLeads: (v: Lead[]) => void
    setContacts: (v: Contact[]) => void
    setDeals: (v: Deal[]) => void
    setActivities: (v: Activity[]) => void
    setTasks: (v: Task[]) => void
    setProspectingSequences: (v: ProspectingSequence[]) => void
    setSequenceTasks: (v: SequenceTask[]) => void
  },
) {
  cachedCRMData = data
  setters.setCompanies(data.companies)
  setters.setLeads(data.leads)
  setters.setContacts(data.contacts)
  setters.setDeals(data.deals)
  setters.setActivities(data.activities)
  setters.setTasks(data.tasks)
  setters.setProspectingSequences(data.prospectingSequences)
  setters.setSequenceTasks(data.sequenceTasks)
}

export function useCRM(profile?: Profile | null) {
  // Always start with empty arrays so SSR and client initial render match.
  const [companies, setCompanies] = useState<Company[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [prospectingSequences, setProspectingSequences] = useState<ProspectingSequence[]>([])
  const [sequenceTasks, setSequenceTasks] = useState<SequenceTask[]>([])
  // Start ready=true so we never block render with a loading gate.
  const [ready, setReady] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const ownerId = profile?.id

  const setters = {
    setCompanies, setLeads, setContacts, setDeals, setActivities, setTasks,
    setProspectingSequences, setSequenceTasks,
  }

  useEffect(() => {
    let cancelled = false

    async function loadCRM() {
      setError(null)

      if (supabase && !profile) {
        if (!cancelled) {
          applyData({
            companies: [], leads: [], contacts: [], deals: [], activities: [], tasks: [],
            prospectingSequences: [], sequenceTasks: [],
          }, setters)
          setReady(true)
        }
        return
      }

      if (!supabase) {
        // Sync read from localStorage — populate immediately from cache or storage.
        const data = cachedCRMData ?? loadLocalCRMData()
        if (!cancelled) applyData(data, setters)
        return
      }

      // Supabase mode: show cached data while fetching fresh copy.
      if (cachedCRMData && !cancelled) applyData(cachedCRMData, setters)

      try {
        const data = await fetchCRMData()
        if (!cancelled) applyData(data, setters)
      } catch (err: unknown) {
        console.error('Failed to load CRM data from Supabase:', err)
        const data = loadLocalCRMData()
        if (!cancelled) {
          applyData(data, setters)
          setError(err instanceof Error ? err.message : 'Failed to load CRM data')
        }
      }
    }

    loadCRM()

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  // ── Companies ──────────────────────────────────────────────
  const addCompany = useCallback(async (data: Omit<Company, 'id' | 'created_at'>) => {
    const record = await createCompany(data, ownerId)
    setCompanies((prev) => {
      const next = [...prev, record]
      saveKey('crm:companies', next)
      return next
    })
    return record
  }, [ownerId])

  const updateCompany = useCallback(async (id: string, data: Partial<Company>) => {
    const record = await updateCompanyRecord(id, data)
    setCompanies((prev) => {
      const next = prev.map((c) => (c.id === id ? record ?? { ...c, ...data } : c))
      saveKey('crm:companies', next)
      return next
    })
  }, [])

  const deleteCompany = useCallback(async (id: string) => {
    await deleteCompanyRecord(id)

    setCompanies((prev) => {
      const next = prev.filter((c) => c.id !== id)
      saveKey('crm:companies', next)
      return next
    })
    setContacts((prev) => {
      const next = prev.map((c) => (c.company_id === id ? { ...c, company_id: null } : c))
      saveKey('crm:contacts', next)
      return next
    })
    setLeads((prev) => {
      const next = prev.map((l) => (l.company_id === id ? { ...l, company_id: null } : l))
      saveKey('crm:leads', next)
      return next
    })
    setDeals((prev) => {
      const next = prev.map((d) => (d.company_id === id ? { ...d, company_id: null } : d))
      saveKey('crm:deals', next)
      return next
    })
  }, [])

  // ── Leads ──────────────────────────────────────────────────
  const addLead = useCallback(async (data: Omit<Lead, 'id' | 'created_at'>) => {
    let status = resolveNewLeadStatus(data.status, data.ingestion_source)
    let enriched: Omit<Lead, 'id' | 'created_at'> = {
      ...data,
      status,
      segment: data.segment ?? 'raw',
    }

    const email = data.email?.trim()
    if (email) {
      try {
        const cleansing = await verifyLeadEmail(email)
        if (cleansing) {
          status = statusAfterEmailCleansing(status, cleansing.valid)
          enriched = {
            ...enriched,
            status,
            email_status: cleansing.status,
            email_valid: cleansing.valid,
            email_validated_at: cleansing.validated_at,
          }
        }
      } catch (err) {
        console.error('Email cleansing failed:', err)
      }
    }

    const scored = { ...enriched, ...scoreLead({ ...enriched, status } as Lead) }
    const record = await createLead(scored, ownerId)
    setLeads((prev) => {
      const next = [...prev, record]
      saveKey('crm:leads', next)
      return next
    })
    return record
  }, [ownerId])

  const updateLead = useCallback(async (id: string, data: Partial<Lead>) => {
    const record = await updateLeadRecord(id, data)
    setLeads((prev) => {
      const next = prev.map((l) => (l.id === id ? record ?? { ...l, ...data } : l))
      saveKey('crm:leads', next)
      return next
    })
  }, [])

  const rescoreLead = useCallback(async (id: string) => {
    const lead = leads.find((l) => l.id === id)
    if (!lead) return null
    const score = scoreLead(lead)
    await updateLead(id, score)
    return score
  }, [leads, updateLead])

  const reverifyLeadEmail = useCallback(async (id: string) => {
    const lead = leads.find((l) => l.id === id)
    if (!lead?.email?.trim()) return null

    const cleansing = await verifyLeadEmail(lead.email.trim())
    if (!cleansing) return null

    const status = statusAfterEmailCleansing(lead.status, cleansing.valid)
    await updateLead(id, {
      status,
      email_status: cleansing.status,
      email_valid: cleansing.valid,
      email_validated_at: cleansing.validated_at,
    })
    return cleansing
  }, [leads, updateLead])

  const enrollLeadInSequence = useCallback(async (id: string) => {
    const lead = leads.find((l) => l.id === id)
    if (!lead) return null

    const score = scoreLead(lead)
    const prospectingStatus = advanceLeadStatus(lead.status, 'Prospecting')
    const scoredLead = { ...lead, ...score, status: prospectingStatus }

    const existing = prospectingSequences.find((sequence) =>
      sequence.lead_id === id && sequence.status === 'active')
    if (existing) return existing

    const startDate = new Date().toISOString().slice(0, 10)
    const sequence = await createProspectingSequence({
      lead_id: id,
      tier: score.rank_tier,
      status: 'active',
      start_date: startDate,
    }, ownerId)

    setProspectingSequences((prev) => {
      const next = [...prev, sequence]
      saveKey('crm:prospectingSequences', next)
      return next
    })

    const createdTasks: SequenceTask[] = []
    for (const step of getSequenceTemplate(score.rank_tier)) {
      const task = await createSequenceTask(
        buildSequenceTask(scoredLead, sequence.id, startDate, step),
        ownerId,
      )
      createdTasks.push(task)
    }

    setSequenceTasks((prev) => {
      const next = [...prev, ...createdTasks]
      saveKey('crm:sequenceTasks', next)
      return next
    })

    await updateLead(id, { status: prospectingStatus, ...score })
    return sequence
  }, [leads, ownerId, prospectingSequences, updateLead])

  const deleteLead = useCallback(async (id: string) => {
    await deleteLeadRecord(id)
    setLeads((prev) => {
      const next = prev.filter((l) => l.id !== id)
      saveKey('crm:leads', next)
      return next
    })
  }, [])

  // ── Contacts ───────────────────────────────────────────────
  const addContact = useCallback(async (data: Omit<Contact, 'id' | 'created_at'>) => {
    const record = await createContact(data, ownerId)
    setContacts((prev) => {
      const next = [...prev, record]
      saveKey('crm:contacts', next)
      return next
    })
    return record
  }, [ownerId])

  const updateContact = useCallback(async (id: string, data: Partial<Contact>) => {
    const record = await updateContactRecord(id, data)
    setContacts((prev) => {
      const next = prev.map((c) => (c.id === id ? record ?? { ...c, ...data } : c))
      saveKey('crm:contacts', next)
      return next
    })
  }, [])

  const deleteContact = useCallback(async (id: string) => {
    await deleteContactRecord(id)

    setContacts((prev) => {
      const next = prev.filter((c) => c.id !== id)
      saveKey('crm:contacts', next)
      return next
    })
    setDeals((prev) => {
      const next = prev.map((d) => (d.contact_id === id ? { ...d, contact_id: null } : d))
      saveKey('crm:deals', next)
      return next
    })
    setLeads((prev) => {
      const next = prev.map((l) => (l.contact_id === id ? { ...l, contact_id: null } : l))
      saveKey('crm:leads', next)
      return next
    })
    setTasks((prev) => {
      const next = prev.map((t) => (t.contact_id === id ? { ...t, contact_id: null } : t))
      saveKey('crm:tasks', next)
      return next
    })
  }, [])

  const promoteLeadToWarm = useCallback(async (id: string) => {
    const lead = leads.find((l) => l.id === id)
    if (!lead) return null

    if (lead.segment === 'warm' && lead.contact_id) {
      return {
        segment: 'warm' as const,
        responded_at: lead.responded_at ?? new Date().toISOString(),
        contact_id: lead.contact_id,
      }
    }

    const freshContacts = loadKey<Contact[]>('crm:contacts', contacts)
    const freshCompanies = loadKey<Company[]>('crm:companies', companies)
    const respondedAt = new Date().toISOString()
    let companyId = lead.company_id

    if (!companyId && lead.company_name?.trim()) {
      const existingCompany = findCompanyForLead(lead, freshCompanies)
      if (existingCompany) {
        companyId = existingCompany.id
      } else {
        const company = await addCompany(companyFromLead(lead))
        companyId = company.id
      }
    }

    const siblingContactId = findSiblingLeadContactId(lead, leads)
    let contactId = lead.contact_id ?? siblingContactId
    const existingContact = contactId
      ? freshContacts.find((contact) => contact.id === contactId)
      : findContactForLead(lead, freshContacts, freshCompanies)

    if (existingContact) {
      contactId = existingContact.id
      await updateContact(existingContact.id, {
        phone: lead.phone || existingContact.phone,
        title: lead.title || existingContact.title,
        company_id: companyId ?? existingContact.company_id,
        status: existingContact.status === 'Lead' ? 'Prospect' : existingContact.status,
      })
    } else {
      const contact = await addContact(contactFromLead(lead, companyId))
      contactId = contact.id
    }

    await updateLead(id, {
      segment: 'warm',
      responded_at: respondedAt,
      company_id: companyId,
      contact_id: contactId,
    })

    return {
      segment: 'warm' as const,
      responded_at: respondedAt,
      contact_id: contactId,
    }
  }, [leads, companies, contacts, addCompany, addContact, updateContact, updateLead])

  // ── Deals ──────────────────────────────────────────────────
  const addDeal = useCallback(async (data: Omit<Deal, 'id' | 'created_at'>) => {
    const record = await createDeal(data, ownerId)
    setDeals((prev) => {
      const next = [...prev, record]
      saveKey('crm:deals', next)
      return next
    })
    return record
  }, [ownerId])

  const updateDeal = useCallback(async (id: string, data: Partial<Deal>) => {
    const record = await updateDealRecord(id, data)
    setDeals((prev) => {
      const next = prev.map((d) => (d.id === id ? record ?? { ...d, ...data } : d))
      saveKey('crm:deals', next)
      return next
    })
  }, [])

  const moveDealStage = useCallback(async (id: string, stage: DealStage) => {
    await updateDeal(id, { stage, probability: STAGE_PROBABILITY[stage] })
  }, [updateDeal])

  const deleteDeal = useCallback(async (id: string) => {
    await deleteDealRecord(id)

    setDeals((prev) => {
      const next = prev.filter((d) => d.id !== id)
      saveKey('crm:deals', next)
      return next
    })
    setActivities((prev) => {
      const next = prev.filter((a) => a.deal_id !== id)
      saveKey('crm:activities', next)
      return next
    })
    setTasks((prev) => {
      const next = prev.map((t) => (t.deal_id === id ? { ...t, deal_id: null } : t))
      saveKey('crm:tasks', next)
      return next
    })
  }, [])

  // ── Activities ─────────────────────────────────────────────
  const addActivity = useCallback(async (data: Omit<Activity, 'id' | 'timestamp'>) => {
    const record = await createActivity(data, ownerId)
    setActivities((prev) => {
      const next = [...prev, record]
      saveKey('crm:activities', next)
      return next
    })
    return record
  }, [ownerId])

  // ── Tasks ──────────────────────────────────────────────────
  const addTask = useCallback(async (data: Omit<Task, 'id'>) => {
    const record = await createTask(data, ownerId)
    setTasks((prev) => {
      const next = [...prev, record]
      saveKey('crm:tasks', next)
      return next
    })
    return record
  }, [ownerId])

  const updateTask = useCallback(async (id: string, data: Partial<Task>) => {
    const record = await updateTaskRecord(id, data)
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? record ?? { ...t, ...data } : t))
      saveKey('crm:tasks', next)
      return next
    })
  }, [])

  const deleteTask = useCallback(async (id: string) => {
    await deleteTaskRecord(id)

    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== id)
      saveKey('crm:tasks', next)
      return next
    })
  }, [])

  const updateSequenceTask = useCallback(async (id: string, data: Partial<SequenceTask>) => {
    const record = await updateSequenceTaskRecord(id, data)
    const existing = sequenceTasks.find((task) => task.id === id)
    if (!existing) return

    const updated = record ?? { ...existing, ...data }
    const nextTasks = sequenceTasks.map((task) => (task.id === id ? updated : task))

    setSequenceTasks(() => {
      saveKey('crm:sequenceTasks', nextTasks)
      return nextTasks
    })

    if (!isTerminalTaskStatus(updated.status)) return

    const sequenceId = updated.sequence_id
    const sequenceTasksForSeq = nextTasks.filter((task) => task.sequence_id === sequenceId)
    const allComplete = sequenceTasksForSeq.length > 0
      && sequenceTasksForSeq.every((task) => isTerminalTaskStatus(task.status))

    if (!allComplete) return

    const sequence = prospectingSequences.find((item) => item.id === sequenceId)
    if (!sequence || sequence.status !== 'active') return

    setProspectingSequences((prev) => {
      const next = prev.map((item) =>
        item.id === sequenceId ? { ...item, status: 'completed' as const } : item,
      )
      saveKey('crm:prospectingSequences', next)
      return next
    })

    const lead = leads.find((item) => item.id === sequence.lead_id)
    if (lead) {
      await updateLead(sequence.lead_id, {
        status: advanceLeadStatus(lead.status, 'Qualified'),
      })
    }
  }, [leads, prospectingSequences, sequenceTasks, updateLead])

  return {
    companies, leads, contacts, deals, activities, tasks,
    prospectingSequences, sequenceTasks,
    ready, error,
    addCompany, updateCompany, deleteCompany,
    addLead, updateLead, deleteLead, rescoreLead, promoteLeadToWarm, reverifyLeadEmail, enrollLeadInSequence,
    addContact, updateContact, deleteContact,
    addDeal, updateDeal, moveDealStage, deleteDeal,
    addActivity,
    addTask, updateTask, deleteTask,
    updateSequenceTask,
  }
}

export type CRMStore = ReturnType<typeof useCRM>
