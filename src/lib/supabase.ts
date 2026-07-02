// ─────────────────────────────────────────────────────────────
// Supabase Client
// TODO: Add your Supabase project URL and anon key to .env.local:
//   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
// ─────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import type { Activity, Company, Contact, Deal, Lead, Profile, Task } from '@/types'

type CRMTable<T> = {
  Row: T
  Insert: Partial<T>
  Update: Partial<T>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      companies: CRMTable<Company>
      leads: CRMTable<Lead>
      contacts: CRMTable<Contact>
      deals: CRMTable<Deal>
      activities: CRMTable<Activity>
      tasks: CRMTable<Task>
      profiles: CRMTable<Profile>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project') &&
    !supabaseAnonKey.includes('your-anon-key'),
)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        detectSessionInUrl: true,
      },
    })
  : null

/** Origin used for Supabase email links (signup confirm, password reset). */
export function getAuthRedirectUrl(path = '/dashboard') {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  return siteUrl ? `${siteUrl}${path}` : undefined
}
