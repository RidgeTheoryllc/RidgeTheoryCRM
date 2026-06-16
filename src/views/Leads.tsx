'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Loader2, Search, Trash2, Upload } from 'lucide-react'
import type { CRMStore } from '@/hooks/useCRM'
import { useImportExport } from '@/hooks/useImportExport'
import { createCSVMapping, parseCSV } from '@/lib/csv'
import { scoreLead } from '@/lib/leadScoring'
import type { LeadStatus } from '@/types'
import { LEAD_BUCKETS, countLeadsByBucket, matchesLeadBucket, type LeadBucket } from '@/lib/leadStatus'
import { cn, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/atoms'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

const PAGE_SIZE = 20

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 3) return [1, 2, 3, 4, 'ellipsis', total]
  if (current >= total - 2) return [1, 'ellipsis', total - 3, total - 2, total - 1, total]
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total]
}

const STATUS_STYLE: Record<LeadStatus, string> = {
  Generated: 'bg-slate-100 text-slate-700',
  Augmented: 'bg-blue-100 text-blue-700',
  Cleaned: 'bg-teal-100 text-teal-700',
  Entered: 'bg-indigo-100 text-indigo-700',
  Prospecting: 'bg-amber-100 text-amber-700',
  Qualified: 'bg-green-100 text-green-700',
  Disqualified: 'bg-red-100 text-red-700',
}

function emailValidityBadge(lead: { email: string; email_valid?: boolean | null; email_status?: string | null }) {
  if (!lead.email?.trim()) return null
  if (lead.email_valid === true) {
    return <Badge className="shrink-0 bg-green-100 text-green-700">Valid</Badge>
  }
  if (lead.email_valid === false) {
    return (
      <span title={lead.email_status ?? 'invalid'}>
        <Badge className="shrink-0 bg-red-100 text-red-700">Invalid</Badge>
      </span>
    )
  }
  return <Badge className="shrink-0 bg-slate-100 text-slate-600">Unverified</Badge>
}

const LEAD_IMPORT_FIELDS = [
  'name', 'title', 'email', 'phone', 'company_name',
  'website', 'source', 'ingestion_source', 'status', 'notes',
]

export function Leads({ crm, onNew }: { crm: CRMStore; onNew: (t: string) => void }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<LeadBucket>('all')
  const [importing, setImporting] = useState(false)
  const [enrolling, setEnrolling] = useState<string | null>(null)
  const [bulkEnrolling, setBulkEnrolling] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { importCSV } = useImportExport(crm)

  async function handleCSVUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportMessage(null)

    try {
      const parsed = parseCSV(await file.text())
      if (parsed.length < 2) {
        setImportMessage('CSV needs a header row and at least one lead row.')
        return
      }

      const [headers, ...rows] = parsed
      const mapping = createCSVMapping(LEAD_IMPORT_FIELDS, headers)
      const imported = await importCSV('leads', rows, mapping)
      setImportMessage(
        imported > 0
          ? `Imported and verified ${imported} lead${imported === 1 ? '' : 's'} from ${file.name}.`
          : 'No leads imported. Check that the CSV has a name or title column.',
      )
    } catch (error) {
      console.error('Failed to import leads CSV:', error)
      setImportMessage('Could not import that CSV file.')
    } finally {
      event.target.value = ''
      setImporting(false)
    }
  }

  function isEnrolled(leadId: string) {
    return crm.prospectingSequences.some(
      (sequence) => sequence.lead_id === leadId && sequence.status === 'active',
    )
  }

  async function enrollLead(id: string) {
    setEnrolling(id)
    setImportMessage(null)
    try {
      await crm.enrollLeadInSequence(id)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setImportMessage('Lead enrolled into the recommended prospecting sequence.')
    } catch (error) {
      console.error('Failed to enroll lead:', error)
      setImportMessage('Could not enroll that lead.')
    } finally {
      setEnrolling(null)
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = crm.leads
    .filter((lead) => {
      const matchesFilter = matchesLeadBucket(lead.status, filter)
      const query = q.toLowerCase()
      const matchesQuery = !q ||
        lead.name.toLowerCase().includes(query) ||
        lead.company_name.toLowerCase().includes(query) ||
        lead.email.toLowerCase().includes(query)
      return matchesFilter && matchesQuery
    })
    .sort((a, b) => effectiveScore(b).overall_score - effectiveScore(a).overall_score)

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const paginatedLeads = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  useEffect(() => {
    setPage(1)
  }, [q, filter])

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const enrollableFiltered = filtered.filter((lead) => !isEnrolled(lead.id))
  const selectedEnrollableCount = enrollableFiltered.filter((lead) => selectedIds.has(lead.id)).length
  const selectedCount = filtered.filter((lead) => selectedIds.has(lead.id)).length
  const allFilteredSelected = filtered.length > 0
    && filtered.every((lead) => selectedIds.has(lead.id))
  const bulkBusy = bulkEnrolling || bulkDeleting

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filtered.forEach((lead) => next.delete(lead.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filtered.forEach((lead) => next.add(lead.id))
        return next
      })
    }
  }

  function requestDeleteLead(id: string, name: string) {
    setDeleteConfirm({ type: 'single', id, name })
  }

  function requestBulkDelete() {
    const targets = filtered.filter((lead) => selectedIds.has(lead.id))
    if (!targets.length) return
    setDeleteConfirm({
      type: 'bulk',
      ids: targets.map((lead) => lead.id),
      names: targets.map((lead) => lead.name),
    })
  }

  async function confirmDelete() {
    if (!deleteConfirm) return

    setDeleteConfirm(null)
    setImportMessage(null)

    if (deleteConfirm.type === 'single') {
      try {
        await crm.deleteLead(deleteConfirm.id)
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(deleteConfirm.id)
          return next
        })
        setImportMessage(`Deleted ${deleteConfirm.name}.`)
      } catch (error) {
        console.error('Failed to delete lead:', error)
        setImportMessage('Could not delete that lead.')
      }
      return
    }

    setBulkDeleting(true)
    let done = 0
    let failed = 0

    try {
      for (const id of deleteConfirm.ids) {
        setImportMessage(`Deleting leads… ${done + failed + 1} of ${deleteConfirm.ids.length}`)
        try {
          await crm.deleteLead(id)
          done += 1
        } catch (error) {
          console.error('Failed to delete lead:', id, error)
          failed += 1
        }
      }
      setSelectedIds(new Set())
      setImportMessage(
        failed > 0
          ? `Deleted ${done} lead${done === 1 ? '' : 's'}, ${failed} failed.`
          : `Deleted ${done} lead${done === 1 ? '' : 's'}.`,
      )
    } finally {
      setBulkDeleting(false)
    }
  }

  async function bulkEnroll() {
    const targets = enrollableFiltered.filter((lead) => selectedIds.has(lead.id))
    if (!targets.length) return

    setBulkEnrolling(true)
    setImportMessage(null)
    let done = 0
    let failed = 0

    try {
      for (const lead of targets) {
        setImportMessage(`Enrolling leads… ${done + failed + 1} of ${targets.length}`)
        try {
          await crm.enrollLeadInSequence(lead.id)
          done += 1
        } catch (error) {
          console.error('Failed to enroll lead:', lead.id, error)
          failed += 1
        }
      }
      setSelectedIds(new Set())
      setImportMessage(
        failed > 0
          ? `Enrolled ${done} lead${done === 1 ? '' : 's'}, ${failed} failed.`
          : `Enrolled ${done} lead${done === 1 ? '' : 's'} into prospecting sequences.`,
      )
    } finally {
      setBulkEnrolling(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Status updates automatically when you enroll leads or complete sequences.
          </p>
          {importMessage && (
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
              {importMessage}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search leads..."
              className="w-64 pl-8"
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleCSVUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            disabled={importing}
          >
            <Upload className="h-3.5 w-3.5" />
            {importing ? 'Verifying…' : 'Bulk CSV'}
          </Button>
          <Button onClick={() => onNew('lead')}>+ Add lead</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {LEAD_BUCKETS.map((bucket) => (
          <button
            key={bucket.id}
            onClick={() => setFilter(bucket.id)}
            className={`rounded-xl border bg-card p-3 text-left shadow-sm transition hover:bg-accent ${
              filter === bucket.id ? 'ring-2 ring-ring' : ''
            }`}
          >
            <div className="text-xs text-muted-foreground">{bucket.label}</div>
            <div className="mt-1 text-2xl font-semibold">
              {countLeadsByBucket(crm.leads, bucket.id)}
            </div>
            {bucket.id !== 'all' && (
              <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{bucket.description}</div>
            )}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {selectedCount > 0
                ? `${selectedCount} selected`
                : `${filtered.length} lead${filtered.length === 1 ? '' : 's'} in view`}
            </p>
            <div className="flex flex-wrap gap-2">
              {enrollableFiltered.length > 0 && (
                <Button
                  onClick={bulkEnroll}
                  size="sm"
                  disabled={bulkBusy || enrolling !== null || selectedEnrollableCount === 0}
                >
                  {bulkEnrolling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Enroll selected ({selectedEnrollableCount})
                </Button>
              )}
              <Button
                onClick={requestBulkDelete}
                size="sm"
                variant="destructive"
                disabled={bulkBusy || enrolling !== null || selectedCount === 0}
              >
                {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete selected ({selectedCount})
              </Button>
            </div>
          </div>
        )}
        {filtered.length > 0 ? (
          <div className="max-h-[min(26rem,52vh)] overflow-x-hidden overflow-y-auto">
            <table className="w-full table-fixed caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-10 bg-card [&_th]:bg-card [&_th]:shadow-[inset_0_-1px_0_hsl(var(--border))]">
                <TableRow>
                  <TableHead className="w-10 px-2">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      disabled={bulkBusy}
                      aria-label="Select all leads in view"
                    />
                  </TableHead>
                  <TableHead className="w-[24%]">Lead</TableHead>
                  <TableHead className="w-[16%]">Company</TableHead>
                  <TableHead className="w-[10%]">Rank</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                  <TableHead className="w-[12%]">Source</TableHead>
                  <TableHead className="w-[10%]">Created</TableHead>
                  <TableHead className="w-[14%]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.map((lead) => {
                  const score = effectiveScore(lead)
                  const activeSequence = isEnrolled(lead.id)
                  const companyName = lead.company_name || '-'
                  const companyWebsite = lead.website || ''
                  return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(lead.id)}
                          onChange={() => toggleSelection(lead.id)}
                          disabled={bulkBusy}
                          aria-label={`Select ${lead.name}`}
                        />
                      </TableCell>
                      <TableCell className="max-w-0">
                        <div className="truncate font-medium" title={lead.name}>
                          {lead.name}
                        </div>
                        <div
                          className="truncate text-xs text-muted-foreground"
                          title={lead.title || undefined}
                        >
                          {lead.title || '—'}
                        </div>
                        {lead.email ? (
                          <div className="mt-1 flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-xs text-muted-foreground" title={lead.email}>
                              {lead.email}
                            </span>
                            {emailValidityBadge(lead)}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-0">
                        <div className="truncate" title={companyName !== '-' ? companyName : undefined}>
                          {companyName}
                        </div>
                        {companyWebsite ? (
                          <div className="truncate text-xs text-muted-foreground" title={companyWebsite}>
                            {companyWebsite}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge className={score.rank_tier === 'high' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}>
                            {score.rank_tier}
                          </Badge>
                          <span className="text-sm font-medium tabular-nums">{score.overall_score}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLE[lead.status]}>{lead.status}</Badge>
                      </TableCell>
                      <TableCell className="max-w-0">
                        <div className="truncate text-muted-foreground" title={lead.source}>
                          {lead.source}
                        </div>
                        <div className="truncate text-xs capitalize text-muted-foreground">
                          {lead.ingestion_source}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-0 truncate text-muted-foreground">
                        {formatDate(lead.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {activeSequence ? (
                            <Badge className="bg-blue-100 text-blue-700">Enrolled</Badge>
                          ) : (
                            <Button
                              onClick={() => enrollLead(lead.id)}
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={bulkBusy || enrolling === lead.id}
                            >
                              {enrolling === lead.id ? '…' : 'Enroll'}
                            </Button>
                          )}
                          <Button
                            onClick={() => requestDeleteLead(lead.id, lead.name)}
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-destructive"
                            disabled={bulkBusy}
                            aria-label={`Delete ${lead.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-muted-foreground">No leads found.</div>
        )}
        {filtered.length > 0 && (
          <div className="flex flex-col gap-2 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="shrink-0 text-sm text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length}
            </p>
            <Pagination className={cn('mx-0 w-auto shrink-0 justify-end')}>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  />
                </PaginationItem>
                {getPageNumbers(page, pageCount).map((pageNum, i) => (
                  <PaginationItem key={`${pageNum}-${i}`}>
                    {pageNum === 'ellipsis' ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        isActive={pageNum === page}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={page === pageCount}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>

      {deleteConfirm && (
        <DeleteConfirmDialog
          confirm={deleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}

type DeleteConfirm =
  | { type: 'single'; id: string; name: string }
  | { type: 'bulk'; ids: string[]; names: string[] }

function DeleteConfirmDialog({
  confirm,
  onCancel,
  onConfirm,
}: {
  confirm: DeleteConfirm
  onCancel: () => void
  onConfirm: () => void
}) {
  const isBulk = confirm.type === 'bulk'
  const count = isBulk ? confirm.ids.length : 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-soft">
        <h2 className="text-base font-semibold">
          Delete {count === 1 ? 'lead' : `${count} leads`}?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isBulk ? (
            <>
              This will permanently remove{' '}
              <span className="font-medium text-foreground">{count} leads</span>
              {confirm.names.length <= 3 ? (
                <> ({confirm.names.join(', ')})</>
              ) : (
                <> (including {confirm.names.slice(0, 2).join(', ')}, and {count - 2} more)</>
              )}
              . This cannot be undone.
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">{confirm.name}</span> will be
              permanently removed. This cannot be undone.
            </>
          )}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel} variant="outline" size="sm">
            Cancel
          </Button>
          <Button onClick={onConfirm} variant="destructive" size="sm">
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

function effectiveScore(lead: Parameters<typeof scoreLead>[0]) {
  if (lead.overall_score && lead.rank_tier) {
    return {
      interest_score: lead.interest_score ?? 0,
      decision_maker_score: lead.decision_maker_score ?? 0,
      fit_score: lead.fit_score ?? 0,
      overall_score: lead.overall_score,
      rank_tier: lead.rank_tier,
      pain_theme: lead.pain_theme ?? 'scalability',
    }
  }

  return scoreLead(lead)
}
