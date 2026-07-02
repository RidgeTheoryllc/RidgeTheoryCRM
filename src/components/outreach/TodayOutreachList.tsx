'use client'

import { useMemo, useState } from 'react'
import { Loader2, Mail, Phone, Linkedin, Sparkles, Send, CheckCircle2 } from 'lucide-react'
import type { CRMStore } from '@/hooks/useCRM'
import type { Lead, SequenceTask } from '@/types'
import { formatTaskAction, getTodaysOutreachTasks } from '@/lib/dailyQueue'
import { isEmailReady, requestProspectingDraft, requestSendEmail } from '@/lib/outreachApi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const CHANNEL_ICON = {
  email: Mail,
  linkedin: Linkedin,
  phone: Phone,
} as const

const VISIBLE_TASK_ROWS = 5
const TASK_ROW_MIN_HEIGHT = '4.5rem'
const TASK_LIST_MAX_HEIGHT = `calc(${VISIBLE_TASK_ROWS} * ${TASK_ROW_MIN_HEIGHT} + ${VISIBLE_TASK_ROWS - 1} * 0.5rem)`

interface TodayOutreachListProps {
  crm: CRMStore
  onNav: (page: string) => void
}

export function TodayOutreachList({ crm, onNav }: TodayOutreachListProps) {
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const activeTasks = useMemo(
    () => getTodaysOutreachTasks(crm.sequenceTasks),
    [crm.sequenceTasks],
  )

  function getLead(task: SequenceTask): Lead | undefined {
    return crm.leads.find((lead) => lead.id === task.lead_id)
  }

  async function generateDraft(task: SequenceTask) {
    const lead = getLead(task)
    if (!lead) return
    setBusyTaskId(task.id)
    setMessage(null)
    try {
      const data = await requestProspectingDraft(lead, task)
      await crm.updateSequenceTask(task.id, {
        generated_subject: data.subject ?? '',
        generated_body: data.body ?? '',
        generated_script: data.script ?? '',
      })
      setMessage('Draft generated.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Draft generation failed.')
    } finally {
      setBusyTaskId(null)
    }
  }

  async function sendEmail(task: SequenceTask) {
    const lead = getLead(task)
    if (!lead?.email) {
      setMessage('Lead does not have an email address.')
      return
    }
    setBusyTaskId(task.id)
    setMessage(null)
    try {
      const data = await requestSendEmail(lead.email, task.generated_subject, task.generated_body)
      await crm.updateSequenceTask(task.id, {
        status: 'sent',
        resend_email_id: data.id ?? '',
        sent_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      setMessage('Email sent.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Email send failed.')
    } finally {
      setBusyTaskId(null)
    }
  }

  async function markDone(task: SequenceTask) {
    setBusyTaskId(task.id)
    try {
      await crm.updateSequenceTask(task.id, {
        status: 'done',
        completed_at: new Date().toISOString(),
      })
    } finally {
      setBusyTaskId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Today&apos;s outreach</CardTitle>
          <CardDescription>
            {activeTasks.length === 0
              ? 'No sequence tasks due today.'
              : `${activeTasks.length} task${activeTasks.length === 1 ? '' : 's'} due — email, LinkedIn, and phone reminders.`}
          </CardDescription>
        </div>
        {activeTasks.length > 0 && (
          <Button onClick={() => onNav('prospecting')} variant="outline" size="sm">
            Open Prospecting
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {message && (
          <p className="mb-3 text-xs text-muted-foreground" aria-live="polite">
            {message}
          </p>
        )}
        {activeTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Enroll leads from the Leads page to start a prospecting sequence.
          </p>
        ) : (
          <div
            className="space-y-2 overflow-y-auto pr-1"
            style={{ maxHeight: TASK_LIST_MAX_HEIGHT }}
          >
            {activeTasks.map((task) => {
              const lead = getLead(task)
              const Icon = CHANNEL_ICON[task.channel]
              const busy = busyTaskId === task.id
              const ready = task.channel === 'email' && isEmailReady(task, lead)
              return (
                <div
                  key={task.id}
                  className="flex min-h-[4.5rem] flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{formatTaskAction(task, lead)}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {task.title} · Day {task.day_number}
                        {lead?.company_name ? ` · ${lead.company_name}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {task.channel === 'email' ? (
                      <>
                        {!ready && (
                          <Button
                            onClick={() => generateDraft(task)}
                            variant="outline"
                            size="sm"
                            disabled={busy}
                          >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            Generate
                          </Button>
                        )}
                        <Button
                          onClick={() => sendEmail(task)}
                          size="sm"
                          disabled={busy || !ready}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          Send
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => markDone(task)} size="sm" disabled={busy}>
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Done
                      </Button>
                    )}
                    <Button
                      onClick={() => onNav('prospecting')}
                      variant="ghost"
                      size="sm"
                    >
                      Details
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
