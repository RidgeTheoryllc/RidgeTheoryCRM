import type {
  Lead, SequenceChannel, SequenceTask, SequenceTier, SequenceTriggerType,
} from '@/types'
import {
  buildEmailPs, buildEmailSignoff, resolveOutreachCompany, resolveOutreachGreetingName,
  resolveOutreachSignal, sanitizeEmailSubject,
} from '@/lib/outreach'

export interface SequenceStepTemplate {
  day_number: number
  channel: SequenceChannel
  title: string
  purpose: string
  trigger_type: SequenceTriggerType
}

export const HIGH_TOUCH_SEQUENCE: SequenceStepTemplate[] = [
  { day_number: 1, channel: 'email', title: 'The Opener', purpose: 'Signal-led message connecting a business event to a likely technical pain point.', trigger_type: 'automatic' },
  { day_number: 3, channel: 'email', title: 'Value Add', purpose: 'Share a relevant case study or technical resource without a hard pitch.', trigger_type: 'automatic' },
  { day_number: 4, channel: 'linkedin', title: 'Connection Request', purpose: 'Send a blank or personalized request referencing the same signal from Day 1.', trigger_type: 'manual' },
  { day_number: 6, channel: 'phone', title: 'Call Attempt', purpose: 'Reference your email and the business signal. Leave a short voicemail if no answer.', trigger_type: 'manual' },
  { day_number: 8, channel: 'email', title: 'New Angle', purpose: 'Introduce a different problem theme with a new subject line.', trigger_type: 'automatic' },
  { day_number: 10, channel: 'linkedin', title: 'Engagement', purpose: 'Like or comment thoughtfully on recent content to stay top-of-mind.', trigger_type: 'manual' },
  { day_number: 12, channel: 'phone', title: 'Follow-up Call', purpose: 'Second call attempt at a different time of day.', trigger_type: 'manual' },
  { day_number: 14, channel: 'email', title: 'Breakup', purpose: 'Respectful closing that often triggers replies from interested but busy prospects.', trigger_type: 'automatic' },
]

export const LOW_TOUCH_SEQUENCE: SequenceStepTemplate[] = [
  { day_number: 1, channel: 'email', title: 'Light Opener', purpose: 'Short signal-led opener with a simple relevance question.', trigger_type: 'automatic' },
  { day_number: 4, channel: 'email', title: 'Useful Resource', purpose: 'Share one relevant resource without a hard pitch.', trigger_type: 'automatic' },
  { day_number: 7, channel: 'linkedin', title: 'Manual LinkedIn Check', purpose: 'Optional single manual engagement for lower-ranked leads.', trigger_type: 'manual' },
  { day_number: 10, channel: 'email', title: 'Close Loop', purpose: 'Polite close-loop email with a clear opt-out.', trigger_type: 'automatic' },
]

export function getSequenceTemplate(tier: SequenceTier) {
  return tier === 'high' ? HIGH_TOUCH_SEQUENCE : LOW_TOUCH_SEQUENCE
}

export function buildSequenceTask(
  lead: Lead,
  sequenceId: string,
  startDate: string,
  step: SequenceStepTemplate,
): Omit<SequenceTask, 'id' | 'created_at' | 'owner_id'> {
  const due = addDays(startDate, step.day_number - 1)
  const draft = createFallbackDraft(lead, step)

  return {
    sequence_id: sequenceId,
    lead_id: lead.id,
    day_number: step.day_number,
    channel: step.channel,
    title: step.title,
    purpose: step.purpose,
    due_date: due,
    trigger_type: step.trigger_type,
    status: 'pending',
    generated_subject: draft.subject,
    generated_body: draft.body,
    generated_script: draft.script,
    resend_email_id: '',
    sent_at: null,
    completed_at: null,
  }
}

export function createFallbackDraft(lead: Lead, step: SequenceStepTemplate) {
  const name = resolveOutreachGreetingName(lead)
  const company = resolveOutreachCompany(lead)
  const theme = lead.pain_theme || 'operations'
  const signoff = buildEmailSignoff()
  const ps = buildEmailPs(lead.website)
  const signal = resolveOutreachSignal(lead)

  if (step.channel === 'email') {
    return buildFallbackEmail(lead, step, { name, company, theme, signoff, ps, signal })
  }

  if (step.channel === 'phone') {
    return {
      subject: '',
      body: '',
      script: `Hi ${name}, this is RidgeTheory. I sent a note about ${signal}. Calling to see if a quick chat on ${theme} at ${company} makes sense. I'll follow up by email if I miss you.`,
    }
  }

  return {
    subject: '',
    body: '',
    script: `Hi ${name}, saw ${signal} and thought it might be worth connecting. Happy to compare notes on ${theme} if you're open to it.`,
  }
}

function buildFallbackEmail(
  lead: Lead,
  step: SequenceStepTemplate,
  ctx: {
    name: string
    company: string
    theme: string
    signoff: string
    ps: string
    signal: string
  },
) {
  const { name, company, theme, signoff, ps, signal } = ctx
  const titleHook = lead.title ? ` as ${lead.title}` : ''
  const variant = leadVariantIndex(lead, step.day_number)
  const greeting = variant % 2 === 0 ? 'Hi' : 'Hey'

  const openers = [
    `I noticed ${company} seems to be in a growth stretch${titleHook}, and I'm guessing you're probably pulling data from a few different places just to keep tabs on things.`,
    `Been looking at ${company}${titleHook}. Looks like you're scaling, and I imagine reporting across teams is getting harder than it should be.`,
    lead.signal?.trim()
      ? `${lead.signal.trim()}. That stood out when I was reading up on ${company}. Figured it might mean you're dealing with some messy ops/data stuff behind the scenes.`
      : `${company} caught my eye${titleHook}. I'm guessing ${theme} workflows are starting to feel harder than they should as things grow.`,
  ]

  const painBlocks: Record<string, string[]> = {
    scalability: [
      `Most teams at this stage hit a wall where spreadsheets and scattered tools make it tough to get a real-time read on what's actually happening. You end up hunting for numbers instead of acting on them.`,
      `What we hear a lot: growth outpaces the internal tools, and suddenly nobody trusts the same dashboard. Sometimes there isn't one at all.`,
    ],
    operations: [
      `Usually that means more time reconciling data between systems than actually running the business. The info is there. It's just not in one place.`,
      `The pattern we see: ops workflows that worked at 20 people start breaking at 50, and everyone feels it in different ways.`,
    ],
    security: [
      `Growing teams also tend to outgrow how access and data are managed. Not dramatic, just patchy enough that audits and handoffs get painful.`,
      `Often it's less about a breach and more about not knowing who has access to what, or where sensitive data lives.`,
    ],
    cost: [
      `And when tools multiply, so do licenses and manual work. Hard to see what's actually worth keeping.`,
      `Finance teams usually feel it first: too many subscriptions, too much duplicate entry, not enough visibility.`,
    ],
  }

  const offers = [
    `We build custom dashboards and internal systems that pull the important stuff into one place, so you can see key metrics without the scavenger hunt.`,
    `RidgeTheory helps growing companies wire up dashboards and lightweight internal tools so the team isn't living in five tabs and a spreadsheet.`,
    `We mostly do custom dashboards and ops tooling. One source of truth instead of chasing updates across tools.`,
  ]

  const ctas = [
    `Worth a quick call to see if that would help streamline things at ${company}?`,
    `Open to a 15-minute chat to see if we're even a fit for what ${company} needs right now?`,
    `Happy to compare notes if you're seeing any of this on your side.`,
  ]

  const pains = painBlocks[theme] ?? painBlocks.scalability
  const body = [
    `${greeting} ${name},`,
    '',
    openers[variant % openers.length],
    '',
    pains[variant % pains.length],
    '',
    offers[variant % offers.length],
    '',
    ctas[variant % ctas.length],
    '',
    signoff,
    '',
    ps,
  ].join('\n')

  const subjects = buildFallbackSubjects(company, theme, step)

  if (step.title.toLowerCase().includes('breakup') || step.title.toLowerCase().includes('close')) {
    return {
      subject: subjects[0],
      body: `${greeting} ${name},\n\nI'll keep this short. I've reached out a couple times about ${theme} at ${company} and don't want to clutter your inbox.\n\nIf timing's off, no worries at all. If it's still on your radar, happy to chat whenever.\n\n${signoff}`,
      script: '',
    }
  }

  if (step.title.toLowerCase().includes('value') || step.title.toLowerCase().includes('resource')) {
    const followGreeting = greeting === 'Hi' ? 'Hey' : 'Hi'
    return {
      subject: subjects[variant % subjects.length],
      body: `${followGreeting} ${name},\n\nQuick follow-up. I put together a short note on how teams like ${company} consolidate ops data without a massive rebuild.\n\nIf useful, I can send it over or walk through it on a quick call.\n\n${signoff}\n\n${ps}`,
      script: '',
    }
  }

  return {
    subject: subjects[variant % subjects.length],
    body,
    script: '',
  }
}

function buildFallbackSubjects(company: string, theme: string, step: SequenceStepTemplate): string[] {
  const stepTitle = step.title.toLowerCase()
  const themeLabel = theme.charAt(0).toUpperCase() + theme.slice(1)

  if (stepTitle.includes('breakup') || stepTitle.includes('close')) {
    return [sanitizeEmailSubject(`Closing the loop on ${company}`, step.day_number)]
  }

  if (stepTitle.includes('value') || stepTitle.includes('resource')) {
    return [
      sanitizeEmailSubject(`Resource for ${company}`, step.day_number),
      sanitizeEmailSubject(`Quick follow-up for ${company}`, step.day_number),
    ]
  }

  if (stepTitle.includes('new angle')) {
    return [
      sanitizeEmailSubject(`Another angle on ${themeLabel} at ${company}`, step.day_number),
      sanitizeEmailSubject(`One more thought on ${company}`, step.day_number),
    ]
  }

  const openerSubjects = [
    `Quick question about ${company}`,
    `Ops / data at ${company}`,
    `${themeLabel} at ${company}?`,
    `Thoughts on dashboards at ${company}?`,
  ]

  if (step.day_number > 1) {
    openerSubjects.push(`Re: ${company}`)
  }

  return openerSubjects.map((subject) => sanitizeEmailSubject(subject, step.day_number))
}

function leadVariantIndex(lead: Lead, dayNumber: number) {
  const seed = `${lead.id}-${lead.company_name}-${lead.title}-${dayNumber}`
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % 997
  }
  return hash
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`)
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}
