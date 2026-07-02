'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase, getAuthRedirectUrl } from '@/lib/supabase'
import type { AppRole, Profile } from '@/types'

const DEMO_PROFILE: Profile = {
  id: 'local-demo-admin',
  email: 'demo@salescrm.local',
  full_name: 'Demo Admin',
  role: 'admin',
  created_at: new Date().toISOString(),
}

let cachedProfile: Profile | null = supabase ? null : DEMO_PROFILE
let cachedUser: User | null = null

export function useAuth() {
  const [user, setUser] = useState<User | null>(cachedUser)
  const [profile, setProfile] = useState<Profile | null>(cachedProfile)
  const [loading, setLoading] = useState(supabase ? !cachedProfile : false)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return null

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError) throw profileError
    return data as Profile
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadSession() {
      setLoading(true)
      setError(null)

      if (!supabase) {
        cachedUser = null
        cachedProfile = DEMO_PROFILE
        if (!cancelled) {
          setUser(cachedUser)
          setProfile(cachedProfile)
        }
        setLoading(false)
        return
      }

      try {
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        const sessionUser = data.session?.user ?? null
        const sessionProfile = sessionUser ? await loadProfile(sessionUser.id) : null

        if (!cancelled) {
          cachedUser = sessionUser
          cachedProfile = sessionProfile
          setUser(sessionUser)
          setProfile(sessionProfile)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load session')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadSession()

    if (!supabase) {
      return () => {
        cancelled = true
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null
      cachedUser = sessionUser
      setUser(sessionUser)
      setLoading(true)
      setError(null)

      if (!sessionUser) {
        cachedProfile = null
        setProfile(null)
        setLoading(false)
        return
      }

      loadProfile(sessionUser.id)
        .then((nextProfile) => {
          cachedProfile = nextProfile
          setProfile(nextProfile)
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load profile'))
        .finally(() => setLoading(false))
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured')
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message)
      throw signInError
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (!supabase) throw new Error('Supabase is not configured')
    setError(null)
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl('/dashboard'),
        data: {
          full_name: fullName,
        },
      },
    })
    if (signUpError) {
      setError(signUpError.message)
      throw signUpError
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) {
      cachedUser = null
      cachedProfile = DEMO_PROFILE
      setProfile(DEMO_PROFILE)
      return
    }
    await supabase.auth.signOut()
    cachedUser = null
    cachedProfile = null
    setUser(null)
    setProfile(null)
  }, [])

  const permissions = useMemo(() => {
    const role: AppRole | null = profile?.role ?? null
    return {
      role,
      isAdmin: role === 'admin',
      isManager: role === 'manager',
      canManageUsers: role === 'admin',
      canImportExport: role === 'admin' || role === 'manager',
      canManageAllRecords: role === 'admin' || role === 'manager',
      canManageOwnRecords: role === 'sales',
    }
  }, [profile?.role])

  return {
    isSupabaseConfigured,
    user,
    profile,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    permissions,
  }
}
