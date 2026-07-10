import { Check, Loader2, Mic, X } from 'lucide-react'
import { useState } from 'react'

import { useAudioRecorder } from './useAudioRecorder'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTranscribeAudio } from '@/data/hooks/useTranscription'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function VoiceDictation({
  onTranscript,
  disabled,
  onRecordingChange,
  language = 'es',
  className,
}: {
  onTranscript: (text: string) => void
  disabled?: boolean
  /** Notifica al composer para ocultar el input mientras se graba. */
  onRecordingChange?: (recording: boolean) => void
  language?: string
  className?: string
}) {
  const recorder = useAudioRecorder()
  const transcribe = useTranscribeAudio()
  const [isTranscribing, setIsTranscribing] = useState(false)

  const active = recorder.state === 'recording' || isTranscribing

  const setRecording = (value: boolean) => {
    onRecordingChange?.(value)
  }

  const handleStart = async () => {
    if (disabled) return
    const ok = await recorder.start()
    if (!ok) {
      if (recorder.error === 'permission-denied') {
        notify.error('Permiso de micrófono denegado.', {
          description: 'Habilita el micrófono en el navegador para dictar.',
        })
      } else if (recorder.error === 'not-supported') {
        notify.error('Tu navegador no soporta la grabación de audio.')
      } else {
        notify.error('No se pudo iniciar la grabación.')
      }
      return
    }
    setRecording(true)
  }

  const handleCancel = () => {
    recorder.cancel()
    setRecording(false)
  }

  const handleConfirm = async () => {
    const blob = await recorder.stop()
    if (!blob) {
      setRecording(false)
      notify.error('No se capturó audio. Intenta de nuevo.')
      return
    }

    setIsTranscribing(true)
    try {
      const { text } = await transcribe.mutateAsync({
        blob,
        filename: recorder.filename,
        language,
      })
      const clean = text.trim()
      if (clean) {
        onTranscript(clean)
      } else {
        notify.info('No se detectó voz en el audio.')
      }
    } catch (err) {
      notify.error(err, { description: 'No se pudo transcribir el audio.' })
    } finally {
      setIsTranscribing(false)
      setRecording(false)
    }
  }

  if (!recorder.isSupported) return null

  if (!active) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={() => void handleStart()}
            aria-label="Dictar por voz"
            className={cn(
              'text-muted-foreground hover:text-foreground h-9 w-9 shrink-0 rounded-full',
              className,
            )}
          >
            <Mic className="h-4.5 w-4.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Dictar por voz</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="animate-in fade-in flex min-w-0 flex-1 items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleCancel}
        disabled={isTranscribing}
        aria-label="Cancelar dictado"
        className="text-muted-foreground hover:text-destructive h-9 w-9 shrink-0 rounded-full"
      >
        <X className="h-4.5 w-4.5" />
      </Button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          className="flex h-6 min-w-0 flex-1 items-center gap-0.5 overflow-hidden motion-reduce:hidden"
          aria-hidden="true"
        >
          {recorder.levels.map((level, index) => (
            <span
              key={index}
              className="bg-primary/60 w-0.5 shrink-0 rounded-full transition-[height] duration-100"
              style={{ height: `${Math.max(8, level * 100)}%` }}
            />
          ))}
        </div>
        <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
          {isTranscribing
            ? 'Transcribiendo…'
            : formatDuration(recorder.durationMs)}
        </span>
      </div>

      <Button
        type="button"
        size="icon"
        onClick={() => void handleConfirm()}
        disabled={isTranscribing}
        aria-label="Detener y transcribir"
        className="h-9 w-9 shrink-0 rounded-full"
      >
        {isTranscribing ? (
          <Loader2 className="h-4.5 w-4.5 animate-spin" />
        ) : (
          <Check className="h-4.5 w-4.5" />
        )}
      </Button>
    </div>
  )
}
