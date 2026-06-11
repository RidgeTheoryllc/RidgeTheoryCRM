'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Loader2, Search, Trash2, Upload } from 'lucide-react'
import type { CRMStore } from '@/hooks/useCRM'
import { useImportExport } from '@/hooks/useImportExport'
import { createCSVMapping, parseCSV } from '@/lib/csv'
import { scoreLead } from '@/lib/leadScoring'
import type { LeadStatus } from '@/types'
import { LEAD_BUCKETS, countLeadsByBucket, matchesLeadBucket, type LeadBucket } from '@/lib/leadStatus'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/atoms'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const STATUS_STYLE: Record<LeadStatus, string> = {
  Generated: 'bg-slate-100 text-slate-700',
  Augmented: 'bg-blue-100 text-blue-700',
  Cleaned: 'bg-teal-100 text-teal-700',
  Entered: 'bg-indigo-100 text-indigo-700',
  Prospecting: 'bg-amber-100 text-amber-700',
  Qualified: 'bg-green-100 text-green-700',
  Disqualified: 'bg-red-100 text-red-700',
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [importMessage, setImportMessage] = useState<string | null>(null)
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
          ? `Imported ${imported} lead${imported === 1 ? '' : 's'} from ${file.name}.`
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

  const enrollableFiltered = filtered.filter((lead) => !isEnrolled(lead.id))
  const selectedEnrollableCount = enrollableFiltered.filter((lead) => selectedIds.has(lead.id)).length
  const allEnrollableSelected = enrollableFiltered.length > 0
    && enrollableFiltered.every((lead) => selectedIds.has(lead.id))

  function toggleSelectAll() {
    if (allEnrollableSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        enrollableFiltered.forEach((lead) => next.delete(lead.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        enrollableFiltered.forEach((lead) => next.add(lead.id))
        return next
      })
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
            {importing ? 'Importing...' : 'Bulk CSV'}
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
        {enrollableFiltered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {selectedIds.size > 0
                ? `${selectedEnrollableCount} selected to enroll`
                : `${enrollableFiltered.length} lead${enrollableFiltered.length === 1 ? '' : 's'} ready to enroll`}
            </p>
            <Button
              onClick={bulkEnroll}
              size="sm"
              disabled={bulkEnrolling || enrolling !== null || selectedEnrollableCount === 0}
            >
              {bulkEnrolling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Enroll selected ({selectedEnrollableCount})
            </Button>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                {enrollableFiltered.length > 0 && (
                  <input
                    type="checkbox"
                    checked={allEnrollableSelected}
                    onChange={toggleSelectAll}
                    disabled={bulkEnrolling}
                    aria-label="Select all enrollable leads"
                  />
                )}
              </TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Rank</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Ingestion</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Sequence</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((lead) => {
              const score = effectiveScore(lead)
              const activeSequence = isEnrolled(lead.id)
              const canEnroll = !activeSequence
              return (
              <TableRow key={lead.id}>
                <TableCell>
                  {canEnroll ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleSelection(lead.id)}
                      disabled={bulkEnrolling}
                      aria-label={`Select ${lead.name}`}
                    />
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{lead.name}</div>
                  <div className="text-xs text-muted-foreground">{lead.title || lead.email}</div>
                </TableCell>
                <TableCell>
                  <div>{lead.company_name || '-'}</div>
                  <div className="text-xs text-muted-foreground">{lead.website}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge className={score.rank_tier === 'high' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}>
                      {score.rank_tier}
                    </Badge>
                    <span className="text-sm font-medium">{score.overall_score}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_STYLE[lead.status]}>{lead.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{lead.source}</TableCell>
                <TableCell className="capitalize text-muted-foreground">{lead.ingestion_source}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(lead.created_at)}</TableCell>
                <TableCell>
                  {activeSequence ? (
                    <Badge className="bg-blue-100 text-blue-700">Enrolled</Badge>
                  ) : (
                    <Button
                      onClick={() => enrollLead(lead.id)}
                      variant="outline"
                      size="sm"
                      disabled={bulkEnrolling || enrolling === lead.id}
                    >
                      {enrolling === lead.id ? 'Enrolling...' : 'Enroll'}
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    onClick={() => crm.deleteLead(lead.id)}
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No leads found.</div>
        )}
      </Card>
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
