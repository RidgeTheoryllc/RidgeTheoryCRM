'use client'

import { useMemo, useState } from 'react'
import { Loader2, Mail, Phone, Linkedin, X } from 'lucide-react'
import type { CRMStore } from '@/hooks/useCRM'
import type { Lead, LeadStatus, SequenceTask } from '@/types'
import { formatDate } from '@/lib/utils'
import { stripCleansingNotes } from '@/lib/emailCleansing'
import { formatEngagementRelativeTime } from '@/lib/emailEngagement'
import { EngagementBadge } from '@/components/outreach/EngagementBadge'
import { Badge } from '@/components/ui/atoms'
import { Button } from '@/components/ui/button'
import { LinkedInButton } from '@/components/ui/LinkedInButton'
import { Sheet, SheetContent } from '@/components/ui/sheet'

const STATUS_STYLE: Record<LeadStatus, string> = {
  Generated: 'bg-slate-100 text-slate-700',
  Augmented: 'bg-blue-100 text-blue-700',
  Cleaned: 'bg-teal-100 text-teal-700',
  Entered: 'bg-indigo-100 text-indigo-700',
  Prospecting: 'bg-amber-100 text-amber-700',
  Qualified: 'bg-green-100 text-green-700',
  Disqualified: 'bg-red-100 text-red-700',
}

interface LeadProfileSheetProps {
  crm: CRMStore
  leadId: string | null
  onClose: () => void
}

export function LeadProfileSheet({ crm, leadId, onClose }: LeadProfileSheetProps) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const lead = crm.leads.find((item) => item.id === leadId)
  const displayNotes = lead ? stripCleansingNotes(lead.notes ?? '') : ''

  const history = useMemo(() => {
    if (!leadId) return []
    return crm.sequenceTasks
      .filter((task) => task.lead_id === leadId)
      .filter((task) => task.status === 'sent' || task.status === 'done')
      .sort((a, b) => {
        const aTime = a.sent_at || a.completed_at || ''
        const bTime = b.sent_at || b.completed_at || ''
        return bTime.localeCompare(aTime)
      })
  }, [crm.sequenceTasks, leadId])

  async function handleReverify() {
    if (!lead) return
    setBusy(true)
    setMessage(null)
    try {
      await crm.reverifyLeadEmail(lead.id)
      setMessage('Email re-verified.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Verification failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkResponded() {
    if (!lead) return
    setBusy(true)
    setMessage(null)
    try {
      await crm.promoteLeadToWarm(lead.id)
      setMessage('Lead marked as warm and added to Contacts.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update lead.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={Boolean(lead)} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent>
        {lead && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{lead.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {lead.title || 'No title'}
                  {lead.company_name ? ` · ${lead.company_name}` : ''}
                </p>
              </div>
              <Button onClick={onClose} variant="ghost" size="icon" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge className={STATUS_STYLE[lead.status]}>{lead.status}</Badge>
              <Badge className={lead.segment === 'warm' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}>
                {lead.segment === 'warm' ? 'Warm' : 'Raw'}
              </Badge>
              {lead.email && <EmailValidityBadge lead={lead} />}
            </div>

            <div className="mt-5 space-y-2 text-sm">
              {lead.email && <Row label="Email" value={lead.email} />}
              {lead.phone && <Row label="Phone" value={lead.phone} />}
              {lead.website && <Row label="Website" value={lead.website} />}
              <Row label="Source" value={lead.source} />
              <Row label="Added" value={formatDate(lead.created_at)} />
              {lead.responded_at && <Row label="Responded" value={formatDate(lead.responded_at)} />}
            </div>

            <div className="mt-3">
              <LinkedInButton lead={lead} />
            </div>

            {(lead.email_engagement && lead.email_engagement !== 'none') && (
              <div className="mt-5">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email engagement
                </h3>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <EngagementBadge variant="lead" lead={lead} />
                  </div>
                  <Row label="Total opens" value={String(lead.total_email_opens ?? 0)} />
                  <Row label="Total clicks" value={String(lead.total_email_clicks ?? 0)} />
                  {lead.last_email_opened_at && (
                    <Row
                      label="Last opened"
                      value={formatEngagementRelativeTime(lead.last_email_opened_at) ?? formatDate(lead.last_email_opened_at)}
                    />
                  )}
                  {lead.last_email_clicked_at && (
                    <Row
                      label="Last clicked"
                      value={formatEngagementRelativeTime(lead.last_email_clicked_at) ?? formatDate(lead.last_email_clicked_at)}
                    />
                  )}
                  {lead.email_engagement === 'bounced' && (
                    <p className="text-sm text-destructive">
                      This email bounced. Do not send further outreach to this address.
                    </p>
                  )}
                </div>
              </div>
            )}

            {displayNotes && (
              <div className="mt-5">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{displayNotes}</p>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {lead.email && (
                <Button onClick={handleReverify} variant="outline" size="sm" disabled={busy}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Re-verify email
                </Button>
              )}
              {lead.segment !== 'warm' && (
                <Button onClick={handleMarkResponded} size="sm" disabled={busy}>
                  Mark as responded
                </Button>
              )}
            </div>

            {message && (
              <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">{message}</p>
            )}

            <div className="mt-6">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Outreach history
              </h3>
              {history.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No completed outreach yet.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {history.map((task) => (
                    <HistoryItem key={task.id} task={task} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{value}</span>
    </div>
  )
}

function EmailValidityBadge({ lead }: { lead: Lead }) {
  if (lead.email_valid === true) {
    return <Badge className="bg-green-100 text-green-700">Valid email</Badge>
  }
  if (lead.email_valid === false) {
    return <Badge className="bg-red-100 text-red-700">Invalid email</Badge>
  }
  return <Badge className="bg-slate-100 text-slate-600">Unverified email</Badge>
}

function HistoryItem({ task }: { task: SequenceTask }) {
  const Icon = task.channel === 'email' ? Mail : task.channel === 'phone' ? Phone : Linkedin
  const when = task.sent_at || task.completed_at
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium capitalize">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {task.channel} · {task.title}
        {task.channel === 'email' && <EngagementBadge variant="task" task={task} />}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Day {task.day_number}
        {when ? ` · ${formatDate(when)}` : ''}
      </div>
      {task.channel === 'email' && task.generated_subject && (
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground">Subject: </span>
          {task.generated_subject}
        </p>
      )}
      {(task.generated_body || task.generated_script) && (
        <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
          {task.channel === 'email' ? task.generated_body : task.generated_script}
        </pre>
      )}
    </div>
  )
}
