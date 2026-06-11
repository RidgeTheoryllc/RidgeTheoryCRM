'use client'

import { useState } from 'react'
import { Building2, Edit2, Link, Mail, Phone, Plus, Search, Trash2, X } from 'lucide-react'
import type { CRMStore } from '@/hooks/useCRM'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Avatar } from '@/components/ui/atoms'
import { StatusBadge, StageBadge, PriorityBadge, ActivityBadge, TagBadge } from '@/components/ui/badges'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ContactForm, ActivityForm } from '@/components/modals'
import { CONTACT_STATUSES } from '@/types'
import type { ContactStatus } from '@/types'

export function Contacts({ crm, onNew }: { crm: CRMStore; onNew: (t: string) => void }) {
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [loggingActivity, setLoggingActivity] = useState<string | null>(null)
  const [tab, setTab] = useState<'deals' | 'activity' | 'tasks'>('deals')

  const filtered = crm.contacts.filter((c) => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    const matchQ = !q || c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.email?.toLowerCase().includes(q.toLowerCase()) ||
      c.title?.toLowerCase().includes(q.toLowerCase())
    return matchStatus && matchQ
  })

  const contact = crm.contacts.find((c) => c.id === selected)
  const company = contact ? crm.companies.find((co) => co.id === contact.company_id) : null
  const contactDeals = crm.deals.filter((d) => d.contact_id === selected)
  const contactActs = crm.activities
    .filter((a) => contactDeals.some((d) => d.id === a.deal_id))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const contactTasks = crm.tasks.filter((t) => t.contact_id === selected)

  return (
    <div className="relative h-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">{crm.contacts.length} people across your pipeline.</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search contacts..."
              className="w-64 pl-8"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ContactStatus | 'all')}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          >
            <option value="all">All statuses</option>
            {CONTACT_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <Button onClick={() => onNew('contact')}>
            + Add
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {['Name', 'Company', 'Title', 'Email', 'Status', 'Lead source'].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => {
              const co = crm.companies.find((x) => x.id === c.company_id)
              return (
                <TableRow
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.name} size={28} />
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{co?.name ?? '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.title ?? '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? '-'}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{c.lead_source}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No contacts found.</div>
        )}
      </Card>

      <Sheet open={Boolean(contact)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <SheetContent>
          {contact && (
            <>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={contact.name} size={44} />
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold tracking-tight">{contact.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                  {contact.title && <span>{contact.title}</span>}
                  {company && (
                    <>
                      <span className="text-muted-foreground/50">•</span>
                      <span className="font-medium text-primary">{company.name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-1">
              <Button onClick={() => setEditing(true)} variant="ghost" size="icon" title="Edit contact">
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button onClick={() => setSelected(null)} variant="ghost" size="icon" title="Close">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            <StatusBadge status={contact.status} />
            {(contact.tags || []).map((t) => <TagBadge key={t} tag={t} />)}
          </div>

          <div className="my-5 space-y-2 rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
            {contact.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-primary" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-primary" />
                <span>{contact.phone}</span>
              </div>
            )}
            {contact.linked_in && (
              <div className="flex items-center gap-2">
                <Link className="h-3.5 w-3.5 text-primary" />
                <span className="truncate">{contact.linked_in}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span>Source: {contact.lead_source}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-5 flex border-b">
            {(['deals', 'activity', 'tasks'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`-mb-px px-4 py-2 text-sm capitalize transition-colors border-b-2 ${
                  tab === t ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'deals' && (
            <div className="space-y-3">
              {contactDeals.map((d) => (
                <div key={d.id} className="rounded-xl border bg-card p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-medium leading-snug">{d.title}</span>
                    <span className="text-sm font-semibold">{formatCurrency(d.value)}</span>
                  </div>
                  <div className="mt-1"><StageBadge stage={d.stage} /></div>
                </div>
              ))}
              {contactDeals.length === 0 && (
                <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                  No deals linked.
                </div>
              )}
            </div>
          )}

          {tab === 'activity' && (
            <div>
              <Button
                onClick={() => setLoggingActivity(contactDeals[0]?.id ?? null)}
                variant="outline"
                size="sm"
                className="mb-3"
              >
                <Plus className="h-3 w-3" /> Log activity
              </Button>
              {contactActs.map((a) => (
                <div key={a.id} className="flex gap-2.5 mb-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <ActivityBadge type={a.type} />
                    <div className="text-xs text-muted-foreground mt-1">{a.body}</div>
                    <div className="text-[11px] text-muted-foreground/60">{formatDate(a.timestamp)}</div>
                  </div>
                </div>
              ))}
              {contactActs.length === 0 && <p className="text-xs text-muted-foreground">No activity logged.</p>}
            </div>
          )}

          {tab === 'tasks' && (
            <div>
              {contactTasks.map((t) => (
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
              {contactTasks.length === 0 && <p className="text-xs text-muted-foreground">No tasks.</p>}
            </div>
          )}

          <div className="mt-6 border-t pt-4">
            <Button
              onClick={() => { crm.deleteContact(contact.id); setSelected(null) }}
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete contact
            </Button>
          </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {editing && contact && (
        <ContactForm
          title="Edit contact"
          initial={contact}
          companies={crm.companies}
          onSave={(v) => crm.updateContact(contact.id, v)}
          onClose={() => setEditing(false)}
        />
      )}
      {loggingActivity && (
        <ActivityForm
          dealId={loggingActivity}
          onSave={(v) => crm.addActivity(v)}
          onClose={() => setLoggingActivity(null)}
        />
      )}
    </div>
  )
}
