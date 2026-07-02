import type { Lead, LeadRankTier } from '@/types'
import { stripCleansingNotes } from '@/lib/emailCleansing'

export interface LeadScore {
  interest_score: number
  decision_maker_score: number
  fit_score: number
  overall_score: number
  rank_tier: LeadRankTier
  pain_theme: string
}

const SENIORITY_TERMS = [
  'founder', 'owner', 'ceo', 'cto', 'cio', 'vp', 'vice president',
  'director', 'head', 'chief', 'president',
]

const INTEREST_TERMS = [
  'inbound', 'referral', 'budget', 'security', 'scalability', 'integration',
  'automation', 'operations', 'growth', 'migration', 'compliance',
]

export function scoreLead(lead: Lead): LeadScore {
  const text = `${lead.title} ${stripCleansingNotes(lead.notes ?? '')} ${lead.tags.join(' ')} ${lead.source}`.toLowerCase()
  const decision_maker_score = clamp(
    25 +
    (SENIORITY_TERMS.some((term) => text.includes(term)) ? 45 : 0) +
    (lead.tags.some((tag) => tag.toLowerCase().includes('decision')) ? 20 : 0),
  )

  const interest_score = clamp(
    20 +
    INTEREST_TERMS.filter((term) => text.includes(term)).length * 12 +
    (lead.source === 'Website' || lead.source === 'Referral' ? 18 : 0),
  )

  const fit_score = clamp(
    15 +
    (lead.email ? 20 : 0) +
    (lead.phone ? 15 : 0) +
    (lead.company_name ? 15 : 0) +
    (lead.website ? 15 : 0) +
    (lead.title ? 10 : 0),
  )

  const overall_score = Math.round(
    interest_score * 0.35 +
    decision_maker_score * 0.4 +
    fit_score * 0.25,
  )

  return {
    interest_score,
    decision_maker_score,
    fit_score,
    overall_score,
    rank_tier: overall_score >= 70 ? 'high' : 'low',
    pain_theme: inferPainTheme(text),
  }
}

function inferPainTheme(text: string) {
  if (text.includes('security') || text.includes('compliance')) return 'security'
  if (text.includes('scalability') || text.includes('growth')) return 'scalability'
  if (text.includes('cost') || text.includes('budget') || text.includes('finance')) return 'cost'
  if (text.includes('operations') || text.includes('automation')) return 'operations'
  return 'scalability'
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value))
}
