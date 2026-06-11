'use client'

import { useState } from 'react'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface AuthScreenProps {
  isSupabaseConfigured: boolean
  error: string | null
  onSignIn: (email: string, password: string) => Promise<unknown>
  onSignUp: (email: string, password: string, fullName: string) => Promise<unknown>
}

export function AuthScreen({ isSupabaseConfigured, error, onSignIn, onSignUp }: AuthScreenProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit() {
    setSubmitting(true)
    setMessage(null)

    try {
      if (mode === 'sign-in') {
        await onSignIn(email, password)
      } else {
        await onSignUp(email, password, fullName)
        setMessage('Account created. Check your inbox if email confirmation is enabled.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Connect Supabase</CardTitle>
            <CardDescription>
              Add your project URL and anon key to `crm/.env.local`, then restart the dev server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>`NEXT_PUBLIC_SUPABASE_URL`</p>
            <p>`NEXT_PUBLIC_SUPABASE_ANON_KEY`</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md shadow-soft">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle>{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</CardTitle>
          <CardDescription>
            Sign in to access the RidgeTheory workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === 'sign-up' && (
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
            />
          )}
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            autoComplete="email"
          />
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          />
          {(error || message) && (
            <p className={error ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
              {error ?? message}
            </p>
          )}
          <Button onClick={submit} disabled={submitting || !email || !password} className="w-full">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </Button>
          <Button
            onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
            variant="ghost"
            className="w-full"
          >
            {mode === 'sign-in' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
