'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTwilioDevice } from '@/hooks/useTwilioDevice'
import { dialerJson } from '@/lib/dialer/client'
import type { CallLogRecord } from '@/lib/dialer/types'
import type { Lead, SequenceTask } from '@/types'

type ActiveLead = { leadId: string; taskId: string | null; name: string; company: string; phone: string; did?: string }

type DialerContextValue = ReturnType<typeof useTwilioDevice> & {
  enabled: boolean
  activeLead: ActiveLead | null
  dialing: boolean
  dialError: string
  callLogs: CallLogRecord[]
  dialLead: (lead: Lead, task?: SequenceTask) => Promise<void>
  refreshCallLogs: () => Promise<void>
}

const DialerContext = createContext<DialerContextValue | null>(null)

/** Registers the rep's browser phone once `enabled` and shares call state with the Call step. */
export function DialerProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const device = useTwilioDevice(enabled)
  const [activeLead, setActiveLead] = useState<ActiveLead | null>(null)
  const [dialing, setDialing] = useState(false)
  const [dialError, setDialError] = useState('')
  const [callLogs, setCallLogs] = useState<CallLogRecord[]>([])
  const wasOnCallRef = useRef(false)
  const { callStatus, activeCall, expectOutboundLeg, clearExpectedOutboundLeg } = device

  const refreshCallLogs = useCallback(async () => {
    try {
      setCallLogs(await dialerJson<CallLogRecord[]>('/api/dialer/call-logs'))
    } catch {
      // Table missing or not signed in — the Call step still works without history.
    }
  }, [])

  useEffect(() => {
    if (enabled) void refreshCallLogs()
  }, [enabled, refreshCallLogs])

  // When a call ends, clear the banner and pick up the log row Twilio's status callback writes.
  useEffect(() => {
    const onCall = callStatus === 'ringing' || callStatus === 'in-progress'
    if (onCall) {
      wasOnCallRef.current = true
      return
    }
    if (!wasOnCallRef.current || dialing || activeCall) return
    wasOnCallRef.current = false
    setActiveLead(null)
    const timers = [1500, 5000, 12000].map((ms) => setTimeout(() => void refreshCallLogs(), ms))
    return () => timers.forEach(clearTimeout)
  }, [activeCall, callStatus, dialing, refreshCallLogs])

  // Twilio accepted the call but never rang this browser (webhook URL unreachable, etc.).
  useEffect(() => {
    if (!activeLead || dialing || activeCall || wasOnCallRef.current) return
    const timer = setTimeout(() => {
      clearExpectedOutboundLeg()
      setActiveLead(null)
      setDialError('The call never connected to this browser. Check that TWILIO_WEBHOOK_BASE_URL is reachable by Twilio.')
    }, 25_000)
    return () => clearTimeout(timer)
  }, [activeCall, activeLead, clearExpectedOutboundLeg, dialing])

  const dialLead = useCallback(async (lead: Lead, task?: SequenceTask) => {
    if (dialing || activeCall) return
    setDialError('')
    setDialing(true)
    expectOutboundLeg()
    setActiveLead({ leadId: lead.id, taskId: task?.id ?? null, name: lead.name, company: lead.company_name, phone: lead.phone })
    try {
      const data = await dialerJson<{ did: string }>('/api/twilio/call', {
        method: 'POST',
        body: JSON.stringify({ lead_id: lead.id, sequence_task_id: task?.id }),
      })
      setActiveLead((prev) => (prev ? { ...prev, did: data.did } : prev))
    } catch (error) {
      clearExpectedOutboundLeg()
      setActiveLead(null)
      setDialError(error instanceof Error ? error.message : 'Call failed.')
    } finally {
      setDialing(false)
    }
  }, [activeCall, clearExpectedOutboundLeg, dialing, expectOutboundLeg])

  return (
    <DialerContext.Provider
      value={{ ...device, enabled, activeLead, dialing, dialError, callLogs, dialLead, refreshCallLogs }}
    >
      {children}
    </DialerContext.Provider>
  )
}

export function useDialer(): DialerContextValue {
  const ctx = useContext(DialerContext)
  if (!ctx) throw new Error('useDialer must be used within DialerProvider')
  return ctx
}
