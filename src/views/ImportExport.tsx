'use client'

import { useState } from 'react'
import { X, Download } from 'lucide-react'
import type { CRMStore } from '@/hooks/useCRM'
import { useImportExport } from '@/hooks/useImportExport'
import { createCSVMapping, parseCSV } from '@/lib/csv'
import { Button } from '@/components/ui/button'

interface ImportExportProps {
  crm: CRMStore
  onClose: () => void
}

type Tab = 'export' | 'import' | 'backup'
type ImportType = 'leads' | 'contacts' | 'companies' | 'deals'

const FIELDS: Record<ImportType, string[]> = {
  leads: ['name', 'title', 'email', 'phone', 'company_name', 'website', 'source', 'ingestion_source', 'status', 'notes'],
  contacts: ['name', 'title', 'email', 'phone', 'linked_in', 'lead_source', 'status'],
  companies: ['name', 'industry', 'website', 'size'],
  deals: ['title', 'value', 'stage', 'close_date', 'notes'],
}

export function ImportExport({ crm, onClose }: ImportExportProps) {
  const [tab, setTab] = useState<Tab>('export')
  const [csvType, setCsvType] = useState<ImportType>('contacts')
  const [csvText, setCsvText] = useState('')
  const [mapStep, setMapStep] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, number | ''>>({})

  const { exportCSV, exportJSON, importCSV } = useImportExport(crm)

  function parseCSVText() {
    const parsed = parseCSV(csvText)
    if (parsed.length < 2) return
    const [h, ...r] = parsed
    setHeaders(h)
    setRows(r)
    setMapping(createCSVMapping(FIELDS[csvType], h))
    setMapStep(true)
  }

  async function doImport() {
    await importCSV(csvType, rows, mapping)
    onClose()
  }

  const inputCls = 'w-full border border-input rounded-md px-3 py-2 text-sm bg-background shadow-sm focus:ring-2 focus:ring-ring'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-card rounded-xl border shadow-soft w-[520px] max-h-[80vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold">Import / Export</h2>
            <p className="text-xs text-muted-foreground">Move CRM data in and out of the workspace.</p>
          </div>
          <Button onClick={onClose} variant="ghost" size="icon"><X className="h-4 w-4" /></Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-5">
          {(['export', 'import', 'backup'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'export' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Export as CSV</label>
              <div className="flex gap-2">
                <select
                  value={csvType}
                  onChange={(e) => setCsvType(e.target.value as ImportType)}
                  className={`${inputCls} flex-1`}
                >
                  <option value="leads">Leads</option>
                  <option value="contacts">Contacts</option>
                  <option value="companies">Companies</option>
                  <option value="deals">Deals</option>
                </select>
                <Button
                  onClick={() => exportCSV(csvType)}
                  variant="outline"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
              </div>
            </div>
          </div>
        )}

        {tab === 'import' && !mapStep && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Import type</label>
              <select
                value={csvType}
                onChange={(e) => setCsvType(e.target.value as ImportType)}
                className={inputCls}
              >
                <option value="leads">Leads</option>
                <option value="contacts">Contacts</option>
                <option value="companies">Companies</option>
                <option value="deals">Deals</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Paste CSV content</label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`name,email,title\nJane,jane@co.com,VP Sales`}
                rows={5}
                className={`${inputCls} resize-y font-mono text-xs`}
              />
            </div>
            <Button onClick={parseCSVText}>
              Map fields →
            </Button>
          </div>
        )}

        {tab === 'import' && mapStep && (
          <div>
            <p className="text-xs text-muted-foreground mb-4">{rows.length} rows detected. Map columns to CRM fields.</p>
            {FIELDS[csvType].map((field) => (
              <div key={field} className="flex items-center gap-3 mb-3">
                <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{field}</span>
                <select
                  value={mapping[field] ?? ''}
                  onChange={(e) => setMapping((p) => ({ ...p, [field]: e.target.value === '' ? '' : parseInt(e.target.value) }))}
                  className={`${inputCls} flex-1`}
                >
                  <option value="">— skip —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </div>
            ))}
            <div className="flex gap-2 mt-4">
              <Button onClick={() => setMapStep(false)} variant="outline">Back</Button>
              <Button onClick={doImport}>
                Import {rows.length} rows
              </Button>
            </div>
          </div>
        )}

        {tab === 'backup' && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Download a full JSON backup of all your CRM data — companies, contacts, deals, activities, and tasks.
            </p>
            <Button onClick={exportJSON}>
              <Download className="h-4 w-4" /> Download backup.json
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
