'use client'

import { useState } from 'react'
import { Search, Edit2, Trash2, X } from 'lucide-react'
import type { CRMStore } from '@/hooks/useCRM'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Avatar } from '@/components/ui/atoms'
import { StatusBadge, StageBadge, TagBadge } from '@/components/ui/badges'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CompanyForm } from '@/components/modals'

export function Companies({ crm, onNew }: { crm: CRMStore; onNew: (t: string) => void }) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<'contacts' | 'deals' | 'activity'>('contacts')

  const filtered = crm.companies.filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    c.industry?.toLowerCase().includes(q.toLowerCase()),
  )

  const company = crm.companies.find((c) => c.id === selected)
  const compContacts = crm.contacts.filter((c) => c.company_id === selected)
  const compDeals = crm.deals.filter((d) => d.company_id === selected)
  const compActs = crm.activities
    .filter((a) => compDeals.some((d) => d.id === a.deal_id))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="relative h-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground mt-1">{crm.companies.length} accounts in your workspace.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search companies..."
              className="w-64 pl-8"
            />
          </div>
          <Button onClick={() => onNew('company')}>
            + Add
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {['Company', 'Industry', 'Size', 'Contacts', 'Pipeline', 'Tags'].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((co) => {
              const cntCount = crm.contacts.filter((c) => c.company_id === co.id).length
              const pipe = crm.deals
                .filter((d) => d.company_id === co.id && d.stage !== 'Closed Won' && d.stage !== 'Closed Lost')
                .reduce((s, d) => s + d.value, 0)
              return (
                <TableRow
                  key={co.id}
                  onClick={() => setSelected(co.id)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={co.name} size={28} />
                      <span className="font-medium">{co.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{co.industry}</TableCell>
                  <TableCell className="text-muted-foreground">{co.size}</TableCell>
                  <TableCell>{cntCount}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(pipe)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(co.tags || []).map((t) => <TagBadge key={t} tag={t} />)}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No companies found.</div>
        )}
      </Card>

      <Sheet open={Boolean(company)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <SheetContent>
          {company && (
            <>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={company.name} size={36} />
              <div>
                <div className="font-medium">{company.name}</div>
                <div className="text-xs text-muted-foreground">{company.industry} · {company.size}</div>
              </div>
            </div>
            <div className="flex gap-1.5">
              <Button onClick={() => setEditing(true)} variant="ghost" size="icon"><Edit2 className="h-3.5 w-3.5" /></Button>
              <Button onClick={() => setSelected(null)} variant="ghost" size="icon"><X className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          {company.website && (
            <a href={`https://${company.website}`} className="text-xs text-blue-600 hover:underline">{company.website}</a>
          )}
          <div className="mt-2 mb-3 flex flex-wrap gap-1">
            {(company.tags || []).map((t) => <TagBadge key={t} tag={t} />)}
          </div>

          {/* Tabs */}
          <div className="flex border-b mb-4">
            {(['contacts', 'deals', 'activity'] as const).map((t) => (
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

          {tab === 'contacts' && (
            <div>
              {compContacts.map((c) => (
                <div key={c.id} className="flex items-center gap-2.5 py-2.5 border-b last:border-0">
                  <Avatar name={c.name} size={28} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.title}</div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
              {compContacts.length === 0 && <p className="text-xs text-muted-foreground mt-2">No contacts yet.</p>}
            </div>
          )}

          {tab === 'deals' && (
            <div>
              {compDeals.map((d) => (
                <div key={d.id} className="py-2.5 border-b last:border-0">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{d.title}</span>
                    <span className="text-sm font-medium">{formatCurrency(d.value)}</span>
                  </div>
                  <div className="mt-1"><StageBadge stage={d.stage} /></div>
                </div>
              ))}
              {compDeals.length === 0 && <p className="text-xs text-muted-foreground mt-2">No deals yet.</p>}
            </div>
          )}

          {tab === 'activity' && (
            <div>
              {compActs.map((a) => (
                <div key={a.id} className="flex gap-2.5 mb-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-medium capitalize">{a.type}</div>
                    <div className="text-xs text-muted-foreground">{a.body}</div>
                    <div className="text-[11px] text-muted-foreground/60">{formatDate(a.timestamp)}</div>
                  </div>
                </div>
              ))}
              {compActs.length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
            </div>
          )}

          <div className="mt-5 pt-4 border-t">
            <Button
              onClick={() => { crm.deleteCompany(company.id); setSelected(null) }}
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete company
            </Button>
          </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {editing && company && (
        <CompanyForm
          title="Edit company"
          initial={company}
          onSave={(v) => crm.updateCompany(company.id, v)}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
