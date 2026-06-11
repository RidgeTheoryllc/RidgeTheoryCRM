import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import type { Activity } from '@/types'
import { normalizeActivity } from './shared'

export async function fetchActivities(): Promise<Activity[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('timestamp', { ascending: false })

  if (error) throw error
  return (data ?? []).map(normalizeActivity)
}

export async function createActivity(
  data: Omit<Activity, 'id' | 'timestamp'>,
  ownerId?: string,
): Promise<Activity> {
  if (supabase) {
    const { data: row, error } = await supabase
      .from('activities')
      .insert({ ...data, owner_id: ownerId })
      .select()
      .single()

    if (error) throw error
    return normalizeActivity(row)
  }

  return normalizeActivity({ ...data, owner_id: null, id: uid(), timestamp: new Date().toISOString() })
}
