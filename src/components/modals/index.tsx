'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TagInput } from '@/components/ui/TagInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  INDUSTRIES, COMPANY_SIZES, CONTACT_STATUSES, LEAD_SOURCES,
  LEAD_INGESTION_SOURCES, LEAD_STATUSES,
  STAGES, STAGE_PROBABILITY, ACTIVITY_TYPES, TASK_PRIORITIES,
} from '@/types'
import type {
  Company, Contact, Deal, Lead, Task, Activity,
  Industry, CompanySize, ContactStatus, LeadSource,
  DealStage, ActivityType, LeadIngestionSource, LeadStatus, TaskPriority,
} from '@/types'
import type { CRMStore } from '@/hooks/useCRM'

// ── Shared Modal Shell ─────────────────────────────────────────
function Modal({
  title,
  onClose,
  children,
  width = 480,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  width?: number
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-card rounded-xl border shadow-soft overflow-y-auto max-h-[85vh] p-6"
        style={{ width }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button onClick={onClose} variant="ghost" size="icon">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-input rounded-md px-3 py-2 text-sm bg-background shadow-sm focus:ring-2 focus:ring-ring'

function Inp(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <Input {...props} className={props.className} />
}

function Sel({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    >
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  )
}

type SaveResult = void | Promise<unknown>

function Actions({ onClose, onSave }: { onClose: () => void; onSave: () => SaveResult }) {
  return (
    <div className="flex justify-end gap-2 mt-2">
      <Button onClick={onClose} variant="outline">
        Cancel
      </Button>
      <Button onClick={onSave}>
        Save
      </Button>
    </div>
  )
}

// ── Company Form ───────────────────────────────────────────────
interface CompanyFormProps {
  initial?: Partial<Company>
  onSave: (data: Omit<Company, 'id' | 'created_at'>) => SaveResult
  onClose: () => void
  title?: string
}

export function CompanyForm({ initial = {}, onSave, onClose, title = 'Add company' }: CompanyFormProps) {
  const [name, setName] = useState(initial.name ?? '')
  const [industry, setIndustry] = useState<Industry>(initial.industry ?? 'SaaS')
  const [website, setWebsite] = useState(initial.website ?? '')
  const [size, setSize] = useState<CompanySize>(initial.size ?? '11-50')
  const [tags, setTags] = useState<string[]>(initial.tags ?? [])

  async function save() {
    if (!name.trim()) return
    await onSave({ name, industry, website, size, tags })
    onClose()
  }

  return (
    <Modal title={title} onClose={onClose}>
      <Field label="Company name *"><Inp value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Industry"><Sel value={industry} onChange={(v) => setIndustry(v as Industry)} options={INDUSTRIES} /></Field>
        <Field label="Size"><Sel value={size} onChange={(v) => setSize(v as CompanySize)} options={COMPANY_SIZES} /></Field>
      </div>
      <Field label="Website"><Inp value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="acme.com" /></Field>
      <Field label="Tags"><TagInput value={tags} onChange={setTags} /></Field>
      <Actions onClose={onClose} onSave={save} />
    </Modal>
  )
}

// ── Contact Form ───────────────────────────────────────────────
interface ContactFormProps {
  initial?: Partial<Contact>
  companies: Company[]
  onSave: (data: Omit<Contact, 'id' | 'created_at'>) => SaveResult
  onClose: () => void
  title?: string
}

export function ContactForm({ initial = {}, companies, onSave, onClose, title = 'Add contact' }: ContactFormProps) {
  const [name, setName] = useState(initial.name ?? '')
  const [ctTitle, setCtTitle] = useState(initial.title ?? '')
  const [email, setEmail] = useState(initial.email ?? '')
  const [phone, setPhone] = useState(initial.phone ?? '')
  const [linkedIn, setLinkedIn] = useState(initial.linked_in ?? '')
  const [leadSource, setLeadSource] = useState<LeadSource>(initial.lead_source ?? 'LinkedIn')
  const [status, setStatus] = useState<ContactStatus>(initial.status ?? 'Lead')
  const [companyId, setCompanyId] = useState(initial.company_id ?? '')
  const [tags, setTags] = useState<string[]>(initial.tags ?? [])

  async function save() {
    if (!name.trim()) return
    await onSave({
      name, title: ctTitle, email, phone, linked_in: linkedIn,
      lead_source: leadSource, status, company_id: companyId || null, tags,
    })
    onClose()
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name *"><Inp value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" /></Field>
        <Field label="Title"><Inp value={ctTitle} onChange={(e) => setCtTitle(e.target.value)} placeholder="VP of Sales" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><Inp value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@co.com" /></Field>
        <Field label="Phone"><Inp value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 415..." /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={inputCls}>
            <option value="">— none —</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Status"><Sel value={status} onChange={(v) => setStatus(v as ContactStatus)} options={CONTACT_STATUSES} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Lead source"><Sel value={leadSource} onChange={(v) => setLeadSource(v as LeadSource)} options={LEAD_SOURCES} /></Field>
        <Field label="LinkedIn"><Inp value={linkedIn} onChange={(e) => setLinkedIn(e.target.value)} placeholder="linkedin.com/in/..." /></Field>
      </div>
      <Field label="Tags"><TagInput value={tags} onChange={setTags} /></Field>
      <Actions onClose={onClose} onSave={save} />
    </Modal>
  )
}

// ── Lead Form ──────────────────────────────────────────────────
interface LeadFormProps {
  initial?: Partial<Lead>
  onSave: (data: Omit<Lead, 'id' | 'created_at'>) => SaveResult
  onClose: () => void
  title?: string
}

export function LeadForm({ initial = {}, onSave, onClose, title = 'Add lead' }: LeadFormProps) {
  const [name, setName] = useState(initial.name ?? '')
  const [leadTitle, setLeadTitle] = useState(initial.title ?? '')
  const [email, setEmail] = useState(initial.email ?? '')
  const [phone, setPhone] = useState(initial.phone ?? '')
  const [companyName, setCompanyName] = useState(initial.company_name ?? '')
  const [website, setWebsite] = useState(initial.website ?? '')
  const [source, setSource] = useState<LeadSource>(initial.source ?? 'Other')
  const [ingestionSource, setIngestionSource] = useState<LeadIngestionSource>(initial.ingestion_source ?? 'manual')
  const [status, setStatus] = useState<LeadStatus>(initial.status ?? 'Generated')
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [tags, setTags] = useState<string[]>(initial.tags ?? [])

  async function save() {
    if (!name.trim()) return
    await onSave({
      name,
      title: leadTitle,
      email,
      phone,
      company_name: companyName,
      website,
      source,
      ingestion_source: ingestionSource,
      status,
      notes,
      tags,
      company_id: initial.company_id ?? null,
      contact_id: initial.contact_id ?? null,
    })
    onClose()
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Lead name *"><Inp value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" /></Field>
        <Field label="Title"><Inp value={leadTitle} onChange={(e) => setLeadTitle(e.target.value)} placeholder="VP Sales" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><Inp value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" /></Field>
        <Field label="Phone"><Inp value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 415..." /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company"><Inp value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company Inc" /></Field>
        <Field label="Website"><Inp value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="company.com" /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Lead source"><Sel value={source} onChange={(v) => setSource(v as LeadSource)} options={LEAD_SOURCES} /></Field>
        <Field label="Ingestion"><Sel value={ingestionSource} onChange={(v) => setIngestionSource(v as LeadIngestionSource)} options={LEAD_INGESTION_SOURCES} /></Field>
        <Field label="Status"><Sel value={status} onChange={(v) => setStatus(v as LeadStatus)} options={LEAD_STATUSES} /></Field>
      </div>
      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Augmentation, cleansing, or prospecting notes..."
          rows={3}
          className={cn(inputCls, 'resize-y')}
        />
      </Field>
      <Field label="Tags"><TagInput value={tags} onChange={setTags} /></Field>
      <Actions onClose={onClose} onSave={save} />
    </Modal>
  )
}

// ── Deal Form ──────────────────────────────────────────────────
interface DealFormProps {
  initial?: Partial<Deal>
  companies: Company[]
  contacts: Contact[]
  onSave: (data: Omit<Deal, 'id' | 'created_at'>) => SaveResult
  onClose: () => void
  title?: string
}

export function DealForm({ initial = {}, companies, contacts, onSave, onClose, title = 'Add deal' }: DealFormProps) {
  const [dealTitle, setDealTitle] = useState(initial.title ?? '')
  const [value, setValue] = useState(String(initial.value ?? ''))
  const [stage, setStage] = useState<DealStage>(initial.stage ?? 'Lead')
  const [probability, setProbability] = useState(String(initial.probability ?? 10))
  const [closeDate, setCloseDate] = useState(initial.close_date ?? '')
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [companyId, setCompanyId] = useState(initial.company_id ?? '')
  const [contactId, setContactId] = useState(initial.contact_id ?? '')

  const filteredContacts = contacts.filter((c) => !companyId || c.company_id === companyId)

  function handleStageChange(s: string) {
    const st = s as DealStage
    setStage(st)
    setProbability(String(STAGE_PROBABILITY[st]))
  }

  async function save() {
    if (!dealTitle.trim()) return
    await onSave({
      title: dealTitle,
      value: parseFloat(value) || 0,
      stage,
      probability: parseInt(probability) || 0,
      close_date: closeDate,
      notes,
      company_id: companyId || null,
      contact_id: contactId || null,
    })
    onClose()
  }

  return (
    <Modal title={title} onClose={onClose}>
      <Field label="Deal title *"><Inp value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} placeholder="Acme Platform License" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Value ($)"><Inp type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="25000" /></Field>
        <Field label="Stage"><Sel value={stage} onChange={handleStageChange} options={STAGES} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Close date"><Inp type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} /></Field>
        <Field label="Probability (%)"><Inp type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={inputCls}>
            <option value="">— none —</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Contact">
          <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputCls}>
            <option value="">— none —</option>
            {filteredContacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any context..."
          rows={3}
          className={cn(inputCls, 'resize-y')}
        />
      </Field>
      <Actions onClose={onClose} onSave={save} />
    </Modal>
  )
}

// ── Task Form ──────────────────────────────────────────────────
interface TaskFormProps {
  initial?: Partial<Task>
  deals: Deal[]
  contacts: Contact[]
  onSave: (data: Omit<Task, 'id'>) => SaveResult
  onClose: () => void
  title?: string
}

export function TaskForm({ initial = {}, deals, contacts, onSave, onClose, title = 'Add task' }: TaskFormProps) {
  const [taskTitle, setTaskTitle] = useState(initial.title ?? '')
  const [dueDate, setDueDate] = useState(initial.due_date ?? '')
  const [priority, setPriority] = useState<TaskPriority>(initial.priority ?? 'medium')
  const [dealId, setDealId] = useState(initial.deal_id ?? '')
  const [contactId, setContactId] = useState(initial.contact_id ?? '')

  async function save() {
    if (!taskTitle.trim()) return
    await onSave({
      title: taskTitle,
      due_date: dueDate,
      priority,
      status: initial.status ?? 'open',
      deal_id: dealId || null,
      contact_id: contactId || null,
    })
    onClose()
  }

  return (
    <Modal title={title} onClose={onClose}>
      <Field label="Task *"><Inp value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Follow up on proposal" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date"><Inp type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        <Field label="Priority"><Sel value={priority} onChange={(v) => setPriority(v as TaskPriority)} options={TASK_PRIORITIES} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Linked deal">
          <select value={dealId} onChange={(e) => setDealId(e.target.value)} className={inputCls}>
            <option value="">— none —</option>
            {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </Field>
        <Field label="Linked contact">
          <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputCls}>
            <option value="">— none —</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>
      <Actions onClose={onClose} onSave={save} />
    </Modal>
  )
}

// ── Activity Form ──────────────────────────────────────────────
interface ActivityFormProps {
  dealId: string
  onSave: (data: Omit<Activity, 'id' | 'timestamp'>) => SaveResult
  onClose: () => void
}

export function ActivityForm({ dealId, onSave, onClose }: ActivityFormProps) {
  const [type, setType] = useState<ActivityType>('note')
  const [body, setBody] = useState('')

  async function save() {
    if (!body.trim()) return
    await onSave({ type, body, deal_id: dealId })
    onClose()
  }

  return (
    <Modal title="Log activity" onClose={onClose}>
      <Field label="Type">
        <div className="flex gap-2 flex-wrap">
          {ACTIVITY_TYPES.map((t) => (
            <Button
              key={t}
              onClick={() => setType(t)}
              variant={type === t ? 'default' : 'outline'}
              size="sm"
              className="capitalize"
            >
              {t}
            </Button>
          ))}
        </div>
      </Field>
      <Field label="Notes">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened?"
          rows={3}
          className={cn(inputCls, 'resize-y')}
          autoFocus
        />
      </Field>
      <div className="flex justify-end gap-2 mt-2">
        <Button onClick={onClose} variant="outline">Cancel</Button>
        <Button onClick={save}>Log</Button>
      </div>
    </Modal>
  )
}

// ── New Record Dropdown ────────────────────────────────────────
type NewType = 'company' | 'lead' | 'contact' | 'deal' | 'task'

interface NewDropdownProps {
  onSelect: (type: NewType) => void
  onClose: () => void
  className?: string
}

export function NewDropdown({ onSelect, onClose, className }: NewDropdownProps) {
  const items: { type: NewType; label: string }[] = [
    { type: 'company', label: 'Company' },
    { type: 'lead', label: 'Lead' },
    { type: 'contact', label: 'Contact' },
    { type: 'deal', label: 'Deal' },
    { type: 'task', label: 'Task' },
  ]

  return (
    <div
      className={cn(
        'absolute bottom-14 left-3 w-48 bg-popover text-popover-foreground border rounded-xl shadow-soft z-50 overflow-hidden p-1',
        className,
      )}
    >
      {items.map(({ type, label }) => (
        <button
          key={type}
          onClick={() => { onSelect(type); onClose() }}
          className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Global Search ──────────────────────────────────────────────
interface GlobalSearchProps {
  crm: CRMStore
  onClose: () => void
  onNav: (page: string) => void
}

export function GlobalSearch({ crm, onClose, onNav }: GlobalSearchProps) {
  const [q, setQ] = useState('')
  const lq = q.toLowerCase()

  const results = !q
    ? []
    : [
        ...crm.contacts
          .filter((c) => c.name.toLowerCase().includes(lq) || c.email?.toLowerCase().includes(lq))
          .slice(0, 4)
          .map((c) => ({ type: 'contact', label: c.name, sub: c.title })),
        ...crm.leads
          .filter((l) =>
            l.name.toLowerCase().includes(lq) ||
            l.company_name.toLowerCase().includes(lq) ||
            l.email.toLowerCase().includes(lq))
          .slice(0, 4)
          .map((l) => ({ type: 'lead', label: l.name, sub: l.company_name || l.status })),
        ...crm.companies
          .filter((c) => c.name.toLowerCase().includes(lq))
          .slice(0, 3)
          .map((c) => ({ type: 'company', label: c.name, sub: c.industry })),
        ...crm.deals
          .filter((d) => d.title.toLowerCase().includes(lq))
          .slice(0, 4)
          .map((d) => ({ type: 'deal', label: d.title, sub: String(d.value) })),
      ]

  const typeNav: Record<string, string> = {
    contact: 'contacts',
    lead: 'leads',
    company: 'companies',
    deal: 'pipeline',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-[560px] bg-card rounded-xl border shadow-soft overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            placeholder="Search contacts, companies, deals..."
            className="flex-1 text-sm bg-transparent"
          />
          <Button onClick={onClose} variant="ghost" size="icon"><X className="h-4 w-4 text-muted-foreground" /></Button>
        </div>
        {results.length > 0 && (
          <div className="py-1">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => { onNav(typeNav[r.type]); onClose() }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent transition-colors"
              >
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  r.type === 'contact' ? 'bg-blue-100 text-blue-700' :
                  r.type === 'lead' ? 'bg-indigo-100 text-indigo-700' :
                  r.type === 'company' ? 'bg-teal-100 text-teal-700' :
                  'bg-amber-100 text-amber-700',
                )}>{r.type}</span>
                <span className="flex-1 font-medium text-left">{r.label}</span>
                <span className="text-muted-foreground text-xs">{r.sub}</span>
              </button>
            ))}
          </div>
        )}
        {q && results.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No results for &ldquo;{q}&rdquo;
          </div>
        )}
      </div>
    </div>
  )
}
