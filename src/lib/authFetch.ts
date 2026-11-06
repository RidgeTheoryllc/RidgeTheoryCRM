// Browser-side: fetch() that sends the Supabase session so API routes know who is calling.

import { supabase } from '@/lib/supabase'

export async function authFetch(input: string, init: RequestInit = {}) {
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
  const token = data.session?.access_token
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(input, { ...init, headers })
}
