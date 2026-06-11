import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import type { ProspectingSequence, SequenceTask } from '@/types'
import { normalizeProspectingSequence, normalizeSequenceTask } from './shared'

export async function fetchProspectingSequences(): Promise<ProspectingSequence[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('prospecting_sequences')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(normalizeProspectingSequence)
}

export async function fetchSequenceTasks(): Promise<SequenceTask[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('sequence_tasks')
    .select('*')
    .order('due_date', { ascending: true })

  if (error) throw error
  return (data ?? []).map(normalizeSequenceTask)
}

export async function createProspectingSequence(
  data: Omit<ProspectingSequence, 'id' | 'created_at'>,
  ownerId?: string,
): Promise<ProspectingSequence> {
  if (supabase) {
    const { data: row, error } = await supabase
      .from('prospecting_sequences')
      .insert({ ...data, owner_id: ownerId })
      .select()
      .single()

    if (error) throw error
    return normalizeProspectingSequence(row)
  }

  return normalizeProspectingSequence({
    ...data,
    owner_id: null,
    id: uid(),
    created_at: new Date().toISOString(),
  })
}

export async function createSequenceTask(
  data: Omit<SequenceTask, 'id' | 'created_at'>,
  ownerId?: string,
): Promise<SequenceTask> {
  if (supabase) {
    const { data: row, error } = await supabase
      .from('sequence_tasks')
      .insert({ ...data, owner_id: ownerId })
      .select()
      .single()

    if (error) throw error
    return normalizeSequenceTask(row)
  }

  return normalizeSequenceTask({
    ...data,
    owner_id: null,
    id: uid(),
    created_at: new Date().toISOString(),
  })
}

export async function updateSequenceTaskRecord(
  id: string,
  data: Partial<SequenceTask>,
): Promise<SequenceTask | null> {
  if (!supabase) return null

  const { data: row, error } = await supabase
    .from('sequence_tasks')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return normalizeSequenceTask(row)
}
