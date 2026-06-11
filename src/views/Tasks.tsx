'use client'

import { useState } from 'react'
import { Search, Trash2 } from 'lucide-react'
import type { CRMStore } from '@/hooks/useCRM'
import { formatDate, isOverdue } from '@/lib/utils'
import { PriorityBadge } from '@/components/ui/badges'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'open' | 'today' | 'overdue' | 'done'

export function Tasks({ crm, onNew }: { crm: CRMStore; onNew: (t: string) => void }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')

  const today = new Date().toDateString()

  const filtered = crm.tasks
    .filter((t) => {
      const matchQ = !q || t.title.toLowerCase().includes(q.toLowerCase())
      if (!matchQ) return false
      if (filter === 'open') return t.status === 'open'
      if (filter === 'done') return t.status === 'done'
      if (filter === 'overdue') return t.status === 'open' && isOverdue(t.due_date)
      if (filter === 'today') return t.status === 'open' && t.due_date && new Date(t.due_date).toDateString() === today
      return true
    })
    .sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1
      if (b.status === 'done' && a.status !== 'done') return -1
      return new Date(a.due_date || '9999').getTime() - new Date(b.due_date || '9999').getTime()
    })

  const openCount = crm.tasks.filter((t) => t.status === 'open').length

  const FILTERS: Filter[] = ['all', 'open', 'today', 'overdue', 'done']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">{openCount} open follow-ups.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks..."
              className="w-64 pl-8"
            />
          </div>
          <Button onClick={() => onNew('task')}>
            + Add task
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-4">
        {FILTERS.map((f) => (
          <Button
            key={f}
            onClick={() => setFilter(f)}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            className="capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>Task</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Linked to</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => {
              const deal = t.deal_id ? crm.deals.find((d) => d.id === t.deal_id) : null
              const contact = t.contact_id ? crm.contacts.find((c) => c.id === t.contact_id) : null
              const overdue = isOverdue(t.due_date) && t.status === 'open'

              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={t.status === 'done'}
                      onChange={() => crm.updateTask(t.id, { status: t.status === 'done' ? 'open' : 'done' })}
                    />
                  </TableCell>
                  <TableCell className={cn(t.status === 'done' && 'line-through text-muted-foreground')}>
                    {t.title}
                  </TableCell>
                  <TableCell className={cn('text-sm', overdue ? 'text-destructive' : 'text-muted-foreground')}>
                    {t.due_date ? formatDate(t.due_date) : '-'}
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={t.priority} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {deal?.title ?? contact?.name ?? '-'}
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={() => crm.deleteTask(t.id)}
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
          <div className="p-6 text-center text-sm text-muted-foreground">No tasks found.</div>
        )}
      </Card>
    </div>
  )
}
