'use client'

import { useMemo, useState } from 'react'
import type { CRMStore } from '@/hooks/useCRM'
import { formatCurrency, formatDate, isOverdue } from '@/lib/utils'
import { NewDropdown } from '@/components/modals'
import { ProgressBar } from '@/components/ui/atoms'
import { PriorityBadge } from '@/components/ui/badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { STAGES } from '@/types'

interface DashboardProps {
  crm: CRMStore
  onNav: (page: string) => void
  onNew: (type: string) => void
}

export function Dashboard({ crm, onNav, onNew }: DashboardProps) {
  const { deals, tasks, activities, contacts } = crm
  const [showNew, setShowNew] = useState(false)

  const openDeals = useMemo(() =>
    deals.filter((d) => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost'),
    [deals],
  )

  const pipeline = openDeals.reduce((s, d) => s + d.value, 0)
  const weighted = openDeals.reduce((s, d) => s + d.value * d.probability / 100, 0)

  const now = new Date()
  const closingThisMonth = openDeals.filter((d) => {
    if (!d.close_date) return false
    const c = new Date(d.close_date)
    return c.getMonth() === now.getMonth() && c.getFullYear() === now.getFullYear()
  })

  const overdueCount = tasks.filter((t) => t.status === 'open' && isOverdue(t.due_date)).length
  const upcomingTasks = tasks
    .filter((t) => t.status === 'open' && !isOverdue(t.due_date))
    .sort((a, b) => new Date(a.due_date || '9999').getTime() - new Date(b.due_date || '9999').getTime())
    .slice(0, 5)

  const recentActivities = [...activities]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6)

  const stageTotals = STAGES.slice(0, 4).map((s) => ({
    stage: s,
    value: deals.filter((d) => d.stage === s).reduce((acc, d) => acc + d.value, 0),
    count: deals.filter((d) => d.stage === s).length,
  }))
  const maxStageVal = Math.max(...stageTotals.map((s) => s.value), 1)

  const leadSourceCounts = contacts.reduce<Record<string, number>>((acc, c) => {
    acc[c.lead_source] = (acc[c.lead_source] || 0) + 1
    return acc
  }, {})

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Here&apos;s where your revenue motion stands today.</p>
        </div>
        <div className="relative">
          <Button onClick={() => setShowNew((v) => !v)}>
            + New
          </Button>
          {showNew && (
            <NewDropdown
              onSelect={onNew}
              onClose={() => setShowNew(false)}
              className="bottom-auto left-auto right-0 top-11"
            />
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Pipeline value', value: formatCurrency(pipeline) },
          { label: 'Weighted forecast', value: formatCurrency(weighted) },
          { label: 'Closing this month', value: `${closingThisMonth.length} deals` },
          { label: 'Overdue tasks', value: String(overdueCount), warn: overdueCount > 0 },
        ].map(({ label, value, warn }) => (
          <Card
            key={label}
            className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-soft"
            onClick={() => label === 'Overdue tasks' && onNav('tasks')}
          >
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-semibold tracking-tight ${warn ? 'text-destructive' : ''}`}>
                {value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Pipeline by stage */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline by stage</CardTitle>
            <CardDescription>Open opportunity value by sales stage.</CardDescription>
          </CardHeader>
          <CardContent>
          {stageTotals.map((s) => (
            <div key={s.stage} className="mb-4 last:mb-0">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted-foreground">{s.stage} ({s.count})</span>
                <span className="font-medium">{formatCurrency(s.value)}</span>
              </div>
              <ProgressBar value={(s.value / maxStageVal) * 100} />
            </div>
          ))}
          </CardContent>
        </Card>

        {/* Lead sources */}
        <Card>
          <CardHeader>
            <CardTitle>Lead sources</CardTitle>
            <CardDescription>Where your active contacts came from.</CardDescription>
          </CardHeader>
          <CardContent>
          {Object.entries(leadSourceCounts).map(([src, count]) => (
            <div key={src} className="flex items-center gap-3 mb-3">
              <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{src}</span>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round((count / contacts.length) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium w-4 text-right">{count}</span>
            </div>
          ))}
          {Object.keys(leadSourceCounts).length === 0 && (
            <p className="text-xs text-muted-foreground">No contacts yet.</p>
          )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Upcoming tasks */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Upcoming tasks</CardTitle>
              <CardDescription>Next follow-ups on your schedule.</CardDescription>
            </div>
            <Button onClick={() => onNav('tasks')} variant="ghost" size="sm">
              View all
            </Button>
          </CardHeader>
          <CardContent>
          {upcomingTasks.length === 0 && <p className="text-xs text-muted-foreground">No upcoming tasks.</p>}
          {upcomingTasks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border p-3 mb-2.5">
              <input
                type="checkbox"
                checked={t.status === 'done'}
                onChange={() => crm.updateTask(t.id, { status: 'done' })}
                className="flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{t.title}</div>
                <div className={`text-xs ${isOverdue(t.due_date) ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {t.due_date ? formatDate(t.due_date) : 'No date'}
                </div>
              </div>
              <PriorityBadge priority={t.priority} />
            </div>
          ))}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest sales touches across deals.</CardDescription>
          </CardHeader>
          <CardContent>
          {recentActivities.length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
          {recentActivities.map((a) => {
            const deal = crm.deals.find((d) => d.id === a.deal_id)
            const dotColor = a.type === 'call' ? 'bg-blue-500' : a.type === 'email' ? 'bg-teal-500' : a.type === 'meeting' ? 'bg-purple-500' : 'bg-gray-300'
            return (
              <div key={a.id} className="flex gap-2.5 mb-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{deal?.title ?? 'Unknown deal'}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.body}</div>
                  <div className="text-[11px] text-muted-foreground/60">{formatDate(a.timestamp)} · {a.type}</div>
                </div>
              </div>
            )
          })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
