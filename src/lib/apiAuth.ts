// Server-only: resolves the signed-in user on API routes that spend money or send email.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

/** Resolves the signed-in user from the `Authorization: Bearer <access token>` header. */
export async function getRequestUserId(request: Request): Promise<string | null> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!token) return null
  const supabase = getSupabaseAdmin()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

/**
 * Returns a 401 response unless the request comes from a signed-in user.
 * Local demo mode (no Supabase, not production) has no sessions, so it is allowed through;
 * a production deploy without Supabase is refused rather than left open.
 */
export async function requireApiUser(request: Request): Promise<NextResponse | null> {
  if (!getSupabaseAdmin()) {
    if (process.env.NODE_ENV !== 'production') return null
    return NextResponse.json(
      { error: 'Server auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' },
      { status: 500 },
    )
  }
  const userId = await getRequestUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  return null
}
