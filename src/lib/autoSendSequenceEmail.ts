import type { SupabaseClient } from '@supabase/supabase-js'
import type { Lead, SequenceTask } from '@/types'
import { ENGAGEMENT_GATED_SEQUENCE } from '@/lib/engagementSequence'
import { createFallbackDraft } from '@/lib/prospecting'
import { sendSequenceEmail } from '@/lib/sendSequenceEmail'

export interface AutoSendResult {
  sent: boolean
  resendId?: string
  skipped?: string
  error?: string
}

function canAutoSendLead(lead: Lead): boolean {
  if (!lead.email?.trim()) return false
  if (lead.email_valid === false) return false
  if (lead.email_status === 'invalid') return false
  return true
}

function resolveDraft(task: SequenceTask, lead: Lead): { subject: string; body: string } | null {
  if (task.generated_subject?.trim() && task.generated_body?.trim()) {
    return {
      subject: task.generated_subject.trim(),
      body: task.generated_body.trim(),
    }
  }

  const step = ENGAGEMENT_GATED_SEQUENCE.find(
    (row) => row.day_number === task.day_number && row.channel === task.channel,
  )
  if (!step) return null

  const draft = createFallbackDraft(lead, step)
  if (!draft.subject?.trim() || !draft.body?.trim()) return null

  return { subject: draft.subject.trim(), body: draft.body.trim() }
}

/** Send a pending email sequence task via Resend. Safe to call multiple times (no-ops if already sent). */
export async function autoSendSequenceTask(
  supabase: SupabaseClient,
  taskId: string,
): Promise<AutoSendResult> {
  const { data: task, error: taskError } = await supabase
    .from('sequence_tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle()

  if (taskError || !task) {
    return { sent: false, error: taskError?.message ?? 'Task not found' }
  }

  const typedTask = task as SequenceTask

  if (typedTask.channel !== 'email') {
    return { sent: false, skipped: 'not an email task' }
  }

  if (typedTask.status !== 'pending') {
    return { sent: false, skipped: `task status is ${typedTask.status}` }
  }

  if (typedTask.resend_email_id) {
    return { sent: false, skipped: 'already has resend_email_id' }
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', typedTask.lead_id)
    .maybeSingle()

  if (leadError || !lead) {
    return { sent: false, error: leadError?.message ?? 'Lead not found' }
  }

  const typedLead = lead as Lead
  if (!canAutoSendLead(typedLead)) {
    return { sent: false, skipped: 'lead has no valid email' }
  }

  const draft = resolveDraft(typedTask, typedLead)
  if (!draft) {
    return { sent: false, skipped: 'no subject or body for task' }
  }

  const result = await sendSequenceEmail({
    to: typedLead.email!.trim(),
    subject: draft.subject,
    text: draft.body,
    leadId: typedLead.id,
    sequenceTaskId: typedTask.id,
    supabase,
  })

  if (!result.ok) {
    return { sent: false, error: result.error }
  }

  if (draft.subject !== typedTask.generated_subject || draft.body !== typedTask.generated_body) {
    await supabase
      .from('sequence_tasks')
      .update({
        generated_subject: draft.subject,
        generated_body: draft.body,
      })
      .eq('id', typedTask.id)
  }

  return { sent: true, resendId: result.resendId }
}
