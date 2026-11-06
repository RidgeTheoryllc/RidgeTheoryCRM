'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Grid3x3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { dialerFetch } from '@/lib/dialer/client'
import { cn } from '@/lib/utils'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const

/** IVR keypad: queued taps are sent to the lead's line (or the browser leg as a fallback). */
export function CallKeypad({
  sendClientDigits,
  disabled,
}: {
  sendClientDigits: (digits: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const queuedRef = useRef('')
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushingRef = useRef(false)

  const sendPayload = useCallback(async (payload: string) => {
    try {
      const res = await dialerFetch('/api/twilio/send-digits', {
        method: 'POST',
        body: JSON.stringify({ digits: payload }),
      })
      const data = (await res.json()) as { success?: boolean; fallback?: string; error?: string }
      if (res.ok && data.success) {
        setFeedback(`Sent ${payload.toUpperCase()}`)
      } else if (data.fallback === 'client') {
        sendClientDigits(payload)
        setFeedback(`Sent ${payload.toUpperCase()}`)
      } else {
        setFeedback(data.error ?? 'Could not send tone')
      }
    } catch {
      sendClientDigits(payload)
      setFeedback(`Sent ${payload.toUpperCase()}`)
    } finally {
      setTimeout(() => setFeedback(''), 2000)
    }
  }, [sendClientDigits])

  const flush = useCallback(async () => {
    if (flushingRef.current || !queuedRef.current) return
    flushingRef.current = true
    const payload = queuedRef.current
    queuedRef.current = ''
    try {
      await sendPayload(payload)
    } finally {
      flushingRef.current = false
      if (queuedRef.current) flushTimerRef.current = setTimeout(() => void flush(), 0)
    }
  }, [sendPayload])

  const press = useCallback((key: string) => {
    if (disabled) return
    queuedRef.current += key
    setFeedback(`Queued ${queuedRef.current.toUpperCase()}`)
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    flushTimerRef.current = setTimeout(() => void flush(), 200)
  }, [disabled, flush])

  useEffect(() => () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
  }, [])

  return (
    <div className="relative">
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => setOpen((v) => !v)}>
        <Grid3x3 className="h-3.5 w-3.5" />
        {open ? 'Hide keypad' : 'Keypad'}
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-48 rounded-lg border bg-popover p-2 shadow-lg">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Wait for the prompt, then tap
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {KEYS.map((key) => (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => press(key)}
                className={cn(
                  'flex h-9 items-center justify-center rounded-md border bg-background text-sm font-semibold',
                  'transition-colors hover:bg-accent disabled:opacity-50',
                )}
              >
                {key}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => press('w')}
            className="mt-1.5 w-full rounded-md border bg-background py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            Pause (½s)
          </button>
          {feedback && <p className="mt-1.5 text-center text-[10px] font-medium text-primary">{feedback}</p>}
        </div>
      )}
    </div>
  )
}
