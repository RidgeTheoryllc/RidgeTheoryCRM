import { fetchActivities } from './activities'
import { fetchCompanies } from './companies'
import { fetchContacts } from './contacts'
import { fetchDeals } from './deals'
import { fetchLeads } from './leads'
import { fetchProspectingSequences, fetchSequenceTasks } from './sequences'
import { fetchTasks } from './tasks'
import type { CRMData } from './shared'

export async function fetchCRMData(): Promise<CRMData> {
  const [
    companies, leads, contacts, deals, activities, tasks,
    prospectingSequences, sequenceTasks,
  ] = await Promise.all([
    fetchCompanies(),
    fetchLeads(),
    fetchContacts(),
    fetchDeals(),
    fetchActivities(),
    fetchTasks(),
    fetchProspectingSequences(),
    fetchSequenceTasks(),
  ])

  return {
    companies, leads, contacts, deals, activities, tasks,
    prospectingSequences, sequenceTasks,
  }
}

export * from './activities'
export * from './companies'
export * from './contacts'
export * from './deals'
export * from './leads'
export * from './shared'
export * from './sequences'
export * from './tasks'
