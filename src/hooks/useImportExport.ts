'use client'

import { useCallback } from 'react'
import type { CRMStore } from './useCRM'
import {
  COMPANY_SIZES, CONTACT_STATUSES, INDUSTRIES, LEAD_INGESTION_SOURCES,
  LEAD_SOURCES, LEAD_STATUSES, STAGES, STAGE_PROBABILITY,
} from '@/types'

export interface ImportResult {
  imported: number
  skippedInvalidEmail: number
}

export function useImportExport(crm: CRMStore) {
  const exportCSV = useCallback(
    (type: 'leads' | 'companies' | 'contacts' | 'deals') => {
      const data: Record<string, unknown>[] = crm[type].map((row) => ({ ...row }))
      if (!data.length) return
      const keys = Object.keys(data[0]).filter(
        (k) => k !== 'id' && k !== 'created_at' && k !== 'tags',
      )
      const lines = [
        keys.join(','),
        ...data.map((row) =>
          keys.map((k) => JSON.stringify(row[k] ?? '')).join(','),
        ),
      ]
      download(`${type}.csv`, lines.join('\n'), 'text/csv')
    },
    [crm],
  )

  const exportJSON = useCallback(() => {
    const backup = {
      companies: crm.companies,
      contacts: crm.contacts,
      deals: crm.deals,
      activities: crm.activities,
      tasks: crm.tasks,
    }
    download('crm-backup.json', JSON.stringify(backup, null, 2), 'application/json')
  }, [crm])

  const importCSV = useCallback(
    async (
      type: 'leads' | 'companies' | 'contacts' | 'deals',
      rows: string[][],
      mapping: Record<string, number | ''>,
      options: { skipInvalidEmails?: boolean } = {},
    ): Promise<ImportResult> => {
      let imported = 0
      let skippedInvalidEmail = 0

      for (const row of rows) {
        const obj: Record<string, string> = {}
        Object.entries(mapping).forEach(([field, idx]) => {
          if (idx !== '' && idx !== undefined) obj[field] = row[idx as number]
        })
        if (!obj.name && !obj.title) continue
        if (type === 'leads') {
          const record = await crm.addLead({
            name: obj.name ?? '',
            title: obj.title ?? '',
            email: obj.email ?? '',
            phone: obj.phone ?? '',
            company_name: obj.company_name ?? obj.company ?? '',
            website: obj.website ?? '',
            source: valueIn(obj.source, LEAD_SOURCES, 'Other'),
            ingestion_source: valueIn(obj.ingestion_source, LEAD_INGESTION_SOURCES, 'manual'),
            status: valueIn(obj.status, LEAD_STATUSES, 'Generated'),
            notes: obj.notes ?? '',
            tags: [],
            company_id: null,
            contact_id: null,
          })

          // Drop leads Reoon flagged as invalid so outreach focuses on reachable prospects.
          if (options.skipInvalidEmails && record.email_valid === false) {
            await crm.deleteLead(record.id)
            skippedInvalidEmail += 1
            continue
          }
        } else if (type === 'contacts') {
          await crm.addContact({
            name: obj.name ?? '',
            title: obj.title ?? '',
            email: obj.email ?? '',
            phone: obj.phone ?? '',
            linked_in: obj.linked_in ?? '',
            lead_source: valueIn(obj.lead_source, LEAD_SOURCES, 'Other'),
            status: valueIn(obj.status, CONTACT_STATUSES, 'Lead'),
            tags: [],
            company_id: null,
          })
        } else if (type === 'companies') {
          await crm.addCompany({
            name: obj.name ?? '',
            industry: valueIn(obj.industry, INDUSTRIES, 'Other'),
            website: obj.website ?? '',
            size: valueIn(obj.size, COMPANY_SIZES, '11-50'),
            tags: [],
          })
        } else if (type === 'deals') {
          const stage = valueIn(obj.stage, STAGES, 'Lead')
          await crm.addDeal({
            title: obj.title ?? '',
            value: parseFloat(obj.value) || 0,
            stage,
            probability: STAGE_PROBABILITY[stage as keyof typeof STAGE_PROBABILITY] ?? 10,
            close_date: obj.close_date ?? '',
            notes: obj.notes ?? '',
            company_id: null,
            contact_id: null,
          })
        }
        imported += 1
      }

      return { imported, skippedInvalidEmail }
    },
    [crm],
  )

  return { exportCSV, exportJSON, importCSV }
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

function valueIn<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  if (!value) return fallback

  const normalized = value.trim().toLowerCase()
  return allowed.find((option) => option.toLowerCase() === normalized) ?? fallback
}
