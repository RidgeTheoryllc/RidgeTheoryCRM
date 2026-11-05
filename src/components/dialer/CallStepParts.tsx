'use client'

import { useEffect, useState } from 'react'
import { Loader2, Phone, Play } from 'lucide-react'
import { Badge } from '@/components/ui/atoms'
import { Button } from '@/components/ui/button'
import { useDialer } from '@/components/dialer/DialerProvider'
import { dialerFetch, dialerJson } from '@/lib/dialer/client'
import { CALL_RESULT_LABEL, type CallLogRecord, type CallResult } from '@/lib/dialer/types'
import type { Lead, SequenceTask } from '@/types'

const RESULT_COLOR: Record<CallResult, string> = {
  answered: 'bg-green-100 text-green-700',
  no_answer: 'bg-amber-100 text-amber-700',
  busy: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
  spam_flagged: 'bg-red-100 text-red-700',
}

function useLeadCallLogs(leadId: string | undefined) {
  const { callLogs } = useDialer()
  return leadId ? callLogs.filter((log) => log.lead_id === leadId) : []
}

export function CallLeadButton({ lead, task }: { lead?: Lead; task: SequenceTask }) {
  const { deviceReady, dialLead, dialing, activeLead, activeCall } = useDialer()
  const isThisLead = activeLead?.leadId === lead?.id
  const busy = Boolean(activeLead || activeCall)
  const hasPhone = Boolean(lead?.phone?.replace(/\D/g, ''))

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={!lead || !hasPhone || !deviceReady || busy}
      title={!hasPhone ? 'Lead has no phone number' : !deviceReady ? 'Phone is not ready' : undefined}
      onClick={() => lead && void dialLead(lead, task)}
    >
      {isThisLead && dialing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
      {isThisLead ? 'On call' : 'Call'}
    </Button>
  )
}

export function LastCallBadge({ leadId }: { leadId?: string }) {
  const last = useLeadCallLogs(leadId)[0]
  if (!last) return null
  return <Badge className={RESULT_COLOR[last.result]}>{CALL_RESULT_LABEL[last.result]}</Badge>
}

function formatSeconds(seconds: number | null) {
  if (!seconds) return '0:00'
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function RecordingPlayer({ logId }: { logId: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => {
    if (src) URL.revokeObjectURL(src)
  }, [src])

  if (src) return <audio controls autoPlay src={src} className="h-8 w-full max-w-xs" />

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        setError('')
        try {
          const res = await dialerFetch(`/api/dialer/recording?id=${encodeURIComponent(logId)}`)
          if (!res.ok) throw new Error('Recording unavailable')
          setSrc(URL.createObjectURL(await res.blob()))
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Recording unavailable')
        } finally {
          setLoading(false)
        }
      }}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
      {error || 'Recording'}
    </Button>
  )
}

function CallNotes({ log }: { log: CallLogRecord }) {
  const { refreshCallLogs } = useDialer()
  const [notes, setNotes] = useState(log.call_notes ?? '')
  const [saving, setSaving] = useState(false)
  const dirty = notes !== (log.call_notes ?? '')

  return (
    <div className="flex items-start gap-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Call notes…"
        className="min-h-[2.5rem] flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      />
      {dirty && (
        <Button
          size="sm"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            try {
              await dialerJson('/api/dialer/call-logs', {
                method: 'PATCH',
                body: JSON.stringify({ id: log.id, call_notes: notes }),
              })
              await refreshCallLogs()
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
        </Button>
      )}
    </div>
  )
}

export function LeadCallHistory({ lead }: { lead?: Lead }) {
  const logs = useLeadCallLogs(lead?.id)

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        Phone: <span className="tabular-nums text-foreground">{lead?.phone || 'none on file'}</span>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No calls yet.</p>
      ) : (
        <div className="space-y-2">
          {logs.slice(0, 5).map((log) => (
            <div key={log.id} className="space-y-2 rounded-md border bg-background p-2.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge className={RESULT_COLOR[log.result]}>{CALL_RESULT_LABEL[log.result]}</Badge>
                <span>{new Date(log.timestamp).toLocaleString()}</span>
                <span className="tabular-nums">{formatSeconds(log.duration)}</span>
                <span className="tabular-nums">from {log.did}</span>
                {log.twilio_recording_sid && <RecordingPlayer logId={log.id} />}
              </div>
              <CallNotes log={log} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
