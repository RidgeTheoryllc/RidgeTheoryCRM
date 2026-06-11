import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import type { Company } from '@/types'
import { normalizeCompany } from './shared'

export async function fetchCompanies(): Promise<Company[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(normalizeCompany)
}

export async function createCompany(data: Omit<Company, 'id' | 'created_at'>, ownerId?: string): Promise<Company> {
  if (supabase) {
    const { data: row, error } = await supabase
      .from('companies')
      .insert({ ...data, owner_id: ownerId })
      .select()
      .single()

    if (error) throw error
    return normalizeCompany(row)
  }

  return normalizeCompany({ ...data, owner_id: null, id: uid(), created_at: new Date().toISOString() })
}

export async function updateCompanyRecord(id: string, data: Partial<Company>): Promise<Company | null> {
  if (!supabase) return null

  const { data: row, error } = await supabase
    .from('companies')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return normalizeCompany(row)
}

export async function deleteCompanyRecord(id: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.from('companies').delete().eq('id', id)
  if (error) throw error
}
