import { useCallback, useEffect, useRef, useState } from 'react'

export type AudioRecorderState = 'idle' | 'recording'

export type AudioRecorderError =
  'permission-denied' | 'not-supported' | 'no-audio' | 'unknown'

const WAVEFORM_BARS = 28

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return undefined
}

function extensionForMime(mime: string): string {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

/**
 * Envuelve `MediaRecorder` para dictado por voz: start/stop/cancel, duración y
 * un nivel de amplitud (para animar una onda). No transcribe — sólo produce el
 * `Blob` de audio; la transcripción se hace en el consumidor.
 */
export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>('idle')
  const [error, setError] = useState<AudioRecorderError | null>(null)
  const [durationMs, setDurationMs] = useState(0)
  const [levels, setLevels] = useState<Array<number>>(() =>
    Array(WAVEFORM_BARS).fill(0),
  )

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Array<Blob>>([])
  const mimeRef = useRef<string>('audio/webm')

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isSupported =
    typeof navigator !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean((navigator.mediaDevices as MediaDevices | undefined)?.getUserMedia)

  const teardown = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (durationTimerRef.current != null) {
      clearInterval(durationTimerRef.current)
      durationTimerRef.current = null
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    analyserRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    recorderRef.current = null
  }, [])

  useEffect(() => () => teardown(), [teardown])

  const runWaveformLoop = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return
    const buffer = new Uint8Array(analyser.fftSize)

    const tick = () => {
      analyser.getByteTimeDomainData(buffer)
      let sumSquares = 0
      for (const sample of buffer) {
        const centered = (sample - 128) / 128
        sumSquares += centered * centered
      }
      const rms = Math.sqrt(sumSquares / buffer.length)
      const normalized = Math.min(1, rms * 3.2)
      setLevels((prev) => {
        const next = prev.slice(1)
        next.push(normalized)
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const start = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('not-supported')
      return false
    }
    if (state === 'recording') return true

    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mime = pickMimeType()
      mimeRef.current = mime ?? 'audio/webm'
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.start()

      // Onda animada
      const win = window as unknown as {
        AudioContext?: typeof AudioContext
        webkitAudioContext?: typeof AudioContext
      }
      const AudioCtx = win.AudioContext ?? win.webkitAudioContext
      if (AudioCtx) {
        const ctx = new AudioCtx()
        audioCtxRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        analyserRef.current = analyser
        runWaveformLoop()
      }

      startedAtRef.current = Date.now()
      setDurationMs(0)
      setLevels(Array(WAVEFORM_BARS).fill(0))
      durationTimerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startedAtRef.current)
      }, 200)

      setState('recording')
      return true
    } catch (err) {
      teardown()
      const name = (err as { name?: string }).name
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'permission-denied'
          : 'unknown',
      )
      return false
    }
  }, [isSupported, runWaveformLoop, state, teardown])

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        teardown()
        setState('idle')
        resolve(null)
        return
      }

      recorder.onstop = () => {
        const type = mimeRef.current
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type })
            : null
        chunksRef.current = []
        teardown()
        setState('idle')
        resolve(blob && blob.size > 0 ? blob : null)
      }
      recorder.stop()
    })
  }, [teardown])

  const cancel = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      try {
        recorder.stop()
      } catch {
        /* noop */
      }
    }
    chunksRef.current = []
    teardown()
    setDurationMs(0)
    setState('idle')
  }, [teardown])

  const filename = `dictado.${extensionForMime(mimeRef.current)}`

  return {
    state,
    error,
    durationMs,
    levels,
    isSupported,
    start,
    stop,
    cancel,
    filename,
  }
}
