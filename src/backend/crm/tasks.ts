import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import type { Task } from '@/types'
import { normalizeTask } from './shared'

export async function fetchTasks(): Promise<Task[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) throw error
  return (data ?? []).map(normalizeTask)
}

export async function createTask(data: Omit<Task, 'id'>, ownerId?: string): Promise<Task> {
  if (supabase) {
    const { data: row, error } = await supabase
      .from('tasks')
      .insert({ ...data, owner_id: ownerId })
      .select()
      .single()

    if (error) throw error
    return normalizeTask(row)
  }

  return normalizeTask({ ...data, owner_id: null, id: uid() })
}

export async function updateTaskRecord(id: string, data: Partial<Task>): Promise<Task | null> {
  if (!supabase) return null

  const { data: row, error } = await supabase
    .from('tasks')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return normalizeTask(row)
}

export async function deleteTaskRecord(id: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}
