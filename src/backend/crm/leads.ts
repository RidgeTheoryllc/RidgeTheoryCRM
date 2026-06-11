import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import type { Lead } from '@/types'
import { normalizeLead } from './shared'

export async function fetchLeads(): Promise<Lead[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(normalizeLead)
}

export async function createLead(data: Omit<Lead, 'id' | 'created_at'>, ownerId?: string): Promise<Lead> {
  if (supabase) {
    const { data: row, error } = await supabase
      .from('leads')
      .insert({ ...data, owner_id: ownerId })
      .select()
      .single()

    if (error) throw error
    return normalizeLead(row)
  }

  return normalizeLead({ ...data, owner_id: null, id: uid(), created_at: new Date().toISOString() })
}

export async function updateLeadRecord(id: string, data: Partial<Lead>): Promise<Lead | null> {
  if (!supabase) return null

  const { data: row, error } = await supabase
    .from('leads')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return normalizeLead(row)
}

export async function deleteLeadRecord(id: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) throw error
}
