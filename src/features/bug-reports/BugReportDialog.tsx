import {
  Bug,
  CheckCircle2,
  ClipboardPaste,
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  Paperclip,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { captureCurrentView } from './capture'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  BUG_REPORT_MAX_ATTACHMENTS,
  createBugReport,
  validateBugReportAttachment,
} from '@/data/api/bugReports.api'

type BugReportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type LocalAttachment = {
  file: File
  name: string
  mime: string
  previewUrl: string
}

const emptyFields = {
  summary: '',
  description: '',
  steps: '',
  expected: '',
}

function fieldValue(
  label: string,
  value: string,
  placeholder: string,
  onChange: (value: string) => void,
  multiline = false,
) {
  return (
    <div className="space-y-relacionado">
      <Label>{label}</Label>
      {multiline ? (
        <Textarea
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
        />
      ) : (
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  )
}

export function BugReportDialog({ open, onOpenChange }: BugReportDialogProps) {
  const [fields, setFields] = useState(emptyFields)
  const [attachments, setAttachments] = useState<Array<LocalAttachment>>([])
  const [captureState, setCaptureState] = useState<
    'idle' | 'capturing' | 'captured' | 'cancelled' | 'unavailable'
  >('idle')
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [captureAttempt, setCaptureAttempt] = useState(0)
  const [success, setSuccess] = useState<{ url: string; title: string } | null>(
    null,
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const startedCaptureAttemptRef = useRef<number | null>(null)
  const url = typeof window === 'undefined' ? '' : window.location.href
  const viewport =
    typeof window === 'undefined'
      ? ''
      : `${window.innerWidth}×${window.innerHeight}`

  const addFiles = useCallback(
    (files: Array<File>): number => {
      const remaining = BUG_REPORT_MAX_ATTACHMENTS - attachments.length
      if (remaining <= 0) {
        toast.warning(
          `Puedes adjuntar hasta ${BUG_REPORT_MAX_ATTACHMENTS} archivos.`,
        )
        return 0
      }
      const candidates = files.slice(0, remaining)
      const next: Array<LocalAttachment> = []
      for (const file of candidates) {
        const validationError = validateBugReportAttachment(file)
        if (validationError) {
          toast.error(validationError)
          continue
        }
        next.push({
          file,
          name: file.name || 'captura.png',
          mime: file.type,
          previewUrl: URL.createObjectURL(file),
        })
      }
      if (next.length) setAttachments((current) => [...current, ...next])
      return next.length
    },
    [attachments.length],
  )

  useEffect(() => {
    if (
      !open ||
      success ||
      startedCaptureAttemptRef.current === captureAttempt
    ) {
      return
    }
    startedCaptureAttemptRef.current = captureAttempt
    setCaptureState('capturing')
    void (async () => {
      const result = await captureCurrentView()
      if (!result.file) {
        setCaptureState(result.status)
        return
      }
      const added = addFiles([result.file])
      setCaptureState(added > 0 ? 'captured' : 'unavailable')
    })()
  }, [addFiles, captureAttempt, open, success])

  function reset() {
    setFields(emptyFields)
    setAttachments([])
    setCaptureState('idle')
    setSuccess(null)
    setCaptureAttempt(0)
    startedCaptureAttemptRef.current = null
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) return
    if (!nextOpen && !isSubmitting) {
      if (attachments.length) {
        attachments.forEach((attachment) =>
          URL.revokeObjectURL(attachment.previewUrl),
        )
      }
      reset()
    }
    onOpenChange(nextOpen)
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(event.clipboardData.files)
    if (!files.length) return
    event.preventDefault()
    addFiles(files)
  }

  async function submit() {
    if (!fields.summary.trim() || !fields.description.trim()) {
      toast.error('Completa el resumen y la descripción del problema.')
      return
    }
    setIsSubmitting(true)
    try {
      const result = await createBugReport({
        ...fields,
        url,
        userAgent: navigator.userAgent,
        viewport,
        attachments: attachments.map(({ file }) => ({ file })),
      })
      setSuccess({ url: result.issueUrl, title: result.issueTitle })
      toast.success('Reporte publicado en GitHub.')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudo publicar el reporte.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function removeAttachment(index: number) {
    const attachment = attachments.at(index)
    if (!attachment) return
    URL.revokeObjectURL(attachment.previewUrl)
    setAttachments((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    )
  }

  function clearAttachments() {
    attachments.forEach((attachment) =>
      URL.revokeObjectURL(attachment.previewUrl),
    )
    setAttachments([])
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {success ? (
          <div className="space-y-seccion py-grupo text-center">
            <CheckCircle2 className="text-primary mx-auto size-12" />
            <DialogHeader>
              <DialogTitle>Reporte publicado</DialogTitle>
              <DialogDescription>{success.title}</DialogDescription>
            </DialogHeader>
            <Button asChild>
              <a href={success.url} target="_blank" rel="noreferrer">
                Ver issue en GitHub <ExternalLink />
              </a>
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="gap-control flex items-center">
                <Bug className="text-primary" /> Reportar un problema
              </DialogTitle>
              <DialogDescription>
                Describe lo que ocurrió y adjunta evidencia si la tienes. El
                reporte se publicará como issue en GitHub.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-grupo" onPaste={handlePaste}>
              {fieldValue(
                'Resumen',
                fields.summary,
                'Ej. No se puede guardar una asignatura',
                (value) =>
                  setFields((current) => ({ ...current, summary: value })),
              )}
              {fieldValue(
                '¿Qué ocurrió?',
                fields.description,
                'Describe el problema que observaste',
                (value) =>
                  setFields((current) => ({ ...current, description: value })),
                true,
              )}
              {fieldValue(
                'Pasos para reproducir (opcional)',
                fields.steps,
                '1. Abre… 2. Selecciona… 3. Pulsa…',
                (value) =>
                  setFields((current) => ({ ...current, steps: value })),
                true,
              )}
              {fieldValue(
                'Resultado esperado (opcional)',
                fields.expected,
                '¿Qué esperabas que ocurriera?',
                (value) =>
                  setFields((current) => ({ ...current, expected: value })),
                true,
              )}

              <div className="space-y-relacionado">
                <Label>URL donde ocurrió</Label>
                <Input
                  value={url}
                  readOnly
                  className="text-muted-foreground bg-muted/40"
                />
              </div>

              <div
                className={`border-border/70 bg-muted/20 space-y-control p-control rounded-lg border ${isDragging ? 'border-primary bg-primary/5' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setIsDragging(false)
                  void addFiles(Array.from(event.dataTransfer.files))
                }}
              >
                <div className="gap-control flex items-center justify-between">
                  <div>
                    <Label className="gap-relacionado flex items-center">
                      <ImagePlus className="size-4" /> Evidencia visual
                    </Label>
                    <p className="text-muted-foreground mt-micro text-xs">
                      La captura se intenta al abrir el formulario. Puedes
                      descartarla o reemplazarla.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => inputRef.current?.click()}
                  >
                    <Upload /> Adjuntar
                  </Button>
                </div>
                {captureState === 'capturing' ? (
                  <p className="text-muted-foreground gap-relacionado flex items-center text-sm">
                    <LoaderCircle className="size-4 animate-spin" /> Capturando
                    la vista actual…
                  </p>
                ) : null}
                {captureState === 'cancelled' ||
                captureState === 'unavailable' ? (
                  <p className="text-muted-foreground text-xs">
                    No se agregó una captura automática. Puedes pegar o adjuntar
                    una imagen.
                  </p>
                ) : null}
                {attachments.length ? (
                  <div className="space-y-relacionado">
                    {attachments.map((attachment, index) => (
                      <div
                        key={attachment.previewUrl}
                        className="border-border bg-background gap-control p-relacionado flex items-center rounded-md border"
                      >
                        {attachment.mime.startsWith('image/') ? (
                          <img
                            src={attachment.previewUrl}
                            alt="Vista previa del reporte"
                            className="size-16 rounded object-cover"
                          />
                        ) : (
                          <Paperclip className="text-muted-foreground size-5" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {attachment.name}
                        </span>
                        {index === 0 && captureState === 'captured' ? (
                          <span className="text-muted-foreground text-xs">
                            Captura
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Quitar ${attachment.name}`}
                          onClick={() => void removeAttachment(index)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className="text-muted-foreground gap-relacionado flex items-center text-xs">
                  <ClipboardPaste className="size-3.5" /> También puedes pegar
                  una imagen directamente en este formulario.
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  hidden
                  onChange={(event) => {
                    addFiles(Array.from(event.target.files ?? []))
                    event.currentTarget.value = ''
                  }}
                />
              </div>

              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>
                  Se enviará con tu sesión autenticada y los datos técnicos
                  básicos del navegador.
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearAttachments()
                    setCaptureAttempt((current) => current + 1)
                    setCaptureState('idle')
                  }}
                >
                  <RefreshCw /> Reintentar captura
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                onClick={() => void submit()}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Bug />
                )}{' '}
                {isSubmitting ? 'Publicando…' : 'Publicar reporte'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
