'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, History } from 'lucide-react'
import type { CRMStore } from '@/hooks/useCRM'
import type { Lead, SequenceTask } from '@/types'
import { formatDate } from '@/lib/utils'
import { buildLeadSequenceTrackingRows } from '@/lib/engagementSequence'
import { Badge } from '@/components/ui/atoms'
import { EngagementBadge } from '@/components/outreach/EngagementBadge'
import { SequenceProgressFlow } from '@/components/outreach/SequenceProgressFlow'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function ProspectingHistory({ crm }: { crm: CRMStore }) {
  const trackingSequenceIds = useMemo(
    () =>
      new Set(
        crm.prospectingSequences
          .filter((s) => s.tier === 'engagement' && (s.status === 'active' || s.status === 'completed'))
          .map((s) => s.id),
      ),
    [crm.prospectingSequences],
  )

  const trackingTasks = useMemo(
    () => crm.sequenceTasks.filter((t) => trackingSequenceIds.has(t.sequence_id)),
    [crm.sequenceTasks, trackingSequenceIds],
  )

  const trackingRows = useMemo(
    () => buildLeadSequenceTrackingRows(crm.prospectingSequences, trackingTasks),
    [crm.prospectingSequences, trackingTasks],
  )

  function isAutoSendingSequence(sequenceId: string) {
    return crm.sequenceTasks
      .filter((task) => task.sequence_id === sequenceId)
      .some((task) => crm.autoSendingTaskIds.includes(task.id))
  }

  function getSequenceEngagement(lead: Lead | undefined, tasks: SequenceTask[]) {
    if (!lead) return <span className="text-muted-foreground">—</span>

    const emailTasks = tasks
      .filter((task) => task.channel === 'email' && (task.status === 'sent' || task.opened_at))
      .sort((a, b) => a.day_number - b.day_number)

    const withClick = [...emailTasks].reverse().find((task) => task.clicked_at)
    if (withClick) return <EngagementBadge variant="task" task={withClick} />

    const withOpen = [...emailTasks].reverse().find((task) => task.opened_at)
    if (withOpen) return <EngagementBadge variant="task" task={withOpen} />

    const sent = [...emailTasks].reverse().find((task) => task.status === 'sent')
    if (sent) return <EngagementBadge variant="task" task={sent} />

    return <EngagementBadge variant="lead" lead={lead} />
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/prospecting"
            className="mb-2 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Prospecting
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Sent &amp; tracking</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One row per lead. Checkmarks show completed steps; Pending is the current step in the sequence.
          </p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <History className="h-4 w-4" />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {trackingRows.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center">
              <p className="font-medium">No sequence history yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Enroll leads from the Leads page to start tracking outreach here.
              </p>
              <Link
                href="/prospecting"
                className="mt-4 inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Go to Prospecting
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Sequence progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last activity</TableHead>
                    <TableHead>Engagement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trackingRows.map((row) => {
                    const lead = crm.leads.find((item) => item.id === row.leadId)
                    return (
                      <TableRow key={row.sequenceId}>
                        <TableCell>
                          <div className="font-medium">{lead?.name ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">{lead?.company_name || '—'}</div>
                        </TableCell>
                        <TableCell>
                          <SequenceProgressFlow
                            steps={row.stepProgress}
                            isComplete={row.isComplete}
                            autoSending={isAutoSendingSequence(row.sequenceId)}
                            compact
                          />
                        </TableCell>
                        <TableCell>
                          {row.isComplete ? (
                            <Badge className="bg-green-100 text-green-700">Done</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800">In progress</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.latestActivityAt ? formatDate(row.latestActivityAt) : '—'}
                        </TableCell>
                        <TableCell>
                          {getSequenceEngagement(lead, row.tasks)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
