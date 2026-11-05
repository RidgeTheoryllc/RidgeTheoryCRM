'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import type { CRMStore } from '@/hooks/useCRM'
import { Badge } from '@/components/ui/atoms'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { dialerJson } from '@/lib/dialer/client'
import { getDidWarmupCap } from '@/lib/dialer/didEngine'
import { CALL_RESULT_LABEL, type CallLogRecord, type DidRecord, type DidStatus } from '@/lib/dialer/types'
import { isSupabaseConfigured } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const STATUS_COLOR: Record<DidStatus, string> = {
  active: 'bg-green-100 text-green-700',
  cooldown: 'bg-amber-100 text-amber-700',
  retired: 'bg-slate-100 text-slate-600',
}

function spamColor(score: number) {
  if (score >= 80) return 'text-red-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-green-700'
}

export function Dialer({ crm }: { crm: CRMStore }) {
  const [dids, setDids] = useState<DidRecord[]>([])
  const [logs, setLogs] = useState<CallLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [newDid, setNewDid] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [didRows, logRows] = await Promise.all([
        dialerJson<DidRecord[]>('/api/dialer/did-pool'),
        dialerJson<CallLogRecord[]>('/api/dialer/call-logs'),
      ])
      setDids(didRows)
      setLogs(logRows)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load the dialer.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isSupabaseConfigured) void load()
    else setLoading(false)
  }, [load])

  const leadNames = useMemo(() => new Map(crm.leads.map((l) => [l.id, l.name])), [crm.leads])
  const today = new Date().toDateString()
  const todayLogs = logs.filter((l) => new Date(l.timestamp).toDateString() === today)
  const answeredToday = todayLogs.filter((l) => l.result === 'answered').length

  async function run(key: string, action: () => Promise<unknown>, success?: string) {
    setBusy(key)
    setMessage(null)
    try {
      await action()
      if (success) setMessage(success)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setBusy(null)
    }
  }

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-muted-foreground">Configure Supabase to use the dialer.</p>
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dialer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Caller IDs rotate per call — local area codes first, then answer rate, spam risk, and daily volume.
        </p>
        {message && <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">{message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Calls today', value: todayLogs.length },
          { label: 'Answered today', value: answeredToday },
          { label: 'Answer rate today', value: `${todayLogs.length ? Math.round((answeredToday / todayLogs.length) * 100) : 0}%` },
          { label: 'Active caller IDs', value: dids.filter((d) => d.status === 'active').length },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2 className="text-lg font-semibold">Caller ID pool</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Add Twilio numbers you own. New numbers warm up (50 calls/day, rising to 100 by day 4).
            </p>
          </div>

          <form
            className="flex max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!newDid.trim()) return
              void run('add', () =>
                dialerJson('/api/dialer/did-pool', { method: 'POST', body: JSON.stringify({ did: newDid }) })
                  .then(() => setNewDid('')),
              'Number added.')
            }}
          >
            <Input value={newDid} onChange={(e) => setNewDid(e.target.value)} placeholder="+1 (424) 555-0100" className="h-9" />
            <Button type="submit" size="sm" className="h-9" disabled={busy === 'add'}>
              {busy === 'add' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add
            </Button>
          </form>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : dids.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              No caller IDs yet. Add at least one Twilio number to start calling.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Today / cap</TableHead>
                    <TableHead className="text-right">Answer rate</TableHead>
                    <TableHead className="text-right">Spam score</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dids.map((did) => (
                    <TableRow key={did.id}>
                      <TableCell>
                        <div className="font-medium tabular-nums">{did.did}</div>
                        <div className="text-xs text-muted-foreground">Area code {did.area_code}</div>
                      </TableCell>
                      <TableCell>
                        <select
                          value={did.status}
                          disabled={busy === did.id}
                          onChange={(e) =>
                            void run(did.id, () =>
                              dialerJson('/api/dialer/did-pool', {
                                method: 'PATCH',
                                body: JSON.stringify({ id: did.id, status: e.target.value }),
                              }),
                            )
                          }
                          className={cn('rounded-md border-0 px-2 py-1 text-xs font-medium', STATUS_COLOR[did.status])}
                        >
                          <option value="active">Active</option>
                          <option value="cooldown">Cooldown</option>
                          <option value="retired">Retired</option>
                        </select>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {did.calls_today} / {getDidWarmupCap(did)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{Number(did.answer_rate).toFixed(0)}%</TableCell>
                      <TableCell className={cn('text-right tabular-nums font-medium', spamColor(Number(did.spam_score)))}>
                        {Number(did.spam_score).toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={busy === did.id}
                          aria-label={`Delete ${did.did}`}
                          onClick={() => {
                            if (!window.confirm(`Remove ${did.did} from your pool?`)) return
                            void run(did.id, () =>
                              dialerJson('/api/dialer/did-pool', { method: 'DELETE', body: JSON.stringify({ id: did.id }) }),
                            'Number removed.')
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <h2 className="text-lg font-semibold">Recent calls</h2>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No calls yet. Place calls from Prospecting → Call.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead className="text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.slice(0, 25).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="font-medium">{(log.lead_id && leadNames.get(log.lead_id)) || 'Unknown lead'}</div>
                        <div className="text-xs tabular-nums text-muted-foreground">{log.phone}</div>
                      </TableCell>
                      <TableCell><Badge className="bg-muted text-foreground">{CALL_RESULT_LABEL[log.result]}</Badge></TableCell>
                      <TableCell className="tabular-nums text-sm">{log.did}</TableCell>
                      <TableCell className="text-right tabular-nums">{log.duration ?? 0}s</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
