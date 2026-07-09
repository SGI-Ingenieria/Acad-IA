import { EditorContent, useEditor } from '@tiptap/react'
import {
  ArrowUp,
  Bold,
  Copy,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  Pencil,
  Sparkles,
  TextQuote,
  Type,
  Undo2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useCommentHighlights } from './comment-highlights'
import { RichTextContent } from './RichTextContent'
import { richTextExtensions } from './RichTextEditor'
import { htmlFromPossiblyPlainText, sanitizeHtml } from './sanitize'

import type { CommentHighlight } from './comment-highlights'
import type { BorradorCampo, DraftEntity } from '@/data/api/drafts.api'
import type { DatosGeneralesField } from '@/types/plan'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAIImproveField } from '@/data/hooks/useAI'
import { useDeleteFieldDraft } from '@/data/hooks/useDrafts'
import { usePlanComments } from '@/features/comentarios/PlanCommentsContext'
import {
  getOrganicMotion,
  gsap,
  organicDuration,
  organicEase,
  useGSAP,
} from '@/lib/animations'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

import './richtext-editor.css'

/**
 * Tarjeta-canvas de un campo (estilo "canvas" de ChatGPT):
 *
 * - El texto es SIEMPRE editable: haces clic y editas directamente (no hay un
 *   botón de "editar" ni un modo de solo lectura para quien puede editar).
 * - El botón del lápiz solo abre/cierra el compositor de IA («Solicitar
 *   cambios»): describes en lenguaje natural cómo quieres reescribir el campo.
 * - Al seleccionar texto aparece un toolbar flotante pegado a la selección
 *   (solicitar cambios, formato, comentar). La selección solo marca el punto de
 *   interés: la IA siempre recibe el texto completo.
 * - "Ampliar" abre el canvas a pantalla completa; los cambios se guardan solos.
 * - Los comentarios anclados se pintan como marcatextos dentro del editor.
 */
export function CampoCanvasCard({
  campo,
  entidad,
  entidadId,
  borrador,
  highlights = [],
  onAplicar,
}: {
  campo: DatosGeneralesField
  entidad: DraftEntity
  entidadId: string
  borrador?: BorradorCampo | null
  highlights?: Array<CommentHighlight>
  onAplicar: (html: string) => Promise<boolean>
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        expanded
          ? 'bg-background animate-in fade-in fixed inset-0 z-60 flex flex-col duration-200'
          : 'bg-card border-border/70 hover:border-border flex flex-col rounded-2xl border transition-all hover:shadow-md',
      )}
    >
      <CanvasBody
        campo={campo}
        entidad={entidad}
        entidadId={entidadId}
        borrador={borrador}
        highlights={highlights}
        expanded={expanded}
        onToggleExpand={() => setExpanded((prev) => !prev)}
        onAplicar={onAplicar}
      />
    </div>
  )
}

function CanvasBody({
  campo,
  entidad,
  entidadId,
  borrador,
  highlights,
  expanded,
  onToggleExpand,
  onAplicar,
}: {
  campo: DatosGeneralesField
  entidad: DraftEntity
  entidadId: string
  borrador?: BorradorCampo | null
  highlights: Array<CommentHighlight>
  expanded: boolean
  onToggleExpand: () => void
  onAplicar: (html: string) => Promise<boolean>
}) {
  const canEdit = Boolean(campo.canEdit)
  const canUseIA = Boolean(campo.canUseIA)
  const commentScope = entidad === 'plan' ? 'plan-field' : 'subject-field'
  const commentSelector = `[data-comment-scope="${commentScope}"][data-comment-key="${campo.clave}"]`

  const deleteDraft = useDeleteFieldDraft()
  const improve = useAIImproveField()
  const { open: openComments, setPendingQuote } = usePlanComments()

  const [promptOpen, setPromptOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [excerpt, setExcerpt] = useState<string | null>(null)
  const [toolbar, setToolbar] = useState<{ top: number; left: number } | null>(
    null,
  )
  const [, force] = useState(0)

  const savedHtmlRef = useRef('')
  const promptInputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const readOnlyRef = useRef<HTMLDivElement>(null)

  // Solo lectura (p. ej. un evaluador que solo comenta): mostramos el contenido
  // renderizado con los comentarios pintados como marcatextos.
  const readOnlyHtml = useMemo(() => sanitizeHtml(campo.value), [campo.value])
  useCommentHighlights(readOnlyRef, highlights, readOnlyHtml, () =>
    openComments(),
  )

  const editor = useEditor({
    extensions: richTextExtensions,
    content:
      sanitizeHtml(
        borrador?.contenido_html ?? htmlFromPossiblyPlainText(campo.value),
      ) || '<p></p>',
    editable: canEdit,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'canvas-editor__prose focus:outline-none',
        'data-comment-scope': commentScope,
        'data-comment-key': campo.clave,
      },
    },
    onCreate: ({ editor: created }) => {
      savedHtmlRef.current = sanitizeHtml(created.getHTML())
    },
  })

  // Guardado silencioso al salir del editor (como el resto de campos del plan).
  const persist = async () => {
    if (!editor || !canEdit) return
    const html = sanitizeHtml(editor.getHTML())
    if (html === savedHtmlRef.current) return
    const ok = await onAplicar(html)
    if (ok) {
      savedHtmlRef.current = html
      if (borrador) {
        void deleteDraft.mutateAsync({
          entidad,
          entidadId,
          clave: campo.clave,
        })
      }
    }
  }

  useEffect(() => {
    if (!editor) return
    const handleBlur = () => void persist()
    editor.on('blur', handleBlur)
    return () => {
      editor.off('blur', handleBlur)
    }
    // persist depende de valores estables (editor/refs/mutaciones).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // Toolbar flotante pegado a la selección (coordenadas de ProseMirror).
  useEffect(() => {
    if (!editor) return

    const update = () => {
      force((tick) => tick + 1)
      if (!canEdit) {
        setToolbar(null)
        return
      }
      const { from, to, empty } = editor.state.selection
      if (empty || !editor.isFocused) {
        setToolbar(null)
        return
      }
      const start = editor.view.coordsAtPos(from)
      const end = editor.view.coordsAtPos(to)
      setToolbar({
        top: Math.min(start.top, end.top),
        left: (start.left + end.right) / 2,
      })
    }
    const hide = () => setToolbar(null)

    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    editor.on('blur', hide)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)

    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
      editor.off('blur', hide)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [editor, canEdit])

  useGSAP(
    () => {
      if (!getOrganicMotion() || !contentRef.current) return
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 8, scale: 0.995 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: organicDuration.base,
          ease: organicEase,
          overwrite: 'auto',
        },
      )
    },
    { scope: contentRef, dependencies: [expanded] },
  )

  const openPrompt = () => {
    setPromptOpen(true)
    setTimeout(() => promptInputRef.current?.focus(), 20)
  }

  const captureExcerpt = () => {
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from === to) return
    setExcerpt(editor.state.doc.textBetween(from, to, ' ').trim())
    setToolbar(null)
    openPrompt()
  }

  const commentSelection = () => {
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from === to) return
    const fromOffset = editor.state.doc.textBetween(0, from, '').length
    const untilOffset =
      fromOffset + editor.state.doc.textBetween(from, to, '').length
    setPendingQuote({
      textoSeleccionado: editor.state.doc.textBetween(from, to, ' ').trim(),
      contenedor: commentSelector,
      from: fromOffset,
      until: untilOffset,
      ruta: window.location.pathname,
      origen: entidad === 'plan' ? 'plan' : 'asignatura',
    })
    setToolbar(null)
    openComments()
  }

  const handleCopy = async () => {
    const html = editor ? sanitizeHtml(editor.getHTML()) : ''
    const scratch = document.createElement('div')
    scratch.innerHTML = html
    const plain = scratch.textContent
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ])
    } catch {
      await navigator.clipboard.writeText(plain)
    }
    notify.success('Contenido copiado')
  }

  const sendPrompt = async () => {
    if (!editor || !prompt.trim() || improve.isPending) return
    const html = sanitizeHtml(editor.getHTML())
    const excerptNote = excerpt
      ? `\n\nEl usuario señaló este fragmento como punto de interés (considera el texto completo, pero centra el cambio ahí):\n«${excerpt}»`
      : ''
    try {
      const result = await improve.mutateAsync({
        entidad,
        entidad_id: entidadId,
        clave: campo.clave,
        campo_schema: campo.schema ?? null,
        contenido_actual: html,
        prompt_usuario: prompt.trim() + excerptNote,
        es_richtext: true,
      })
      editor.commands.setContent(sanitizeHtml(result.contenido_mejorado))
      setPrompt('')
      setExcerpt(null)
      void persist()
    } catch (error) {
      notify.error(error, {
        description: 'No se pudo generar el cambio con IA.',
      })
    }
  }

  const canUndo = Boolean(editor?.can().undo())

  return (
    <>
      <div className="bg-muted/30 flex items-center justify-between gap-4 border-b px-6 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <h3 className="text-foreground cursor-help truncate text-base font-semibold tracking-tight">
                {campo.label}
              </h3>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs leading-relaxed">
              {campo.helperText || 'Información del campo'}
            </TooltipContent>
          </Tooltip>
          {campo.requerido && (
            <span className="text-destructive text-xs leading-none font-semibold">
              *
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {canEdit && (
            <HeaderIcon
              label="Deshacer"
              disabled={!canUndo}
              onClick={() => editor?.commands.undo()}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </HeaderIcon>
          )}
          <HeaderIcon
            label="Copiar contenido"
            onClick={() => void handleCopy()}
          >
            <Copy className="h-3.5 w-3.5" />
          </HeaderIcon>
          <HeaderIcon
            label={expanded ? 'Reducir' : 'Ampliar'}
            onClick={onToggleExpand}
          >
            {expanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </HeaderIcon>
          {canUseIA && !expanded && (
            <HeaderIcon
              label="Solicitar cambios a la IA"
              active={promptOpen}
              onClick={() => (promptOpen ? setPromptOpen(false) : openPrompt())}
            >
              <Pencil className="h-3.5 w-3.5" />
            </HeaderIcon>
          )}
        </div>
      </div>

      <div
        ref={contentRef}
        className={cn('min-h-0 flex-1', expanded ? 'overflow-y-auto' : '')}
      >
        <div
          className={cn(
            'canvas-editor',
            expanded
              ? 'mx-auto w-full max-w-3xl px-6 py-8'
              : 'max-h-[46vh] overflow-y-auto px-6 py-4',
            improve.isPending && 'pointer-events-none animate-pulse opacity-60',
          )}
        >
          {canEdit ? (
            <EditorContent editor={editor} />
          ) : (
            <div
              ref={readOnlyRef}
              data-comment-scope={commentScope}
              data-comment-key={campo.clave}
            >
              <RichTextContent html={readOnlyHtml} />
            </div>
          )}
        </div>
      </div>

      {toolbar && editor && canEdit && (
        <SelectionToolbar
          editor={editor}
          top={toolbar.top}
          left={toolbar.left}
          canUseIA={canUseIA}
          onRequestChanges={captureExcerpt}
          onComment={commentSelection}
        />
      )}

      {canEdit && canUseIA && (promptOpen || expanded) && (
        <div className="border-border/60 space-y-2 border-t px-4 py-3">
          {excerpt && (
            <div className="border-border/60 bg-muted/40 text-muted-foreground flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs">
              <TextQuote className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">«{excerpt}»</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                aria-label="Quitar fragmento señalado"
                onClick={() => setExcerpt(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div
            className={cn(
              'border-input bg-background/60 focus-within:border-ring/60 mx-auto flex items-center gap-1 rounded-full border py-1 pr-1 pl-4 transition-colors',
              expanded && 'max-w-3xl',
            )}
          >
            <Sparkles className="text-muted-foreground h-4 w-4 shrink-0" />
            <input
              ref={promptInputRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void sendPrompt()
                }
                if (event.key === 'Escape') setPromptOpen(false)
              }}
              placeholder="Describe los cambios…"
              aria-label="Describe los cambios para la IA"
              disabled={improve.isPending}
              className="placeholder:text-muted-foreground h-7 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <Button
              size="icon"
              className="h-7 w-7 rounded-full"
              aria-label="Enviar solicitud a la IA"
              disabled={!prompt.trim() || improve.isPending}
              onClick={() => void sendPrompt()}
            >
              {improve.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

const TOOLBAR_WIDTH = 440

function SelectionToolbar({
  editor,
  top,
  left,
  canUseIA,
  onRequestChanges,
  onComment,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>
  top: number
  left: number
  canUseIA: boolean
  onRequestChanges: () => void
  onComment: () => void
}) {
  const clampedLeft = Math.max(
    12,
    Math.min(left - TOOLBAR_WIDTH / 2, window.innerWidth - TOOLBAR_WIDTH - 12),
  )

  return (
    <div
      role="toolbar"
      aria-label="Acciones de selección"
      className="bg-popover text-popover-foreground animate-in fade-in zoom-in-95 fixed z-70 flex items-center gap-0.5 rounded-lg border p-1 shadow-lg duration-150"
      style={{ top: Math.max(12, top - 48), left: clampedLeft }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {canUseIA && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={onRequestChanges}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Solicitar cambios
          </Button>
          <div className="bg-border mx-0.5 h-4 w-px" />
        </>
      )}

      <ToolbarToggle
        label="Negritas"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarToggle>
      <ToolbarToggle
        label="Itálica"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarToggle>

      <div className="bg-border mx-0.5 h-4 w-px" />

      <ToolbarToggle
        label="Texto normal"
        active={editor.isActive('paragraph')}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <Type className="h-3.5 w-3.5" />
      </ToolbarToggle>
      <ToolbarToggle
        label="Encabezado 1"
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-3.5 w-3.5" />
      </ToolbarToggle>
      <ToolbarToggle
        label="Encabezado 2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarToggle>
      <ToolbarToggle
        label="Encabezado 3"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-3.5 w-3.5" />
      </ToolbarToggle>
      <ToolbarToggle
        label="Lista con viñetas"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarToggle>
      <ToolbarToggle
        label="Lista numerada"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarToggle>

      <div className="bg-border mx-0.5 h-4 w-px" />

      <ToolbarToggle label="Comentar selección" onClick={onComment}>
        <MessageSquarePlus className="h-3.5 w-3.5" />
      </ToolbarToggle>
    </div>
  )
}

function HeaderIcon({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'text-muted-foreground hover:text-foreground h-8 w-8 rounded-full',
            active && 'bg-primary/10 text-primary',
          )}
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function ToolbarToggle({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-7 w-7',
            active && 'bg-accent text-accent-foreground',
          )}
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
