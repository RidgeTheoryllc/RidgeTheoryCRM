'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Mic, MicOff, PhoneOff, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CallKeypad } from '@/components/dialer/CallKeypad'
import { useDialer } from '@/components/dialer/DialerProvider'
import { cn } from '@/lib/utils'

function formatDuration(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/** Phone status, mic picker, and in-call controls for the Call step. */
export function DialerBar() {
  const {
    deviceReady,
    callStatus,
    activeCall,
    deviceError,
    dialError,
    activeLead,
    dialing,
    inputDevices,
    selectedInputDeviceId,
    setSelectedInputDeviceId,
    audioSetupError,
    hangup,
    mute,
    sendDigits,
  } = useDialer()
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const onCall = callStatus === 'ringing' || callStatus === 'in-progress'

  useEffect(() => {
    if (callStatus !== 'in-progress') {
      setSeconds(0)
      setMuted(false)
      return
    }
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [callStatus])

  const statusLabel =
    callStatus === 'in-progress' ? 'On call'
    : callStatus === 'ringing' || dialing ? 'Connecting…'
    : deviceReady ? 'Phone ready'
    : callStatus === 'registering' ? 'Starting phone…'
    : 'Phone offline'

  return (
    <div className="rounded-lg border bg-muted/30">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
            callStatus === 'in-progress' ? 'border-blue-200 bg-blue-50 text-blue-700'
            : deviceReady ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-slate-200 bg-slate-50 text-slate-600',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              callStatus === 'in-progress' ? 'bg-blue-500' : deviceReady ? 'bg-green-500' : 'bg-slate-400',
            )}
          />
          {statusLabel}
          {callStatus === 'in-progress' && <span className="tabular-nums">· {formatDuration(seconds)}</span>}
        </span>

        <label className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <Mic className="h-3.5 w-3.5 shrink-0" />
          <select
            value={selectedInputDeviceId}
            onChange={(e) => void setSelectedInputDeviceId(e.target.value)}
            disabled={!deviceReady || onCall || inputDevices.length === 0}
            className="h-8 max-w-[14rem] truncate rounded-md border border-input bg-background px-2 text-xs disabled:opacity-60"
            aria-label="Microphone"
          >
            {inputDevices.length === 0 ? (
              <option value="">No microphones found</option>
            ) : (
              inputDevices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)
            )}
          </select>
        </label>

        <Link
          href="/dialer"
          className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Caller IDs
        </Link>
      </div>

      {activeLead && (
        <div className="flex flex-wrap items-center gap-2 border-t bg-background/60 px-3 py-2">
          <p className="mr-auto text-xs text-muted-foreground">
            {callStatus === 'in-progress' ? 'On call with' : 'Calling'}{' '}
            <span className="font-medium text-foreground">{activeLead.name}</span>
            {activeLead.company && <> · {activeLead.company}</>}
            {' '}at <span className="tabular-nums font-medium text-foreground">{activeLead.phone}</span>
            {activeLead.did && <> from <span className="tabular-nums">{activeLead.did}</span></>}
          </p>
          {callStatus === 'in-progress' && <CallKeypad sendClientDigits={sendDigits} disabled={!activeCall} />}
          <Button
            variant="outline"
            size="sm"
            disabled={!activeCall}
            onClick={() => {
              mute(!muted)
              setMuted(!muted)
            }}
          >
            {muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            {muted ? 'Unmute' : 'Mute'}
          </Button>
          <Button variant="destructive" size="sm" onClick={hangup}>
            <PhoneOff className="h-3.5 w-3.5" />
            Hang up
          </Button>
        </div>
      )}

      {(deviceError || dialError || audioSetupError) && (
        <p className="border-t px-3 py-2 text-xs text-destructive">{dialError || deviceError || audioSetupError}</p>
      )}
    </div>
  )
}
