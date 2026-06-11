'use client'

import { useState, useRef } from 'react'
import { X, Edit2, Trash2, Plus } from 'lucide-react'
import type { CRMStore } from '@/hooks/useCRM'
import { formatCurrency, formatDate, isOverdue } from '@/lib/utils'
import { Avatar, ProgressBar } from '@/components/ui/atoms'
import { StageBadge, ActivityBadge, PriorityBadge } from '@/components/ui/badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { DealForm, ActivityForm, TaskForm } from '@/components/modals'
import { STAGES, STAGE_COLOR } from '@/types'
import type { DealStage } from '@/types'
import { cn } from '@/lib/utils'

export function Pipeline({ crm, onNew }: { crm: CRMStore; onNew: (t: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [loggingActivity, setLoggingActivity] = useState(false)
  const [addingTask, setAddingTask] = useState(false)
  const [tab, setTab] = useState<'activity' | 'tasks'>('activity')
  const [dragOver, setDragOver] = useState<string | null>(null)
  const dragId = useRef<string | null>(null)

  const deal = crm.deals.find((d) => d.id === selected)
  const dealActs = crm.activities
    .filter((a) => a.deal_id === selected)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const dealTasks = crm.tasks.filter((t) => t.deal_id === selected)

  return (
    <div className="relative h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">Drag deals through each stage.</p>
        </div>
        <Button onClick={() => onNew('deal')}>
          + New deal
        </Button>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start">
        {STAGES.map((stage) => {
          const stageDeals = crm.deals.filter((d) => d.stage === stage)
          const stageValue = stageDeals.reduce((s, d) => s + d.value, 0)

          return (
            <div
              key={stage}
              className={cn(
                'min-w-[260px] max-w-[260px] flex flex-col gap-3 rounded-xl border bg-muted/30 p-3',
                dragOver === stage && 'opacity-80',
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(stage) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => {
                if (dragId.current) crm.moveDealStage(dragId.current, stage)
                dragId.current = null
                setDragOver(null)
              }}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-1">
                <StageBadge stage={stage} />
                <span className="text-xs font-medium text-muted-foreground">
                  {stageDeals.length} · {formatCurrency(stageValue)}
                </span>
              </div>

              {/* Cards */}
              {stageDeals.map((d) => {
                const co = crm.companies.find((c) => c.id === d.company_id)
                const ct = crm.contacts.find((c) => c.id === d.contact_id)
                return (
                  <Card
                    key={d.id}
                    draggable
                    onDragStart={() => { dragId.current = d.id }}
                    onClick={() => setSelected(d.id)}
                    className={cn(
                      'cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-soft',
                      dragOver === stage && 'border-dashed',
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="text-sm font-medium leading-snug mb-1.5">{d.title}</div>
                      {co && <div className="text-xs text-muted-foreground mb-2">{co.name}</div>}
                      <div className="text-lg font-semibold mb-3">{formatCurrency(d.value)}</div>
                      <div className="flex items-center justify-between mb-3">
                        {ct ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar name={ct.name} size={22} />
                            <span className="text-xs text-muted-foreground">{ct.name}</span>
                          </div>
                        ) : <span />}
                        {d.close_date && (
                          <span className={cn('text-xs', isOverdue(d.close_date) ? 'text-destructive' : 'text-muted-foreground')}>
                            {formatDate(d.close_date)}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground mb-1">{d.probability}% probability</div>
                        <ProgressBar value={d.probability} />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

              {/* Drop zone hint */}
              {dragOver === stage && (
                <div className="border-2 border-dashed border-border rounded-lg h-16 flex items-center justify-center text-xs text-muted-foreground">
                  Drop here
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Sheet open={Boolean(deal)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <SheetContent>
          {deal && (
            <>
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="font-medium text-sm">{deal.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {formatCurrency(deal.value)} · <StageBadge stage={deal.stage} />
              </div>
            </div>
            <div className="flex gap-1.5">
              <Button onClick={() => setEditing(true)} variant="ghost" size="icon"><Edit2 className="h-3.5 w-3.5" /></Button>
              <Button onClick={() => setSelected(null)} variant="ghost" size="icon"><X className="h-3.5 w-3.5" /></Button>
            </div>
          </div>

          {deal.close_date && (
            <div className="text-xs text-muted-foreground mb-1">
              Close date: {formatDate(deal.close_date)}
            </div>
          )}
          {deal.notes && (
            <div className="text-xs text-muted-foreground bg-secondary rounded-md p-2.5 mt-2 mb-3 leading-relaxed">
              {deal.notes}
            </div>
          )}

          <div className="text-xs text-muted-foreground space-y-1 mb-4">
            {deal.company_id && <div>🏢 {crm.companies.find((c) => c.id === deal.company_id)?.name}</div>}
            {deal.contact_id && <div>👤 {crm.contacts.find((c) => c.id === deal.contact_id)?.name}</div>}
          </div>

          {/* Stage mover */}
          <div className="mb-4">
            <div className="text-[11px] text-muted-foreground mb-2">Move stage</div>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <Button
                  key={s}
                  onClick={() => crm.moveDealStage(deal.id, s)}
                  variant={deal.stage === s ? 'default' : 'outline'}
                  size="sm"
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b mb-4">
            {(['activity', 'tasks'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3.5 py-2 text-xs capitalize border-b-2 -mb-px transition-colors ${
                  tab === t ? 'border-foreground font-medium' : 'border-transparent text-muted-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'activity' && (
            <div>
              <Button
                onClick={() => setLoggingActivity(true)}
                variant="outline"
                size="sm"
                className="mb-3"
              >
                <Plus className="h-3 w-3" /> Log activity
              </Button>
              {dealActs.map((a) => (
                <div key={a.id} className="flex gap-2.5 mb-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <ActivityBadge type={a.type} />
                    <div className="text-xs text-muted-foreground mt-1">{a.body}</div>
                    <div className="text-[11px] text-muted-foreground/60">{formatDate(a.timestamp)}</div>
                  </div>
                </div>
              ))}
              {dealActs.length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
            </div>
          )}

          {tab === 'tasks' && (
            <div>
              <Button
                onClick={() => setAddingTask(true)}
                variant="outline"
                size="sm"
                className="mb-3"
              >
                <Plus className="h-3 w-3" /> Add task
              </Button>
              {dealTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 py-2.5 border-b last:border-0">
                  <input
                    type="checkbox"
                    checked={t.status === 'done'}
                    onChange={() => crm.updateTask(t.id, { status: t.status === 'done' ? 'open' : 'done' })}
                  />
                  <div className="flex-1">
                    <div className={`text-sm ${t.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{t.title}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(t.due_date)}</div>
                  </div>
                  <PriorityBadge priority={t.priority} />
                </div>
              ))}
              {dealTasks.length === 0 && <p className="text-xs text-muted-foreground">No tasks yet.</p>}
            </div>
          )}

          <div className="mt-5 pt-4 border-t">
            <Button
              onClick={() => { crm.deleteDeal(deal.id); setSelected(null) }}
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete deal
            </Button>
          </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {editing && deal && (
        <DealForm
          title="Edit deal"
          initial={deal}
          companies={crm.companies}
          contacts={crm.contacts}
          onSave={(v) => crm.updateDeal(deal.id, v)}
          onClose={() => setEditing(false)}
        />
      )}
      {loggingActivity && selected && (
        <ActivityForm dealId={selected} onSave={(v) => crm.addActivity(v)} onClose={() => setLoggingActivity(false)} />
      )}
      {addingTask && selected && (
        <TaskForm
          initial={{ deal_id: selected }}
          deals={crm.deals}
          contacts={crm.contacts}
          onSave={(v) => crm.addTask(v)}
          onClose={() => setAddingTask(false)}
        />
      )}
    </div>
  )
}
