import { NextResponse } from 'next/server'
import { getRequestUserId, listDidPool, requireAdmin } from '@/lib/dialer/server'
import { getDidCallsToday } from '@/lib/dialer/didEngine'
import { extractAreaCode, toE164 } from '@/lib/dialer/phone'
import type { DidStatus } from '@/lib/dialer/types'

const STATUSES: DidStatus[] = ['active', 'cooldown', 'retired']

function errorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message
    : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message)
    : 'Unexpected error'
  return NextResponse.json({ error: message }, { status: 500 })
}

export async function GET(request: Request) {
  const userId = await getRequestUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  try {
    const dids = await listDidPool(userId)
    return NextResponse.json(dids.map((did) => ({ ...did, calls_today: getDidCallsToday(did) })))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  const userId = await getRequestUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json()
  const did = toE164(typeof body.did === 'string' ? body.did : '')
  if (did.replace(/\D/g, '').length < 10) {
    return NextResponse.json({ error: 'Enter a valid phone number.' }, { status: 400 })
  }

  try {
    const { data, error } = await requireAdmin()
      .from('did_pool')
      .insert({ user_id: userId, did, area_code: extractAreaCode(did), status: 'active' })
      .select()
      .single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'That number is already in your pool.' }, { status: 409 })
      throw error
    }
    return NextResponse.json(data)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  const userId = await getRequestUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json()
  if (typeof body.id !== 'string' || !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'id and a valid status are required' }, { status: 400 })
  }

  try {
    const { data, error } = await requireAdmin()
      .from('did_pool')
      .update({ status: body.status })
      .eq('id', body.id)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request) {
  const userId = await getRequestUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json()
  if (typeof body.id !== 'string') return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const supabase = requireAdmin()
    const { data: did, error: didError } = await supabase
      .from('did_pool')
      .select('did')
      .eq('id', body.id)
      .eq('user_id', userId)
      .single()
    if (didError) throw didError

    const { count, error: usageError } = await supabase
      .from('call_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('did', did.did)
    if (usageError) throw usageError
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'This number has call history and cannot be deleted. Set it to cooldown or retired instead.' },
        { status: 409 },
      )
    }

    const { error } = await supabase.from('did_pool').delete().eq('id', body.id).eq('user_id', userId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
