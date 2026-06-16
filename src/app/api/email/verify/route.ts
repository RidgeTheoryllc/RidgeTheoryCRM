import { NextResponse } from 'next/server'
import {
  buildCleansingSummary,
  isReoonEmailValid,
  type EmailCleansingResult,
  type ReoonEmailStatus,
} from '@/lib/emailCleansing'

const REOON_VERIFY_URL = 'https://emailverifier.reoon.com/api/v1/verify'

interface ReoonVerifyResponse {
  email?: string
  status?: ReoonEmailStatus | 'error'
  is_valid_syntax?: boolean
  is_disposable?: boolean
  is_role_account?: boolean
  is_catch_all?: boolean
  is_deliverable?: boolean
  is_safe_to_send?: boolean
  is_spamtrap?: boolean
  mx_accepts_mail?: boolean
  can_connect_smtp?: boolean
  reason?: string
  error?: string
}

async function parseReoonResponse(response: Response): Promise<ReoonVerifyResponse> {
  const text = await response.text()
  try {
    return JSON.parse(text) as ReoonVerifyResponse
  } catch {
    throw new Error('Reoon returned an unexpected response')
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.REOON_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'REOON_API_KEY is not configured', skipped: true },
      { status: 503 },
    )
  }

  const body = await request.json()
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  const mode = process.env.REOON_VERIFY_MODE ?? 'power'
  const url = new URL(REOON_VERIFY_URL)
  url.searchParams.set('email', email)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('mode', mode)

  const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store' })
  const data = await parseReoonResponse(response)

  if (!response.ok || data.status === 'error' || data.error) {
    return NextResponse.json(
      { error: data.error ?? data.reason ?? 'Reoon verification failed' },
      { status: response.ok ? 502 : response.status },
    )
  }

  const status = (data.status ?? 'unknown') as ReoonEmailStatus
  const valid = isReoonEmailValid(data)
  const isDeliverable = data.is_deliverable ?? valid
  const result: EmailCleansingResult = {
    email: data.email ?? email,
    status,
    valid,
    is_deliverable: isDeliverable,
    is_safe_to_send: data.is_safe_to_send ?? valid,
    is_disposable: data.is_disposable ?? false,
    is_role_account: data.is_role_account ?? false,
    is_catch_all: data.is_catch_all ?? false,
    summary: buildCleansingSummary({
      status,
      is_deliverable: isDeliverable,
      is_disposable: data.is_disposable ?? false,
      is_role_account: data.is_role_account ?? false,
      is_catch_all: data.is_catch_all ?? false,
    }),
    validated_at: new Date().toISOString(),
  }

  return NextResponse.json(result)
}
