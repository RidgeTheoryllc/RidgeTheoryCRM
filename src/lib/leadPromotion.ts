import type { Company, Contact, Lead } from '@/types'

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

function normalizeName(value?: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

export function findCompanyForLead(lead: Lead, companies: Company[]): Company | undefined {
  if (lead.company_id) {
    return companies.find((company) => company.id === lead.company_id)
  }

  const name = normalizeName(lead.company_name)
  if (!name) return undefined

  return companies.find((company) => normalizeName(company.name) === name)
}

export function findContactForLead(
  lead: Lead,
  contacts: Contact[],
  companies: Company[] = [],
): Contact | undefined {
  if (lead.contact_id) {
    const linked = contacts.find((contact) => contact.id === lead.contact_id)
    if (linked) return linked
  }

  const email = normalizeEmail(lead.email)
  if (email) {
    const byEmail = contacts.find((contact) => normalizeEmail(contact.email) === email)
    if (byEmail) return byEmail
  }

  const name = normalizeName(lead.name)
  if (!name) return undefined

  const companyKey = normalizeName(lead.company_name)
  return contacts.find((contact) => {
    if (normalizeName(contact.name) !== name) return false
    if (!companyKey) return true
    const contactCompany = companies.find((company) => company.id === contact.company_id)
    return normalizeName(contactCompany?.name) === companyKey
  })
}

/** Reuse a contact already linked to another lead record for the same person. */
export function findSiblingLeadContactId(lead: Lead, leads: Lead[]): string | null {
  const email = normalizeEmail(lead.email)
  if (email) {
    const sibling = leads.find((item) =>
      item.id !== lead.id &&
      item.contact_id &&
      normalizeEmail(item.email) === email,
    )
    if (sibling?.contact_id) return sibling.contact_id
  }

  const name = normalizeName(lead.name)
  const companyKey = normalizeName(lead.company_name)
  if (!name) return null

  const sibling = leads.find((item) =>
    item.id !== lead.id &&
    item.contact_id &&
    normalizeName(item.name) === name &&
    (!companyKey || normalizeName(item.company_name) === companyKey),
  )

  return sibling?.contact_id ?? null
}

export function contactFromLead(lead: Lead, companyId: string | null): Omit<Contact, 'id' | 'created_at'> {
  return {
    name: lead.name,
    title: lead.title ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    linked_in: '',
    lead_source: lead.source,
    status: 'Prospect',
    tags: [...(lead.tags ?? [])],
    company_id: companyId,
  }
}

export function companyFromLead(lead: Lead): Omit<Company, 'id' | 'created_at'> {
  return {
    name: lead.company_name.trim(),
    industry: 'Other',
    website: lead.website ?? '',
    size: '11-50',
    tags: [],
  }
}
