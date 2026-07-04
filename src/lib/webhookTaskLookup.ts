import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveResendEmailId } from '@/lib/resendEmail'

interface WebhookEventData {
  email_id?: string
  id?: string
  to?: string[]
  tags?: Record<string, string>
}

const TASK_SELECT =
  'id, lead_id, sequence_id, day_number, channel, status, delivered_at, opened_at, open_count, clicked_at, click_count, bounced_at, resend_email_id'

export interface WebhookSequenceTask {
  id: string
  lead_id: string
  sequence_id: string
  day_number: number
  channel: string
  status: string
  delivered_at?: string | null
  opened_at?: string | null
  open_count?: number | null
  clicked_at?: string | null
  click_count?: number | null
  bounced_at?: string | null
  resend_email_id?: string | null
}

export async function resolveWebhookSequenceTask(
  supabase: SupabaseClient,
  event: { type?: string; data?: WebhookEventData },
): Promise<{ task: WebhookSequenceTask | null; emailId: string | null }> {
  const emailId = resolveResendEmailId(event)
  if (!emailId) return { task: null, emailId: null }

  const { data: byResendId } = await supabase
    .from('sequence_tasks')
    .select(TASK_SELECT)
    .eq('resend_email_id', emailId)
    .maybeSingle()

  if (byResendId) return { task: byResendId, emailId }

  const taskIdFromTag = event.data?.tags?.sequence_task_id
  if (taskIdFromTag) {
    const { data: byTag } = await supabase
      .from('sequence_tasks')
      .select(TASK_SELECT)
      .eq('id', taskIdFromTag)
      .maybeSingle()

    if (byTag) {
      await supabase
        .from('sequence_tasks')
        .update({ resend_email_id: emailId })
        .eq('id', byTag.id as string)
      return { task: { ...byTag, resend_email_id: emailId }, emailId }
    }
  }

  const recipients = event.data?.to ?? []
  const recipient = recipients[0]?.trim().toLowerCase()
  if (!recipient) return { task: null, emailId }

  const { data: leads } = await supabase
    .from('leads')
    .select('id')
    .ilike('email', recipient)
    .limit(1)

  const leadId = leads?.[0]?.id as string | undefined
  if (!leadId) return { task: null, emailId }

  const { data: recentTasks } = await supabase
    .from('sequence_tasks')
    .select(TASK_SELECT)
    .eq('lead_id', leadId)
    .eq('channel', 'email')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)

  const recent = recentTasks?.[0]
  if (!recent) return { task: null, emailId }

  await supabase
    .from('sequence_tasks')
    .update({ resend_email_id: emailId })
    .eq('id', recent.id as string)

  return { task: { ...recent, resend_email_id: emailId }, emailId }
}

export async function checkEngagementSchema(supabase: SupabaseClient): Promise<{
  ok: boolean
  error: string | null
}> {
  const { error } = await supabase
    .from('sequence_tasks')
    .select('opened_at, resend_email_id, open_count')
    .limit(1)

  return { ok: !error, error: error?.message ?? null }
}
