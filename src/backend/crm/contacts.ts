import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import type { Contact } from '@/types'
import { normalizeContact } from './shared'

export async function fetchContacts(): Promise<Contact[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(normalizeContact)
}

export async function createContact(data: Omit<Contact, 'id' | 'created_at'>, ownerId?: string): Promise<Contact> {
  if (supabase) {
    const { data: row, error } = await supabase
      .from('contacts')
      .insert({ ...data, owner_id: ownerId })
      .select()
      .single()

    if (error) throw error
    return normalizeContact(row)
  }

  return normalizeContact({ ...data, owner_id: null, id: uid(), created_at: new Date().toISOString() })
}

export async function updateContactRecord(id: string, data: Partial<Contact>): Promise<Contact | null> {
  if (!supabase) return null

  const { data: row, error } = await supabase
    .from('contacts')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return normalizeContact(row)
}

export async function deleteContactRecord(id: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) throw error
}
