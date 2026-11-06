'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Call, Device, type AudioHelper } from '@twilio/voice-sdk'
import {
  dialerJson,
  readPreferredMicId,
  TWILIO_AUDIO_TRACK_CONSTRAINTS,
  TWILIO_RTC_CONSTRAINTS,
  writePreferredMicId,
} from '@/lib/dialer/client'

export type TwilioCallStatus = 'idle' | 'registering' | 'ready' | 'ringing' | 'in-progress' | 'error'

export type TwilioInputDevice = { deviceId: string; label: string }

function listInputDevices(audio: AudioHelper): TwilioInputDevice[] {
  return Array.from(audio.availableInputDevices.values()).map((device, index) => ({
    deviceId: device.deviceId,
    label: device.label?.trim() || `Microphone ${index + 1}`,
  }))
}

/**
 * Registers a Twilio Voice Device for the signed-in rep. Click-to-call rings this
 * browser first; legs we're expecting are auto-accepted.
 */
export function useTwilioDevice(enabled: boolean) {
  const [device, setDevice] = useState<Device | null>(null)
  const [deviceReady, setDeviceReady] = useState(false)
  const [activeCall, setActiveCall] = useState<Call | null>(null)
  const [callStatus, setCallStatus] = useState<TwilioCallStatus>('idle')
  const [deviceError, setDeviceError] = useState('')
  const [inputDevices, setInputDevices] = useState<TwilioInputDevice[]>([])
  const [selectedInputDeviceId, setSelectedInputDeviceIdState] = useState('')
  const [audioSetupError, setAudioSetupError] = useState('')
  /** Prevents double accept() (Strict Mode / duplicate effects), which drops the call. */
  const acceptedCallRef = useRef<Call | null>(null)
  /** While > Date.now(), the next incoming client leg is our own click-to-call and is auto-accepted. */
  const expectOutboundUntilRef = useRef(0)
  const audioRef = useRef<AudioHelper | null>(null)

  const refreshInputDevices = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    const listed = listInputDevices(audio)
    setInputDevices(listed)
    setSelectedInputDeviceIdState(audio.inputDevice?.deviceId ?? listed[0]?.deviceId ?? '')
  }, [])

  const setupAudio = useCallback(async (audio: AudioHelper) => {
    audioRef.current = audio
    setAudioSetupError('')
    try {
      await audio.setAudioConstraints(TWILIO_AUDIO_TRACK_CONSTRAINTS)
      refreshInputDevices()
      const preferred = readPreferredMicId()
      if (preferred && audio.availableInputDevices.has(preferred)) {
        await audio.setInputDevice(preferred)
        setSelectedInputDeviceIdState(preferred)
      }
    } catch (error) {
      setAudioSetupError(error instanceof Error ? error.message : 'Could not apply microphone settings')
    }
  }, [refreshInputDevices])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let mounted: Device | null = null
    let onDeviceChange: (() => void) | null = null
    const fetchToken = () => dialerJson<{ token: string }>('/api/twilio/token')

    async function initialize() {
      try {
        setCallStatus('registering')
        const { token } = await fetchToken()
        if (cancelled) return
        setDeviceError('')

        mounted = new Device(token, {
          closeProtection: true,
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          // Rotator default; set NEXT_PUBLIC_TWILIO_EDGE (e.g. ashburn, umatilla) closest to your reps.
          edge: process.env.NEXT_PUBLIC_TWILIO_EDGE || 'singapore',
        })

        mounted.on('registered', () => {
          if (cancelled) return
          setDeviceReady(true)
          setCallStatus('ready')
          const audio = mounted?.audio
          if (audio) {
            void setupAudio(audio)
            onDeviceChange = refreshInputDevices
            audio.on('deviceChange', onDeviceChange)
          }
        })

        mounted.on('incoming', (call: Call) => {
          if (cancelled) return
          if (!(expectOutboundUntilRef.current > Date.now())) {
            call.reject()
            return
          }
          expectOutboundUntilRef.current = 0
          setActiveCall(call)
          setCallStatus('ringing')

          call.on('accept', () => !cancelled && setCallStatus('in-progress'))
          const backToReady = () => {
            if (cancelled) return
            setActiveCall(null)
            setCallStatus('ready')
          }
          call.on('disconnect', backToReady)
          call.on('cancel', backToReady)
          call.on('reject', backToReady)
          call.on('error', (error: Error) => {
            if (cancelled) return
            setDeviceError(error.message)
            setActiveCall(null)
            setCallStatus('ready')
          })

          if (acceptedCallRef.current !== call) {
            acceptedCallRef.current = call
            call.accept({ rtcConstraints: TWILIO_RTC_CONSTRAINTS })
          }
        })

        mounted.on('error', (error: Error) => {
          if (cancelled) return
          setDeviceError(error.message)
          setCallStatus('error')
          setDeviceReady(false)
        })

        mounted.on('tokenWillExpire', async () => {
          try {
            const refreshed = await fetchToken()
            await mounted?.updateToken(refreshed.token)
          } catch (error) {
            if (cancelled) return
            setDeviceError(error instanceof Error ? error.message : 'Failed to refresh calling token')
          }
        })

        setDevice(mounted)
        await mounted.register()
      } catch (error) {
        if (cancelled) return
        setDeviceError(error instanceof Error ? error.message : 'Failed to start the dialer')
        setCallStatus('error')
      }
    }

    void initialize()

    return () => {
      cancelled = true
      if (audioRef.current && onDeviceChange) audioRef.current.removeListener('deviceChange', onDeviceChange)
      audioRef.current = null
      mounted?.destroy()
      setDevice(null)
      setActiveCall(null)
      setDeviceReady(false)
      setCallStatus('idle')
      setInputDevices([])
      setSelectedInputDeviceIdState('')
    }
  }, [enabled, refreshInputDevices, setupAudio])

  useEffect(() => {
    if (!activeCall) acceptedCallRef.current = null
  }, [activeCall])

  const hangup = useCallback(() => {
    if (activeCall) activeCall.disconnect()
    else device?.disconnectAll()
  }, [activeCall, device])

  const mute = useCallback((muted: boolean) => activeCall?.mute(muted), [activeCall])

  const sendDigits = useCallback((digits: string) => {
    if (activeCall && callStatus === 'in-progress') activeCall.sendDigits(digits)
  }, [activeCall, callStatus])

  const setSelectedInputDeviceId = useCallback(async (deviceId: string) => {
    const audio = audioRef.current
    if (!audio || !deviceId) return
    if (callStatus === 'ringing' || callStatus === 'in-progress') {
      setAudioSetupError('Hang up before changing microphone.')
      return
    }
    setAudioSetupError('')
    try {
      await audio.setInputDevice(deviceId)
      writePreferredMicId(deviceId)
      setSelectedInputDeviceIdState(deviceId)
    } catch (error) {
      setAudioSetupError(error instanceof Error ? error.message : 'Could not switch microphone')
    }
  }, [callStatus])

  const expectOutboundLeg = useCallback(() => {
    expectOutboundUntilRef.current = Date.now() + 25_000
  }, [])

  const clearExpectedOutboundLeg = useCallback(() => {
    expectOutboundUntilRef.current = 0
  }, [])

  return {
    deviceReady,
    activeCall,
    callStatus,
    deviceError,
    inputDevices,
    selectedInputDeviceId,
    setSelectedInputDeviceId,
    audioSetupError,
    hangup,
    mute,
    sendDigits,
    expectOutboundLeg,
    clearExpectedOutboundLeg,
  }
}
