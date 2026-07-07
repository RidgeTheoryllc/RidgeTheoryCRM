import { NextResponse } from 'next/server'
import { autoSendSequenceTask } from '@/lib/autoSendSequenceEmail'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' },
      { status: 500 },
    )
  }

  const body = await request.json()
  const taskId = typeof body.sequence_task_id === 'string' ? body.sequence_task_id.trim() : ''
  if (!taskId) {
    return NextResponse.json({ error: 'sequence_task_id is required' }, { status: 400 })
  }

  const result = await autoSendSequenceTask(supabase, taskId)

  if (result.error) {
    return NextResponse.json({ error: result.error, sent: false }, { status: 500 })
  }

  if (!result.sent) {
    return NextResponse.json({
      sent: false,
      skipped: result.skipped ?? 'not sent',
    })
  }

  return NextResponse.json({ sent: true, id: result.resendId })
}
