'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Mail, Phone, Linkedin, Sparkles, Send, CheckCircle2,
  ChevronDown, ChevronUp, Loader2, ChevronRight, Search, History,
} from 'lucide-react'
import type { CRMStore } from '@/hooks/useCRM'
import type { Lead, SequenceTask } from '@/types'
import { cn } from '@/lib/utils'
import { todayDateString } from '@/lib/dailyQueue'
import {
  ENGAGEMENT_GATED_SEQUENCE,
  getTasksForStep,
  getWaitingForOpenTasks,
  SEQUENCE_STEP_TABS,
  type SequenceStepTabId,
} from '@/lib/engagementSequence'
import {
  isEmailReady,
  requestProspectingDraft,
  requestSendEmail,
} from '@/lib/outreachApi'
import { Badge } from '@/components/ui/atoms'
import { EngagementBadge } from '@/components/outreach/EngagementBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

const PAGE_SIZE = 10

const STEP_ICONS = {
  email1: Mail,
  email2: Mail,
  linkedin: Linkedin,
  call: Phone,
  close: Mail,
} as const

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 3) return [1, 2, 3, 4, 'ellipsis', total]
  if (current >= total - 2) return [1, 'ellipsis', total - 3, total - 2, total - 1, total]
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total]
}

export function Prospecting({ crm }: { crm: CRMStore }) {
  const [stepTab, setStepTab] = useState<SequenceStepTabId>('email1')
  const [busyTask, setBusyTask] = useState<string | null>(null)
  const [generatingTaskId, setGeneratingTaskId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const today = useMemo(() => todayDateString(), [])

  const engagementSequenceIds = useMemo(
    () =>
      new Set(
        crm.prospectingSequences
          .filter((s) => s.status === 'active' && s.tier === 'engagement')
          .map((s) => s.id),
      ),
    [crm.prospectingSequences],
  )

  const engagementTasks = useMemo(
    () => crm.sequenceTasks.filter((t) => engagementSequenceIds.has(t.sequence_id)),
    [crm.sequenceTasks, engagementSequenceIds],
  )

  const stepCounts = useMemo(() => {
    const counts = {} as Record<SequenceStepTabId, number>
    for (const step of SEQUENCE_STEP_TABS) {
      counts[step.id] = getTasksForStep(engagementTasks, step.day_number, today).length
    }
    return counts
  }, [engagementTasks, today])

  const currentStep = SEQUENCE_STEP_TABS.find((s) => s.id === stepTab)!

  const dueTasks = useMemo(
    () => getTasksForStep(engagementTasks, currentStep.day_number, today),
    [engagementTasks, currentStep.day_number, today],
  )

  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
    setExpandedTaskId(null)
  }, [stepTab, search])

  function getLead(task: SequenceTask): Lead | undefined {
    return crm.leads.find((l) => l.id === task.lead_id)
  }

  function emailReady(task: SequenceTask) {
    const lead = getLead(task)
    return Boolean(lead?.email && task.generated_subject && task.generated_body)
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
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
      setMessage(error instanceof Error ? error.message : 'Draft failed.')
    } finally {
      setGeneratingTaskId(null)
    }
  }

  async function sendEmail(task: SequenceTask) {
    const lead = getLead(task)
    if (!lead?.email) {
      setMessage('Lead has no email.')
      return
    }
    setBusyTask(task.id)
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
      setExpandedTaskId(null)
      setMessage(`Sent to ${lead.name}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Send failed.')
    } finally {
      setBusyTask(null)
    }
  }

  async function markDone(task: SequenceTask) {
    setBusyTask(task.id)
    setMessage(null)
    if (task.channel === 'phone') {
      setMessage('Call marked done. Sending close email…')
    }
    try {
      await crm.updateSequenceTask(task.id, {
        status: 'done',
        completed_at: new Date().toISOString(),
      })
      if (task.channel === 'phone') {
        setMessage('Call marked done. Close email sent.')
      } else {
        setMessage(`${task.title} marked done.`)
      }
    } finally {
      setBusyTask(null)
    }
  }

  async function bulkGenerate() {
    const targets = dueTasks.filter((t) => selectedIds.has(t.id))
    if (!targets.length) return
    setBulkBusy(true)
    let done = 0
    try {
      for (const task of targets) {
        setGeneratingTaskId(task.id)
        await generateDraft(task)
        done += 1
      }
      setMessage(`Generated ${done} draft${done === 1 ? '' : 's'}.`)
    } finally {
      setGeneratingTaskId(null)
      setBulkBusy(false)
    }
  }

  async function bulkSend() {
    const targets = dueTasks.filter((t) => selectedIds.has(t.id) && emailReady(t))
    if (!targets.length) {
      setMessage('Select leads with ready drafts.')
      return
    }
    setBulkBusy(true)
    let sent = 0
    try {
      for (const task of targets) {
        await sendEmail(task)
        sent += 1
      }
      setSelectedIds(new Set())
      setMessage(`Sent ${sent} email${sent === 1 ? '' : 's'}.`)
    } finally {
      setBulkBusy(false)
    }
  }

  const selectedReady = dueTasks.filter((t) => selectedIds.has(t.id) && emailReady(t)).length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prospecting</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Work one step at a time — finish Email 1, then Email 2, LinkedIn, Call, and Close.
          </p>
          {message && (
            <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">{message}</p>
          )}
        </div>
        <Link
          href="/prospecting/history"
          className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <History className="h-3.5 w-3.5" />
          History
        </Link>
      </div>

      {/* Flow steps */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-2">
        {SEQUENCE_STEP_TABS.map((step, i) => {
          const Icon = STEP_ICONS[step.id]
          const active = stepTab === step.id
          const count = stepCounts[step.id]
          return (
            <Fragment key={step.id}>
              <button
                type="button"
                onClick={() => setStepTab(step.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {step.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                      active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/15 text-primary',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
              {i < SEQUENCE_STEP_TABS.length - 1 && (
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
              )}
            </Fragment>
          )
        })}
      </div>

      <Tabs value={stepTab} onValueChange={(v) => setStepTab(v as SequenceStepTabId)}>
        <TabsList className="sr-only">
          {SEQUENCE_STEP_TABS.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>{s.label}</TabsTrigger>
          ))}
        </TabsList>

        {SEQUENCE_STEP_TABS.map((step) => {
          const stepDueAll = getTasksForStep(engagementTasks, step.day_number, today)
          const stepDueFiltered = search.trim()
            ? stepDueAll.filter((task) => {
                const lead = crm.leads.find((l) => l.id === task.lead_id)
                if (!lead) return false
                const q = search.trim().toLowerCase()
                return lead.name.toLowerCase().includes(q)
                  || (lead.company_name ?? '').toLowerCase().includes(q)
              })
            : stepDueAll
          const stepPageCount = Math.max(1, Math.ceil(stepDueFiltered.length / PAGE_SIZE))
          const stepPaginated = stepTab === step.id
            ? stepDueFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
            : stepDueFiltered.slice(0, PAGE_SIZE)
          const stepWaiting =
            step.id === 'email1' || step.id === 'email2'
              ? getWaitingForOpenTasks(engagementTasks, step.day_number)
              : []

          return (
          <TabsContent key={step.id} value={step.id} className="mt-0 space-y-4">
            <StepPanel
              stepLabel={step.label}
              purpose={ENGAGEMENT_GATED_SEQUENCE.find((s) => s.day_number === step.day_number)?.purpose ?? ''}
              dueCount={stepCounts[step.id]}
              search={search}
              onSearchChange={setSearch}
              isEmailStep={step.channel === 'email'}
              isManualStep={step.id === 'linkedin' || step.id === 'call'}
              dueTasks={stepPaginated}
              totalDue={stepDueFiltered.length}
              waitingTasks={stepWaiting}
              page={page}
              pageCount={stepPageCount}
              onPageChange={setPage}
              selectedIds={selectedIds}
              selectedReady={stepDueFiltered.filter((t) => selectedIds.has(t.id) && emailReady(t)).length}
              bulkBusy={bulkBusy}
              onBulkGenerate={bulkGenerate}
              onBulkSend={bulkSend}
              expandedTaskId={expandedTaskId}
              busyTask={busyTask}
              generatingTaskId={generatingTaskId}
              isAutoSending={(taskId) => crm.autoSendingTaskIds.includes(taskId)}
              getLead={getLead}
              emailReady={emailReady}
              onToggleSelect={toggleSelect}
              onExpand={setExpandedTaskId}
              onGenerate={generateDraft}
              onSend={sendEmail}
              onDone={markDone}
            />
          </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}

function StepPanel({
  stepLabel,
  purpose,
  dueCount,
  search,
  onSearchChange,
  isEmailStep,
  isManualStep,
  dueTasks,
  totalDue,
  waitingTasks,
  page,
  pageCount,
  onPageChange,
  selectedIds,
  selectedReady,
  bulkBusy,
  onBulkGenerate,
  onBulkSend,
  expandedTaskId,
  busyTask,
  generatingTaskId,
  isAutoSending,
  getLead,
  emailReady,
  onToggleSelect,
  onExpand,
  onGenerate,
  onSend,
  onDone,
}: {
  stepLabel: string
  purpose: string
  dueCount: number
  search: string
  onSearchChange: (v: string) => void
  isEmailStep: boolean
  isManualStep: boolean
  dueTasks: SequenceTask[]
  totalDue: number
  waitingTasks: SequenceTask[]
  page: number
  pageCount: number
  onPageChange: (p: number) => void
  selectedIds: Set<string>
  selectedReady: number
  bulkBusy: boolean
  onBulkGenerate: () => void
  onBulkSend: () => void
  expandedTaskId: string | null
  busyTask: string | null
  generatingTaskId: string | null
  isAutoSending: (taskId: string) => boolean
  getLead: (task: SequenceTask) => Lead | undefined
  emailReady: (task: SequenceTask) => boolean
  onToggleSelect: (id: string) => void
  onExpand: (id: string | null) => void
  onGenerate: (task: SequenceTask) => void
  onSend: (task: SequenceTask) => void
  onDone: (task: SequenceTask) => void
}) {
  const pageAllSelected = dueTasks.length > 0 && dueTasks.every((t) => selectedIds.has(t.id))

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="text-lg font-semibold">{stepLabel}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{purpose}</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search leads…"
            className="h-9 pl-8"
          />
        </div>

        {isEmailStep && dueCount > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={bulkBusy || selectedIds.size === 0}
              onClick={onBulkGenerate}
            >
              {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Generate ({selectedIds.size})
            </Button>
            <Button size="sm" disabled={bulkBusy || selectedReady === 0} onClick={onBulkSend}>
              {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send ({selectedReady})
            </Button>
          </div>
        )}

        {totalDue === 0 ? (
          <div className="flex min-h-[32rem] flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
            <p className="font-medium">No {stepLabel.toLowerCase()} tasks due</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {waitingTasks.length > 0
                ? 'Leads below are waiting for opens to unlock the next step.'
                : 'Complete the previous step or enroll more leads from the Leads page.'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              <strong className="font-medium text-foreground">{totalDue}</strong> lead{totalDue === 1 ? '' : 's'} ready for {stepLabel}
            </p>
            <div className="min-h-[32rem] overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isEmailStep && (
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={pageAllSelected}
                          onChange={() => {
                            dueTasks.forEach((t) => {
                              if (pageAllSelected) {
                                if (selectedIds.has(t.id)) onToggleSelect(t.id)
                              } else if (!selectedIds.has(t.id)) {
                                onToggleSelect(t.id)
                              }
                            })
                          }}
                          aria-label="Select all"
                        />
                      </TableHead>
                    )}
                    <TableHead>Lead</TableHead>
                    {isEmailStep && <TableHead>Subject</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dueTasks.map((task) => {
                    const lead = getLead(task)
                    const ready = emailReady(task)
                    const expanded = expandedTaskId === task.id
                    const autoSending = isAutoSending(task.id)
                    return (
                      <Fragment key={task.id}>
                        <TableRow className={cn(expanded && 'border-b-0 bg-muted/30')}>
                          {isEmailStep && (
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(task.id)}
                                onChange={() => onToggleSelect(task.id)}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="font-medium">{lead?.name ?? 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">{lead?.company_name || '—'}</div>
                          </TableCell>
                          {isEmailStep && (
                            <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                              {task.generated_subject || 'No draft'}
                            </TableCell>
                          )}
                          <TableCell>
                            {autoSending ? (
                              <Badge className="bg-blue-100 text-blue-700">
                                <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                                Sending…
                              </Badge>
                            ) : isEmailStep ? (
                              <Badge className={ready ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}>
                                {ready ? 'Ready' : 'Needs draft'}
                              </Badge>
                            ) : (
                              <Badge className="bg-primary/10 text-primary">Due</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onExpand(expanded ? null : task.id)}
                              >
                                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </Button>
                              {isEmailStep && (
                                <Button
                                  size="sm"
                                  disabled={busyTask === task.id || autoSending || !ready}
                                  onClick={() => onSend(task)}
                                >
                                  {autoSending ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Send className="h-3.5 w-3.5" />
                                  )}
                                  {autoSending ? 'Sending…' : 'Send'}
                                </Button>
                              )}
                              {isManualStep && (
                                <Button
                                  size="sm"
                                  disabled={busyTask === task.id || autoSending}
                                  onClick={() => onDone(task)}
                                >
                                  {busyTask === task.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}
                                  {busyTask === task.id && task.channel === 'phone' ? 'Sending…' : 'Done'}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow>
                            <TableCell colSpan={isEmailStep ? 5 : 4} className="bg-muted/20 p-4">
                              <TaskExpand
                                task={task}
                                lead={lead}
                                isEmail={isEmailStep}
                                busy={busyTask === task.id}
                                autoSending={autoSending}
                                generating={generatingTaskId === task.id}
                                ready={ready}
                                onGenerate={() => onGenerate(task)}
                                onSend={() => onSend(task)}
                                onDone={() => onDone(task)}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            {pageCount > 1 && (
              <PaginationBar page={page} pageCount={pageCount} total={totalDue} onPageChange={onPageChange} />
            )}
          </>
        )}

        {waitingTasks.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">Waiting for open ({waitingTasks.length})</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Sent — waiting for the prospect to open before the next step unlocks.
            </p>
            <div className="space-y-2">
              {waitingTasks.map((task) => {
                const lead = getLead(task)
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg border bg-amber-50/50 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium">{lead?.name}</div>
                      <div className="text-xs text-muted-foreground">{task.generated_subject}</div>
                    </div>
                    <EngagementBadge variant="task" task={task} />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TaskExpand({
  task,
  lead,
  isEmail,
  busy,
  autoSending,
  generating,
  ready,
  onGenerate,
  onSend,
  onDone,
}: {
  task: SequenceTask
  lead?: Lead
  isEmail: boolean
  busy: boolean
  autoSending: boolean
  generating: boolean
  ready: boolean
  onGenerate: () => void
  onSend: () => void
  onDone: () => void
}) {
  if (isEmail) {
    return (
      <div className="space-y-3">
        {autoSending && (
          <p className="flex items-center gap-2 text-sm text-blue-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Auto-sending email…
          </p>
        )}
        {task.generated_subject && (
          <div>
            <div className="text-xs font-medium text-muted-foreground">Subject</div>
            <div className="text-sm">{task.generated_subject}</div>
          </div>
        )}
        {task.generated_body && (
          <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">
            {task.generated_body}
          </pre>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={busy || autoSending} onClick={onGenerate}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {task.generated_body ? 'Regenerate' : 'Generate'}
          </Button>
          <Button size="sm" disabled={busy || autoSending || !ready} onClick={onSend}>
            {autoSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {autoSending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{task.purpose}</p>
      {task.generated_script ? (
        <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">
          {task.generated_script}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground">No script yet.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {task.channel === 'linkedin' && lead && <LinkedInButton lead={lead} />}
        <Button variant="outline" size="sm" disabled={busy} onClick={onGenerate}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Generate script
        </Button>
        <Button size="sm" disabled={busy} onClick={onDone}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {busy && task.channel === 'phone' ? 'Sending close email…' : 'Mark done'}
        </Button>
      </div>
    </div>
  )
}

function PaginationBar({
  page,
  pageCount,
  total,
  onPageChange,
}: {
  page: number
  pageCount: number
  total: number
  onPageChange: (p: number) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">
        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
      </p>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} />
          </PaginationItem>
          {getPageNumbers(page, pageCount).map((p, i) => (
            <PaginationItem key={`${p}-${i}`}>
              {p === 'ellipsis' ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink isActive={p === page} onClick={() => onPageChange(p)}>
                  {p}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext onClick={() => onPageChange(Math.min(pageCount, page + 1))} disabled={page === pageCount} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
