'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Mail, Phone, Linkedin, Sparkles, Send, CheckCircle2,
  ChevronDown, ChevronUp, Loader2, CalendarClock,
} from 'lucide-react'
import type { CRMStore } from '@/hooks/useCRM'
import type { Lead, SequenceTask } from '@/types'
import { format } from 'date-fns'
import { cn, formatDate } from '@/lib/utils'
import {
  getTodaysOutreachTasks,
  getUpcomingTasks,
  getRecentlySentEmailTasks,
  groupTasksByChannel,
  todayDateString,
} from '@/lib/dailyQueue'
import {
  isEmailReady,
  requestProspectingDraft,
  requestSendEmail,
} from '@/lib/outreachApi'
import { Badge } from '@/components/ui/atoms'
import { EngagementBadge } from '@/components/outreach/EngagementBadge'
import { Button } from '@/components/ui/button'
import { LinkedInButton } from '@/components/ui/LinkedInButton'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

const EMAIL_PAGE_SIZE = 10

type ProspectingTab = 'email' | 'linkedin' | 'phone' | 'upcoming'

const CHANNEL_LABEL: Record<Exclude<ProspectingTab, 'upcoming'>, string> = {
  email: 'Email',
  linkedin: 'LinkedIn',
  phone: 'Phone',
}

const CHANNEL_ICON = {
  email: Mail,
  linkedin: Linkedin,
  phone: Phone,
} as const

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 3) return [1, 2, 3, 4, 'ellipsis', total]
  if (current >= total - 2) return [1, 'ellipsis', total - 3, total - 2, total - 1, total]
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total]
}

export function Prospecting({ crm }: { crm: CRMStore }) {
  const [busyTask, setBusyTask] = useState<string | null>(null)
  const [generatingTaskId, setGeneratingTaskId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set())
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [emailPage, setEmailPage] = useState(1)

  const today = useMemo(() => todayDateString(), [])

  const activeTasks = useMemo(
    () => getTodaysOutreachTasks(crm.sequenceTasks, today),
    [crm.sequenceTasks, today],
  )

  const { email: emailTasks, linkedin: linkedinTasks, phone: phoneTasks } = useMemo(
    () => groupTasksByChannel(activeTasks),
    [activeTasks],
  )

  const upcoming = useMemo(
    () => getUpcomingTasks(crm.sequenceTasks, today),
    [crm.sequenceTasks, today],
  )

  const recentlySentEmails = useMemo(
    () => getRecentlySentEmailTasks(crm.sequenceTasks),
    [crm.sequenceTasks],
  )

  const emailPageCount = Math.max(1, Math.ceil(emailTasks.length / EMAIL_PAGE_SIZE))

  const paginatedEmailTasks = useMemo(() => {
    const start = (emailPage - 1) * EMAIL_PAGE_SIZE
    return emailTasks.slice(start, start + EMAIL_PAGE_SIZE)
  }, [emailTasks, emailPage])

  useEffect(() => {
    if (emailPage > emailPageCount) setEmailPage(emailPageCount)
  }, [emailPage, emailPageCount])

  function getLead(task: SequenceTask): Lead | undefined {
    return crm.leads.find((item) => item.id === task.lead_id)
  }

  function isEmailReady(task: SequenceTask) {
    const lead = getLead(task)
    return Boolean(lead?.email && task.generated_subject && task.generated_body)
  }

  function toggleEmailSelection(id: string) {
    setSelectedEmailIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectPageEmails() {
    const pageIds = paginatedEmailTasks.map((task) => task.id)
    const allSelected = pageIds.every((id) => selectedEmailIds.has(id))
    setSelectedEmailIds((prev) => {
      const next = new Set(prev)
      if (allSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  async function generateDraft(task: SequenceTask) {
    const lead = getLead(task)
    if (!lead) return

    setGeneratingTaskId(task.id)
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
      setGeneratingTaskId(null)
    }
  }

  async function sendEmail(task: SequenceTask) {
    const lead = getLead(task)
    if (!lead?.email) {
      setMessage('Lead does not have an email address.')
      return
    }

    setBusyTask(task.id)
    setMessage(null)
    try {
      const data = await requestSendEmail(
        lead.email,
        task.generated_subject,
        task.generated_body,
        lead.id,
        task.id,
      )
      await crm.updateSequenceTask(task.id, {
        status: 'sent',
        resend_email_id: data.id ?? '',
        sent_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      if (!lead.email_engagement || lead.email_engagement === 'none') {
        await crm.updateLead(lead.id, { email_engagement: 'sent' })
      }
      setSelectedEmailIds((prev) => {
        const next = new Set(prev)
        next.delete(task.id)
        return next
      })
      if (expandedTaskId === task.id) setExpandedTaskId(null)
      setMessage('Email sent.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Email send failed.')
    } finally {
      setBusyTask(null)
    }
  }

  async function bulkGenerateEmails() {
    const targets = emailTasks.filter((task) => selectedEmailIds.has(task.id))
    if (!targets.length) return

    setBulkBusy(true)
    setMessage(null)
    let done = 0
    try {
      for (const task of targets) {
        const lead = getLead(task)
        if (!lead) continue
        setGeneratingTaskId(task.id)
        setMessage(`Generating drafts… ${done + 1} of ${targets.length}`)
        const data = await requestProspectingDraft(lead, task)
        await crm.updateSequenceTask(task.id, {
          generated_subject: data.subject ?? '',
          generated_body: data.body ?? '',
          generated_script: data.script ?? '',
        })
        done += 1
      }
      setMessage(`Generated ${done} draft${done === 1 ? '' : 's'}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bulk generate failed.')
    } finally {
      setGeneratingTaskId(null)
      setBulkBusy(false)
    }
  }

  async function bulkSendEmails() {
    const targets = emailTasks.filter(
      (task) => selectedEmailIds.has(task.id) && isEmailReady(task),
    )
    if (!targets.length) {
      setMessage('Select emails with drafts and valid addresses to send.')
      return
    }

    setBulkBusy(true)
    setMessage(null)
    let sent = 0
    let failed = 0
    try {
      for (const task of targets) {
        const lead = getLead(task)
        if (!lead?.email) continue
        setMessage(`Sending emails… ${sent + failed + 1} of ${targets.length}`)
        try {
          const data = await requestSendEmail(
            lead.email,
            task.generated_subject,
            task.generated_body,
            lead.id,
            task.id,
          )
          await crm.updateSequenceTask(task.id, {
            status: 'sent',
            resend_email_id: data.id ?? '',
            sent_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          })
          if (!lead.email_engagement || lead.email_engagement === 'none') {
            await crm.updateLead(lead.id, { email_engagement: 'sent' })
          }
          sent += 1
        } catch {
          failed += 1
        }
      }
      setSelectedEmailIds(new Set())
      setExpandedTaskId(null)
      setMessage(
        failed > 0
          ? `Sent ${sent} email${sent === 1 ? '' : 's'}, ${failed} failed.`
          : `Sent ${sent} email${sent === 1 ? '' : 's'}.`,
      )
    } finally {
      setBulkBusy(false)
    }
  }

  async function markDone(task: SequenceTask) {
    await crm.updateSequenceTask(task.id, {
      status: 'done',
      completed_at: new Date().toISOString(),
    })
  }

  const selectedReadyCount = emailTasks.filter(
    (task) => selectedEmailIds.has(task.id) && isEmailReady(task),
  ).length

  const pageAllSelected = paginatedEmailTasks.length > 0
    && paginatedEmailTasks.every((task) => selectedEmailIds.has(task.id))

  const tabCounts: Record<ProspectingTab, number> = {
    email: emailTasks.length,
    linkedin: linkedinTasks.length,
    phone: phoneTasks.length,
    upcoming: upcoming.length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Prospecting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Email 1 goes out first. Opens unlock Email 2; opens on Email 2 unlock LinkedIn, phone, and close — and add the lead to Warm/Contacts.
        </p>
        {message && (
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            {message}
          </p>
        )}
      </div>

      <Tabs defaultValue="email" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-3.5 w-3.5" />
            Email due
            <TabCount count={tabCounts.email} />
          </TabsTrigger>
          <TabsTrigger value="linkedin" className="gap-2">
            <Linkedin className="h-3.5 w-3.5" />
            LinkedIn due
            <TabCount count={tabCounts.linkedin} />
          </TabsTrigger>
          <TabsTrigger value="phone" className="gap-2">
            <Phone className="h-3.5 w-3.5" />
            Phone due
            <TabCount count={tabCounts.phone} />
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-2">
            <CalendarClock className="h-3.5 w-3.5" />
            Upcoming
            <TabCount count={tabCounts.upcoming} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <Card>
            <CardContent className="pt-6">
              {emailTasks.length > 0 && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {emailTasks.length} email{emailTasks.length === 1 ? '' : 's'} due today
                    {selectedEmailIds.size > 0 && ` · ${selectedEmailIds.size} selected`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={bulkGenerateEmails}
                      variant="outline"
                      size="sm"
                      disabled={bulkBusy || selectedEmailIds.size === 0}
                    >
                      {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Generate selected ({selectedEmailIds.size})
                    </Button>
                    <Button
                      onClick={bulkSendEmails}
                      size="sm"
                      disabled={bulkBusy || selectedReadyCount === 0}
                    >
                      {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send selected ({selectedReadyCount})
                    </Button>
                  </div>
                </div>
              )}

              {emailTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No email tasks due.</p>
              ) : (
                <>
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <input
                              type="checkbox"
                              checked={pageAllSelected}
                              onChange={toggleSelectPageEmails}
                              aria-label="Select all on this page"
                            />
                          </TableHead>
                          <TableHead>Lead</TableHead>
                          <TableHead>Step</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead className="w-24">Status</TableHead>
                          <TableHead className="w-28 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedEmailTasks.map((task) => {
                          const lead = getLead(task)
                          const ready = isEmailReady(task)
                          const expanded = expandedTaskId === task.id
                          return (
                            <Fragment key={task.id}>
                              <TableRow className={cn(expanded && 'border-b-0 bg-muted/30')}>
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={selectedEmailIds.has(task.id)}
                                    onChange={() => toggleEmailSelection(task.id)}
                                    aria-label={`Select ${lead?.name ?? 'lead'}`}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium">{lead?.name ?? 'Unknown'}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {lead?.company_name || 'No company'} · Day {task.day_number}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm">{task.title}</TableCell>
                                <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                                  {task.generated_subject || 'No draft yet'}
                                </TableCell>
                                <TableCell>
                                  <Badge className={ready ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}>
                                    {ready ? 'Ready' : 'Draft'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      onClick={() => setExpandedTaskId(expanded ? null : task.id)}
                                      variant="ghost"
                                      size="icon"
                                      title={expanded ? 'Collapse' : 'Preview'}
                                    >
                                      {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    </Button>
                                    <Button
                                      onClick={() => sendEmail(task)}
                                      variant="ghost"
                                      size="icon"
                                      disabled={busyTask === task.id || bulkBusy || !ready}
                                      title="Send email"
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {expanded && (
                                <TableRow className="bg-muted/20 hover:bg-muted/20">
                                  <TableCell colSpan={6} className="p-0">
                                    <div className="prospecting-expand border-t bg-muted/20 px-4 py-4">
                                      <EmailPreviewPanel
                                        task={task}
                                        lead={lead}
                                        busy={busyTask === task.id || bulkBusy}
                                        generating={generatingTaskId === task.id}
                                        onGenerate={() => generateDraft(task)}
                                        onSend={() => sendEmail(task)}
                                      />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {emailPageCount > 1 && (
                    <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        Showing {(emailPage - 1) * EMAIL_PAGE_SIZE + 1}–{Math.min(emailPage * EMAIL_PAGE_SIZE, emailTasks.length)} of {emailTasks.length}
                      </p>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setEmailPage((p) => Math.max(1, p - 1))}
                              disabled={emailPage === 1}
                            />
                          </PaginationItem>
                          {getPageNumbers(emailPage, emailPageCount).map((page, i) => (
                            <PaginationItem key={`${page}-${i}`}>
                              {page === 'ellipsis' ? (
                                <PaginationEllipsis />
                              ) : (
                                <PaginationLink
                                  isActive={page === emailPage}
                                  onClick={() => setEmailPage(page)}
                                >
                                  {page}
                                </PaginationLink>
                              )}
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setEmailPage((p) => Math.min(emailPageCount, p + 1))}
                              disabled={emailPage === emailPageCount}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}

                </>
              )}

              {recentlySentEmails.length > 0 && (
                <div className="mt-8">
                  <h3 className="mb-3 text-sm font-semibold">Sent recently</h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Engagement updates live when prospects open or click your emails.
                  </p>
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lead</TableHead>
                          <TableHead>Step</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Sent</TableHead>
                          <TableHead>Engagement</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentlySentEmails.slice(0, 20).map((task) => {
                          const lead = getLead(task)
                          return (
                            <TableRow key={task.id}>
                              <TableCell>
                                <div className="font-medium">{lead?.name ?? 'Unknown'}</div>
                                <div className="text-xs text-muted-foreground">
                                  {lead?.company_name || 'No company'} · Day {task.day_number}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{task.title}</TableCell>
                              <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                                {task.generated_subject}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {task.sent_at ? formatDate(task.sent_at) : '—'}
                              </TableCell>
                              <TableCell>
                                <EngagementBadge variant="task" task={task} />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {(['linkedin', 'phone'] as const).map((channel) => {
          const tasks = channel === 'linkedin' ? linkedinTasks : phoneTasks
          return (
            <TabsContent key={channel} value={channel}>
              <Card>
                <CardContent className="pt-6">
                  {tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No {CHANNEL_LABEL[channel].toLowerCase()} tasks due.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <ManualTaskRow
                          key={task.id}
                          task={task}
                          lead={getLead(task)}
                          expanded={expandedTaskId === task.id}
                          busy={busyTask === task.id || generatingTaskId === task.id}
                          generating={generatingTaskId === task.id}
                          onToggle={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                          onGenerate={() => generateDraft(task)}
                          onDone={() => markDone(task)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}

        <TabsContent value="upcoming">
          <Card>
            <CardContent className="pt-6">
              <UpcomingSchedule tasks={upcoming} getLead={getLead} today={today} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function UpcomingSchedule({
  tasks,
  getLead,
  today,
}: {
  tasks: SequenceTask[]
  getLead: (task: SequenceTask) => Lead | undefined
  today: string
}) {
  const byDate = useMemo(() => {
    const groups = new Map<string, SequenceTask[]>()
    for (const task of tasks) {
      const list = groups.get(task.due_date) ?? []
      list.push(task)
      groups.set(task.due_date, list)
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayTasks]) => [
        date,
        dayTasks.sort((a, b) => a.lead_id.localeCompare(b.lead_id) || a.day_number - b.day_number),
      ] as const)
  }, [tasks])

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No upcoming sequence tasks.</p>
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Scheduled follow-ups from enrolled leads. When each date arrives, tasks move to the
        {' '}<strong className="font-medium text-foreground">Email</strong>,{' '}
        <strong className="font-medium text-foreground">LinkedIn</strong>, or{' '}
        <strong className="font-medium text-foreground">Phone</strong> tab to work on.
      </p>

      {byDate.map(([date, dayTasks]) => (
        <section key={date}>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-sm font-semibold">{formatUpcomingDate(date)}</h3>
            <span className="text-xs text-muted-foreground">
              {formatDueRelative(date, today)} · {dayTasks.length} task{dayTasks.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Sequence step</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead className="min-w-[6.75rem]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayTasks.map((task) => {
                  const lead = getLead(task)
                  const Icon = CHANNEL_ICON[task.channel]
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className="font-medium">{lead?.name ?? 'Unknown lead'}</div>
                        <div className="text-xs text-muted-foreground">
                          {lead?.company_name || 'No company'}
                          {lead?.title ? ` · ${lead.title}` : ''}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">Day {task.day_number} · {task.title}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{task.purpose}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm capitalize">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                          {CHANNEL_LABEL[task.channel]}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge
                          className={cn(
                            'whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                            task.trigger_type === 'automatic'
                              ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/80'
                              : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80',
                          )}
                        >
                          {task.trigger_type === 'automatic' ? 'Auto-send' : 'Manual'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}
    </div>
  )
}

function formatUpcomingDate(date: string) {
  try {
    return format(new Date(`${date}T00:00:00`), 'EEEE, MMM d, yyyy')
  } catch {
    return formatDate(date)
  }
}

function formatDueRelative(date: string, today: string) {
  const due = new Date(`${date}T00:00:00`)
  const now = new Date(`${today}T00:00:00`)
  const days = Math.round((due.getTime() - now.getTime()) / 86_400_000)
  if (days === 1) return 'Tomorrow'
  if (days > 1) return `In ${days} days`
  return formatDate(date)
}

function TabCount({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
      {count}
    </span>
  )
}

function EmailPreviewPanel({
  task,
  lead,
  busy,
  generating,
  onGenerate,
  onSend,
}: {
  task: SequenceTask
  lead?: Lead
  busy: boolean
  generating: boolean
  onGenerate: () => void
  onSend: () => void
}) {
  const ready = Boolean(lead?.email && task.generated_subject && task.generated_body)

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium">{lead?.name ?? 'Unknown lead'}</div>
          <div className="text-xs text-muted-foreground">{task.title} · {task.purpose}</div>
        </div>
        <Badge className={task.trigger_type === 'automatic' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}>
          {task.trigger_type}
        </Badge>
      </div>
      {task.generated_subject && (
        <div className="mt-3 rounded-lg bg-background p-3 text-sm">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Subject</div>
          {task.generated_subject}
        </div>
      )}
      {task.generated_body && (
        <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background p-3 text-sm font-sans leading-relaxed">
          {task.generated_body}
        </pre>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={onGenerate} variant="outline" size="sm" disabled={busy}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {generating
            ? (task.generated_body ? 'Regenerating…' : 'Generating…')
            : (task.generated_body ? 'Regenerate' : 'Generate')}
        </Button>
        <Button onClick={onSend} size="sm" disabled={busy || !ready}>
          {busy && !generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {busy && !generating ? 'Sending…' : 'Send email'}
        </Button>
      </div>
    </div>
  )
}

function ManualTaskRow({
  task,
  lead,
  expanded,
  busy,
  generating,
  onToggle,
  onGenerate,
  onDone,
}: {
  task: SequenceTask
  lead?: Lead
  expanded: boolean
  busy: boolean
  generating: boolean
  onToggle: () => void
  onGenerate: () => void
  onDone: () => void
}) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <div className="truncate font-medium text-sm">{lead?.name ?? 'Unknown lead'}</div>
          <div className="truncate text-xs text-muted-foreground">
            {task.title} · Day {task.day_number}
          </div>
        </div>
        <div className="flex flex-shrink-0 gap-1">
          <Button onClick={onToggle} variant="ghost" size="icon">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          <Button onClick={onDone} size="sm" disabled={busy}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Done
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="border-t bg-muted/20 px-3 py-3">
          <p className="text-xs text-muted-foreground">{task.purpose}</p>
          {task.generated_script ? (
            <pre className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap text-sm font-sans leading-relaxed">
              {task.generated_script}
            </pre>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No script generated yet.</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {task.channel === 'linkedin' && lead && <LinkedInButton lead={lead} />}
            <Button onClick={onGenerate} variant="outline" size="sm" disabled={busy}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generating
              ? (task.generated_script ? 'Regenerating…' : 'Generating…')
              : (task.generated_script ? 'Regenerate' : 'Generate')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
