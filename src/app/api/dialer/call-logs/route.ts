import { NextResponse } from 'next/server'
import { getRequestUserId, requireAdmin } from '@/lib/dialer/server'

/** Recent calls for the signed-in rep (newest first). */
export async function GET(request: Request) {
  const userId = await getRequestUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  try {
    const { data, error } = await requireAdmin()
      .from('call_logs')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(500)
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (error) {
    const message = error instanceof Error ? error.message : (error as { message?: string })?.message
    return NextResponse.json({ error: message || 'Unexpected error' }, { status: 500 })
  }
}

/** Save call notes on a log row. */
export async function PATCH(request: Request) {
  const userId = await getRequestUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json()
  if (typeof body.id !== 'string' || typeof body.call_notes !== 'string') {
    return NextResponse.json({ error: 'id and call_notes are required' }, { status: 400 })
  }

  const { data, error } = await requireAdmin()
    .from('call_logs')
    .update({ call_notes: body.call_notes })
    .eq('id', body.id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
