import { NextResponse } from 'next/server'
import { buildEmailPs, buildEmailSignoff } from '@/lib/outreach'

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 400 })
  }

  const body = await request.json()
  const phone = process.env.OUTREACH_PHONE
  const signoff = buildEmailSignoff(phone)
  const ps = buildEmailPs(body.website as string | undefined)
  const prompt = buildPrompt(body, signoff, ps)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.88,
      messages: [
        {
          role: 'system',
          content: `You write casual, human B2B cold emails for RidgeTheory, a team that builds custom dashboards and internal systems for growing companies.

Voice: conversational, specific, curious. Write like a thoughtful peer, not a sales bot. Use contractions. Vary sentence length. No buzzwords ("leverage", "synergy", "game-changer"). No fake familiarity.

Never use em dashes (—) or en dashes (–). Use periods, commas, or short separate sentences instead.

Start with "Hi [first name]," or "Hey [first name]," and vary between them. Never use "Dear" or "Hope this finds you well".

Every email must feel written for ONE person at ONE company. Pull details from the lead context. Never reuse the same opening line or pain framing across different leads.

Return only valid JSON.`,
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    return NextResponse.json({ error: message }, { status: response.status })
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    return NextResponse.json({ error: 'OpenAI returned no content' }, { status: 502 })
  }

  return NextResponse.json(JSON.parse(content))
}

function buildPrompt(
  body: Record<string, unknown>,
  signoff: string,
  ps: string,
) {
  const channel = String(body.channel ?? 'email')

  return `Write prospecting copy for this sequence step.

LEAD (use these details — do not invent facts not implied here):
- Name: ${body.leadName || 'Unknown'}
- Title: ${body.title || 'not provided'}
- Company: ${body.company || 'not provided'}
- Website: ${body.website || 'not provided'}
- Source: ${body.source || 'not provided'}
- Notes / signal: ${body.signal || 'none'}
- Pain theme: ${body.painTheme || 'operations'}
- Rank tier: ${body.rankTier || 'unknown'}

SEQUENCE STEP:
- Channel: ${channel}
- Day ${body.dayNumber ?? '?'} — ${body.stepTitle || 'Outreach'}
- Purpose: ${body.purpose || 'initial outreach'}

EMAIL STYLE EXAMPLE (match this tone and structure, but make it unique to THIS lead):
---
Hey Crisjay,

I noticed Civago Company is in a growth phase, and I'm guessing you're probably juggling data from multiple sources to keep tabs on operations and performance metrics.

Most growing companies hit a wall where spreadsheets and scattered tools make it nearly impossible to get a real-time view of what's actually happening in the business. You end up spending more time hunting for information than acting on it.

We build custom dashboards and internal systems that pull everything into one place so you can see your key metrics instantly and make faster decisions.

Worth a quick call to see if this would help streamline things at Civago?

${signoff}

${ps}
---

RULES:
- Return JSON: { "subject": "...", "body": "...", "script": "..." }
- For email: write subject + body. Opener emails: 90-160 words in the body (excluding sign-off).
- Start with "Hi [first name]," or "Hey [first name],". Vary the greeting. Never "Dear" or "Hope this finds you well".
- Never use em dashes (—) or en dashes (–) anywhere in subject or body.
- Never mention email verification, Reoon, deliverability, "safe", "invalid", or any internal CRM/system notes in the email.
- Reference something specific: their title, company, or a real business reason to reach out. If data is thin, infer a plausible growth/ops challenge for their company type, but keep it humble ("I'm guessing", "probably", "might be").
- Explain RidgeTheory briefly in plain language (dashboards, internal tools, unified data). One short sentence, not a pitch deck.
- End with a low-pressure question (quick call, worth comparing notes, etc.).
- Sign-off MUST be exactly:
${signoff}
- Add a PS line after the sign-off. Use this unless a more specific PS fits the lead better:
${ps}
- For LinkedIn: put connection note or comment suggestion in "script" (under 280 chars for connection requests).
- For phone: put call opener + voicemail in "script".
- Subject lines: specific and casual, not generic ("Quick question about [Company]" beats "[Company] and scalability").
- Vary structure: not every email needs the same number of paragraphs. Some can open with a question, others with an observation.`
}
