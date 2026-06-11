import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import type { Deal } from '@/types'
import { normalizeDeal } from './shared'

export async function fetchDeals(): Promise<Deal[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(normalizeDeal)
}

export async function createDeal(data: Omit<Deal, 'id' | 'created_at'>, ownerId?: string): Promise<Deal> {
  if (supabase) {
    const { data: row, error } = await supabase
      .from('deals')
      .insert({ ...data, owner_id: ownerId })
      .select()
      .single()

    if (error) throw error
    return normalizeDeal(row)
  }

  return normalizeDeal({ ...data, owner_id: null, id: uid(), created_at: new Date().toISOString() })
}

export async function updateDealRecord(id: string, data: Partial<Deal>): Promise<Deal | null> {
  if (!supabase) return null

  const { data: row, error } = await supabase
    .from('deals')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return normalizeDeal(row)
}

export async function deleteDealRecord(id: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.from('deals').delete().eq('id', id)
  if (error) throw error
}
