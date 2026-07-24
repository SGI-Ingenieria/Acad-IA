import { ArrowUp, FileText, Loader2, Paperclip, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type {
  AdjuntoComentarioInput,
  ComentarioReferencia,
  UUID,
} from '@/data/types/domain'

import { VoiceDictation } from '@/components/ia/VoiceDictation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  MAX_COMMENT_ATTACHMENTS,
  MAX_COMMENT_ATTACHMENT_BYTES,
  deleteCommentAttachmentObject,
  uploadCommentAttachment,
} from '@/data/api/comentarios.api'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

const ACCEPT = 'image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv'

type LocalAttachment = {
  id: string
  file: File
  status: 'uploading' | 'done' | 'error'
  error?: string
  previewUrl?: string
  uploaded?: AdjuntoComentarioInput
}

function buildInitialHtml(quote: ComentarioReferencia | null): string {
  if (!quote?.textoSeleccionado) return ''
  const lines = quote.textoSeleccionado.split('\n')
  const escaped = lines
    .map((line) =>
      line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    )
    .join('<br>')
  return `<blockquote data-comment-quote="true">${escaped}</blockquote><p><br></p>`
}

function isImage(file: File): boolean {
  return file.type.startsWith('image/')
}

function insertPlainText(editor: HTMLDivElement, text: string) {
  const clean = text.trim()
  if (!clean) return

  const selection = window.getSelection()
  const range =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null

  if (range && editor.contains(range.startContainer)) {
    range.deleteContents()
    const node = document.createTextNode(clean)
    range.insertNode(node)
    range.setStartAfter(node)
    range.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(range)
    return
  }

  const currentText = editor.innerText.replace(/\u00a0/g, ' ')
  const prefix =
    currentText.trim().length > 0 && !/\s$/.test(currentText) ? ' ' : ''
  const lastElement = editor.lastElementChild

  if (lastElement?.tagName === 'P') {
    if (lastElement.innerHTML === '<br>') {
      lastElement.textContent = clean
      return
    }
    lastElement.append(document.createTextNode(`${prefix}${clean}`))
    return
  }

  editor.append(document.createTextNode(`${prefix}${clean}`))
}

export function CommentComposer({
  planId,
  initialQuote,
  onSubmit,
  isSubmitting,
  disabled,
  placeholder = 'Escribe un comentario…',
  appearance = 'pill',
}: {
  planId: UUID
  initialQuote: ComentarioReferencia | null
  onSubmit: (html: string, adjuntos: Array<AdjuntoComentarioInput>) => void
  isSubmitting: boolean
  disabled?: boolean
  placeholder?: string
  appearance?: 'pill' | 'flat'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [hasContent, setHasContent] = useState(false)
  const [attachments, setAttachments] = useState<Array<LocalAttachment>>([])
  const [isRecording, setIsRecording] = useState(false)
  const [pendingTranscript, setPendingTranscript] = useState('')

  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = buildInitialHtml(initialQuote)
    setHasContent(ref.current.innerText.trim().length > 0)
    ref.current.focus()
  }, [initialQuote])

  // Liberar object URLs de imágenes al desmontar.
  useEffect(() => {
    return () => {
      attachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const uploading = attachments.some((a) => a.status === 'uploading')
  const readyAttachments = attachments.filter((a) => a.status === 'done')
  const canSend =
    !disabled &&
    !isSubmitting &&
    !uploading &&
    (hasContent || readyAttachments.length > 0)

  const handleInput = () => {
    if (!ref.current) return
    setHasContent(ref.current.innerText.trim().length > 0)
  }

  useEffect(() => {
    if (isRecording || !pendingTranscript || !ref.current) return

    insertPlainText(ref.current, pendingTranscript)
    setHasContent(ref.current.innerText.trim().length > 0)
    setPendingTranscript('')
    ref.current.focus()
  }, [isRecording, pendingTranscript])

  const addFiles = (files: Array<File>) => {
    if (files.length === 0) return

    const remaining = MAX_COMMENT_ATTACHMENTS - attachments.length
    if (remaining <= 0) {
      notify.error(`Máximo ${MAX_COMMENT_ATTACHMENTS} archivos por comentario.`)
      return
    }

    const accepted: Array<File> = []
    for (const file of files) {
      if (file.size > MAX_COMMENT_ATTACHMENT_BYTES) {
        notify.error(`"${file.name}" supera el límite de 25 MB.`)
        continue
      }
      accepted.push(file)
      if (accepted.length >= remaining) break
    }

    if (files.length > remaining) {
      notify.warning(
        `Solo se añadieron ${remaining} archivo(s). Máximo ${MAX_COMMENT_ATTACHMENTS}.`,
      )
    }

    const newItems: Array<LocalAttachment> = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'uploading',
      previewUrl: isImage(file) ? URL.createObjectURL(file) : undefined,
    }))

    setAttachments((prev) => [...prev, ...newItems])
    newItems.forEach((item) => void startUpload(item))
  }

  const startUpload = async (item: LocalAttachment) => {
    try {
      const uploaded = await uploadCommentAttachment({
        planId,
        file: item.file,
      })
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === item.id ? { ...a, status: 'done', uploaded } : a,
        ),
      )
    } catch (err) {
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === item.id
            ? {
                ...a,
                status: 'error',
                error: err instanceof Error ? err.message : 'Error al subir',
              }
            : a,
        ),
      )
      notify.error(`No se pudo subir "${item.file.name}".`)
    }
  }

  const removeAttachment = (id: string) => {
    const target = attachments.find((a) => a.id === id)
    setAttachments((prev) => prev.filter((a) => a.id !== id))
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
    // Limpieza best-effort del objeto ya subido a Storage.
    if (target?.uploaded) {
      void deleteCommentAttachmentObject({
        bucket: target.uploaded.bucket,
        path: target.uploaded.path,
      }).catch(() => {})
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData.items)
    const imageFiles = items
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((f): f is File => Boolean(f))

    if (imageFiles.length > 0) {
      e.preventDefault()
      addFiles(imageFiles)
      return
    }

    // Texto: pegar como texto plano (sin formato).
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (!ref.current) return
    insertPlainText(ref.current, text)
    setHasContent(ref.current.innerText.trim().length > 0)
  }

  const insertTranscript = (text: string) => {
    const editor = ref.current
    if (!editor) {
      setPendingTranscript((prev) => {
        const sep = prev && !/\s$/.test(prev) ? ' ' : ''
        return `${prev}${sep}${text}`
      })
      return
    }

    insertPlainText(editor, text)
    editor.focus()
    setHasContent(editor.innerText.trim().length > 0)
  }

  const handleSend = () => {
    if (!ref.current || !canSend) return
    const html = ref.current.innerHTML.trim()
    const adjuntos = readyAttachments
      .map((a) => a.uploaded)
      .filter((u): u is AdjuntoComentarioInput => Boolean(u))

    onSubmit(html, adjuntos)

    ref.current.innerHTML = ''
    setHasContent(false)
    // Los adjuntos ya persistidos: limpiar estado sin borrar de Storage.
    attachments.forEach((a) => {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
    })
    setAttachments([])
  }

  return (
    <div
      className={cn(
        appearance === 'pill'
          ? 'border-input bg-card mt-3 rounded-3xl border-[0.5px] px-2.5 py-1.5 shadow-sm'
          : 'bg-transparent px-0 py-0',
        disabled && 'opacity-60',
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1 pt-1.5 pb-0.5">
          {attachments.map((a) => (
            <div
              key={a.id}
              className={cn(
                'bg-muted animate-in zoom-in-95 relative flex items-center gap-1.5 rounded-lg py-1 pr-1 pl-1.5 text-xs',
                a.status === 'error' && 'border-destructive/40 border',
              )}
            >
              {a.previewUrl ? (
                <img
                  src={a.previewUrl}
                  alt={a.file.name}
                  className="h-8 w-8 rounded object-cover"
                />
              ) : (
                <span className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded">
                  <FileText size={16} />
                </span>
              )}
              <span className="text-muted-foreground max-w-32 truncate">
                {a.file.name}
              </span>
              {a.status === 'uploading' && (
                <Loader2
                  size={13}
                  className="text-muted-foreground animate-spin"
                />
              )}
              <button
                type="button"
                onClick={() => removeAttachment(a.id)}
                className="hover:bg-background/80 text-muted-foreground rounded-full p-0.5 transition-colors"
                aria-label={`Quitar ${a.file.name}`}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex items-end gap-1.5">
        {!isRecording && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={
                  disabled || attachments.length >= MAX_COMMENT_ATTACHMENTS
                }
                aria-label="Adjuntar archivo"
                className="text-muted-foreground hover:bg-muted hover:text-foreground mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-50"
              >
                <Plus size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                <Paperclip size={16} />
                Adjuntar imagen o archivo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div
          className={cn(
            'relative min-w-0 flex-1 px-1 py-2',
            isRecording && 'hidden',
          )}
        >
          {!hasContent && (
            <div className="text-muted-foreground pointer-events-none absolute top-2 left-1 text-sm leading-6">
              {placeholder}
            </div>
          )}
          <div
            ref={ref}
            role="textbox"
            aria-multiline="true"
            aria-label="Escribir comentario"
            contentEditable={!disabled}
            suppressContentEditableWarning
            tabIndex={0}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className={cn(
              'max-h-40 min-h-6 overflow-y-auto bg-transparent p-0 text-sm leading-6 wrap-break-word whitespace-pre-wrap outline-none',
              disabled && 'cursor-not-allowed',
            )}
          />
        </div>

        <VoiceDictation
          onTranscript={insertTranscript}
          onRecordingChange={setIsRecording}
          disabled={disabled || isSubmitting}
        />

        {!isRecording && (
          <div className="mb-0.5 flex shrink-0 items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  disabled={!canSend}
                  onClick={handleSend}
                  aria-label="Comentar"
                  className="h-9 w-9 rounded-full"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4.5 w-4.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Comentar · Enter</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}
