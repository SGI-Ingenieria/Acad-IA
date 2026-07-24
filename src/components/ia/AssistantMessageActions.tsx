import {
  CalendarClock,
  Copy,
  Ellipsis,
  LoaderCircle,
  RefreshCw,
  Square,
  Volume2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  generarVozRespuestaIA,
  MAX_ASSISTANT_SPEECH_CHARS,
} from '@/data/api/aiSpeech.api'
import { notify } from '@/lib/toast'

type SpeechState = 'idle' | 'loading' | 'playing'

export function formatAssistantAnsweredAt(value?: string | null) {
  if (!value) return 'Fecha de respuesta no disponible'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha de respuesta no disponible'

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date)
}

function speechExcerpt(content: string) {
  if (content.length <= MAX_ASSISTANT_SPEECH_CHARS) return content

  const bounded = content.slice(0, MAX_ASSISTANT_SPEECH_CHARS)
  return bounded.replace(/\s+\S*$/, '').trim()
}

export function AssistantMessageActions({
  content,
  answeredAt,
  status,
  retrying = false,
  onRetry,
}: {
  content: string
  answeredAt?: string | null
  status?: 'processing' | 'completed' | 'error' | 'cancelled'
  retrying?: boolean
  onRetry?: () => void | Promise<void>
}) {
  const [speechState, setSpeechState] = useState<SpeechState>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const isCompleted = status === 'completed'

  const stopSpeech = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    setSpeechState('idle')
  }, [])

  useEffect(() => stopSpeech, [stopSpeech])

  const copyResponse = async () => {
    try {
      await navigator.clipboard.writeText(content)
      notify.success('Respuesta copiada.')
    } catch (error) {
      notify.error(error)
    }
  }

  const toggleSpeech = async () => {
    if (speechState === 'playing') {
      stopSpeech()
      return
    }
    if (speechState === 'loading') return

    const spokenText = speechExcerpt(content.trim())
    if (!spokenText) return

    notify.info('La reproducción usa una voz generada por IA.', {
      description: 'No corresponde a la voz de una persona real.',
    })
    if (spokenText.length < content.trim().length) {
      notify.warning('Se leerá una versión abreviada de la respuesta.')
    }

    setSpeechState('loading')
    try {
      const audioBlob = await generarVozRespuestaIA(spokenText)
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audioUrlRef.current = audioUrl
      audio.onended = stopSpeech
      audio.onerror = () => {
        stopSpeech()
        notify.error('No se pudo reproducir la lectura en voz alta.')
      }
      await audio.play()
      setSpeechState('playing')
    } catch (error) {
      stopSpeech()
      notify.error(error)
    }
  }

  return (
    <div className="text-muted-foreground mt-2 flex min-h-8 flex-wrap items-center gap-0.5">
      {isCompleted ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Copiar respuesta"
              onClick={() => void copyResponse()}
            >
              <Copy />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copiar respuesta</TooltipContent>
        </Tooltip>
      ) : null}

      {onRetry ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Volver a generar la respuesta"
              disabled={retrying}
              onClick={() => void onRetry()}
            >
              {retrying ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Volver a generar</TooltipContent>
        </Tooltip>
      ) : null}

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Más acciones de la respuesta"
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          {isCompleted ? (
            <DropdownMenuItem
              disabled={speechState === 'loading'}
              onSelect={(event) => {
                event.preventDefault()
                void toggleSpeech()
              }}
            >
              {speechState === 'loading' ? (
                <LoaderCircle className="animate-spin" />
              ) : speechState === 'playing' ? (
                <Square />
              ) : (
                <Volume2 />
              )}
              {speechState === 'playing'
                ? 'Detener lectura'
                : 'Leer en voz alta'}
            </DropdownMenuItem>
          ) : null}
          {isCompleted ? <DropdownMenuSeparator /> : null}
          <DropdownMenuLabel className="text-muted-foreground flex items-start gap-2 text-xs leading-5 font-normal whitespace-normal">
            <CalendarClock className="mt-0.5 size-4 shrink-0" />
            <span>Respondido: {formatAssistantAnsweredAt(answeredAt)}</span>
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>

      {speechState !== 'idle' ? (
        <span className="ml-1 text-[11px]" aria-live="polite">
          {speechState === 'loading' ? 'Preparando' : 'Reproduciendo'} voz
          generada por IA
        </span>
      ) : null}
    </div>
  )
}
