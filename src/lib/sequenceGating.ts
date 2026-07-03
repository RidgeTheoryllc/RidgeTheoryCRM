import type { SupabaseClient } from '@supabase/supabase-js'
import type { Company, Contact, Lead } from '@/types'
import {
  companyFromLead,
  contactFromLead,
  findCompanyForLead,
  findContactForLead,
  findSiblingLeadContactId,
} from '@/lib/leadPromotion'

export async function promoteLeadToWarmServer(
  supabase: SupabaseClient,
  leadId: string,
): Promise<void> {
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle()

  if (leadError || !lead) {
    console.error('promoteLeadToWarmServer: lead not found', leadId)
    return
  }

  const typedLead = lead as Lead
  if (typedLead.segment === 'warm' && typedLead.contact_id) return

  const respondedAt = new Date().toISOString()

  const [{ data: companies }, { data: contacts }, { data: siblingLeads }] = await Promise.all([
    supabase.from('companies').select('*'),
    supabase.from('contacts').select('*'),
    supabase.from('leads').select('id, email, name, company_name, contact_id'),
  ])

  const freshCompanies = (companies ?? []) as Company[]
  const freshContacts = (contacts ?? []) as Contact[]
  const allLeads = (siblingLeads ?? []) as Lead[]

  let companyId = typedLead.company_id

  if (!companyId && typedLead.company_name?.trim()) {
    const existingCompany = findCompanyForLead(typedLead, freshCompanies)
    if (existingCompany) {
      companyId = existingCompany.id
    } else {
      const companyPayload = companyFromLead(typedLead)
      const { data: created } = await supabase
        .from('companies')
        .insert(companyPayload)
        .select('id')
        .single()
      companyId = created?.id ?? null
    }
  }

  const siblingContactId = findSiblingLeadContactId(typedLead, allLeads)
  let contactId = typedLead.contact_id ?? siblingContactId
  const existingContact = contactId
    ? freshContacts.find((contact) => contact.id === contactId)
    : findContactForLead(typedLead, freshContacts, freshCompanies)

  if (existingContact) {
    contactId = existingContact.id
    await supabase
      .from('contacts')
      .update({
        phone: typedLead.phone || existingContact.phone,
        title: typedLead.title || existingContact.title,
        company_id: companyId ?? existingContact.company_id,
        status: existingContact.status === 'Lead' ? 'Prospect' : existingContact.status,
      })
      .eq('id', existingContact.id)
  } else {
    const { data: created } = await supabase
      .from('contacts')
      .insert(contactFromLead(typedLead, companyId))
      .select('id')
      .single()
    contactId = created?.id ?? null
  }

  await supabase
    .from('leads')
    .update({
      segment: 'warm',
      responded_at: respondedAt,
      company_id: companyId,
      contact_id: contactId,
    })
    .eq('id', leadId)
}

interface GatingTask {
  id: string
  lead_id: string
  sequence_id: string
  day_number: number
  channel: string
  status: string
  opened_at?: string | null
  clicked_at?: string | null
}

export async function handleEngagementGate(
  supabase: SupabaseClient,
  task: GatingTask,
  eventAt: string,
  viaClick = false,
): Promise<void> {
  if (task.channel !== 'email') return

  const isFirstPass = viaClick ? !task.clicked_at : !task.opened_at
  if (!isFirstPass) return

  const { data: sequenceTasks, error } = await supabase
    .from('sequence_tasks')
    .select('id, day_number, channel, status')
    .eq('sequence_id', task.sequence_id)
    .order('day_number', { ascending: true })

  if (error || !sequenceTasks?.length) return

  const emailTasks = sequenceTasks
    .filter((row) => row.channel === 'email')
    .sort((a, b) => a.day_number - b.day_number)

  const emailIndex = emailTasks.findIndex((row) => row.id === task.id)
  if (emailIndex < 0) return

  const today = eventAt.slice(0, 10)

  if (emailIndex === 0) {
    const email2 = emailTasks[1]
    if (email2?.status === 'locked') {
      await supabase
        .from('sequence_tasks')
        .update({ status: 'pending', due_date: today })
        .eq('id', email2.id)
    }
    return
  }

  if (emailIndex === 1) {
    const lockedTasks = sequenceTasks.filter((row) => row.status === 'locked')
    for (const locked of lockedTasks) {
      await supabase
        .from('sequence_tasks')
        .update({ status: 'pending', due_date: today })
        .eq('id', locked.id)
    }

    await promoteLeadToWarmServer(supabase, task.lead_id)

    await supabase
      .from('prospecting_sequences')
      .update({ status: 'active' })
      .eq('id', task.sequence_id)
  }
}

export async function filterLeadAfterBounce(
  supabase: SupabaseClient,
  leadId: string,
  sequenceId: string,
): Promise<void> {
  await supabase
    .from('sequence_tasks')
    .update({ status: 'skipped' })
    .eq('sequence_id', sequenceId)
    .eq('status', 'locked')

  await supabase
    .from('sequence_tasks')
    .update({ status: 'skipped' })
    .eq('sequence_id', sequenceId)
    .eq('status', 'pending')

  await supabase
    .from('prospecting_sequences')
    .update({ status: 'completed' })
    .eq('id', sequenceId)

  await supabase
    .from('leads')
    .update({ status: 'Disqualified' })
    .eq('id', leadId)
}
