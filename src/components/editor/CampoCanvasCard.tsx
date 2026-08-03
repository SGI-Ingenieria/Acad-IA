import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import {
  Bold,
  Copy,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  Pencil,
  Redo2,
  Sparkles,
  TextQuote,
  Type,
  Undo2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useCommentHighlights } from './comment-highlights'
import { RichTextContent } from './RichTextContent'
import { richTextExtensions } from './RichTextEditor'
import {
  htmlFromPossiblyPlainText,
  isEmptyRichText,
  sanitizeHtml,
} from './sanitize'
import { calcularPosicionToolbarSeleccion } from './selection-toolbar-position'
import {
  ControlesZoomTipografico,
  useZoomTipografico,
} from './zoom-tipografico'

import type { CommentHighlight } from './comment-highlights'
import type { ZoomTipografico } from './zoom-tipografico'
import type { PayloadMejorarCampo, ResultadoMejorarCampo } from '@/data'
import type { BorradorCampo, DraftEntity } from '@/data/api/drafts.api'
import type { DatosGeneralesField } from '@/types/plan'
import type { ReactNode } from 'react'

import { AIRequestComposer } from '@/components/ia/AIRequestComposer'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAIImproveField } from '@/data/hooks/useAI'
import { useDeleteFieldDraft } from '@/data/hooks/useDrafts'
import {
  EsqueletoAgente,
  idCampoAgente,
  useAccionAgente,
  useAgenteOpcional,
  usePropsHalo,
} from '@/features/agente'
import { usePlanComments } from '@/features/comentarios/PlanCommentsContext'
import {
  getOrganicMotion,
  gsap,
  organicDuration,
  organicEase,
  useGSAP,
} from '@/lib/animations'
import { ejemploDeEsquema } from '@/lib/campo-ejemplos'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

import './richtext-editor.css'

/** Renglones del hueco de carga, de más a menos ancho. */
const ANCHOS_ESQUELETO = ['w-11/12', 'w-full', 'w-10/12', 'w-7/12'] as const

/**
 * Geometría del hueco de carga, en píxeles y en un solo sitio porque de ella
 * depende cuántos renglones caben. Si cambian las clases del contenedor
 * —`py-4`, `h-4`, `space-y-2`— hay que cambiar estos números con ellas.
 */
const ESQUELETO_RENGLON = 16
const ESQUELETO_SEPARACION = 8
const ESQUELETO_MARGEN_VERTICAL = 32
const TOOLBAR_HEIGHT = 40
const TOOLBAR_GAP = 8
const TOOLBAR_VIEWPORT_MARGIN = 12

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
 * - `destacado` marca un campo que se está comparando en contexto (los tres
 *   fundamentos del plan cuando se enfocan): recibe superficie propia, título
 *   mayor y letra por encima de la base.
 */
export function CampoCanvasCard({
  campo,
  entidad,
  entidadId,
  borrador,
  highlights = [],
  destacado = false,
  placeholder,
  onAplicar,
}: {
  campo: DatosGeneralesField
  entidad: DraftEntity
  entidadId: string
  borrador?: BorradorCampo | null
  highlights?: Array<CommentHighlight>
  destacado?: boolean
  placeholder?: string
  onAplicar: (html: string) => Promise<boolean>
}) {
  const [expanded, setExpanded] = useState(false)
  // La lupa sólo existe mientras la tarjeta está ampliada, así que su paso sólo
  // cuenta ahí: al plegarla el texto recupera el tamaño de la tarjeta.
  const zoom = useZoomTipografico(destacado ? 1.12 : 1, expanded)

  // El halo envuelve la tarjeta entera, pero quien dispara la acción es el
  // cuerpo (donde vive el editor). En vez de subir ese estado con un callback,
  // se lee del contexto por la misma identidad de acción: la fuente de verdad
  // sigue siendo una sola.
  const agente = useAgenteOpcional()
  const ejecutando = Boolean(
    agente?.enCurso.has(idCampoAgente(entidad, entidadId, campo.clave)),
  )
  const halo = usePropsHalo(ejecutando)

  const body = (
    <CanvasBody
      campo={campo}
      entidad={entidad}
      entidadId={entidadId}
      borrador={borrador}
      highlights={highlights}
      expanded={expanded}
      destacado={destacado}
      placeholder={placeholder}
      zoom={zoom}
      onToggleExpand={() => setExpanded((prev) => !prev)}
      onAplicar={onAplicar}
    />
  )

  // Al ampliar, el overlay se monta en un portal a `document.body` para que
  // `position: fixed` se ancle al viewport y no a un ancestro con `transform`
  // u `overflow` (p. ej. las columnas del masonry o la animación GSAP), lo que
  // recortaba la tarjeta y dejaba ver el contenido detrás.
  if (expanded) {
    return createPortal(
      <div
        className={cn(
          'group/canvas bg-background animate-in fade-in fixed inset-0 z-60 flex flex-col duration-200',
          zoom.contenedor.className,
        )}
        style={zoom.contenedor.style}
      >
        {body}
      </div>,
      document.body,
    )
  }

  return (
    <div
      className={cn(
        'group/canvas flex flex-col rounded-2xl border transition-all hover:shadow-md',
        destacado
          ? 'superficie-fundamento h-full min-h-0'
          : 'bg-card border-border/80 dark:border-border/70 hover:border-border shadow-xs dark:shadow-none',
        zoom.contenedor.className,
        halo.className,
      )}
      style={{ ...zoom.contenedor.style, ...halo.style }}
    >
      {body}
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
  destacado,
  placeholder,
  zoom,
  onToggleExpand,
  onAplicar,
}: {
  campo: DatosGeneralesField
  entidad: DraftEntity
  entidadId: string
  borrador?: BorradorCampo | null
  highlights: Array<CommentHighlight>
  expanded: boolean
  destacado: boolean
  placeholder?: string
  zoom: ZoomTipografico
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
  const promptInputRef = useRef<HTMLTextAreaElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const readOnlyRef = useRef<HTMLDivElement>(null)

  // Solo lectura (p. ej. un evaluador que solo comenta): mostramos el contenido
  // renderizado con los comentarios pintados como marcatextos.
  const readOnlyHtml = useMemo(() => sanitizeHtml(campo.value), [campo.value])
  useCommentHighlights(readOnlyRef, highlights, readOnlyHtml, () =>
    openComments(),
  )

  // Alto real del hueco donde se pinta el esqueleto. Se mide en vez de deducirse
  // del texto: la longitud del contenido es un mal sustituto de la altura —un
  // campo corto en una tarjeta baja y otro corto en una tarjeta alta daban el
  // mismo número de renglones— y el resultado era un segundo renglón pegado al
  // borde inferior, sin aire, como si a la tarjeta le faltara padding.
  const [altoContenido, setAltoContenido] = useState(0)

  useEffect(() => {
    const nodo = contentRef.current
    if (!nodo) return

    const observer = new ResizeObserver(([entrada]) => {
      setAltoContenido(entrada.contentRect.height)
    })
    observer.observe(nodo)

    return () => observer.disconnect()
  }, [])

  // Cuántos renglones caben enteros, con su separación y el margen del propio
  // hueco. Nunca menos de uno: sin ningún renglón el usuario no vería que la IA
  // está trabajando, y prefiero un renglón justo a dos recortados. El tope son
  // los anchos disponibles, que ya imitan el desnivel de un párrafo real.
  const anchosEsqueleto = useMemo(() => {
    const util =
      altoContenido - ESQUELETO_MARGEN_VERTICAL + ESQUELETO_SEPARACION
    const caben = Math.floor(util / (ESQUELETO_RENGLON + ESQUELETO_SEPARACION))

    return ANCHOS_ESQUELETO.slice(
      0,
      Math.min(Math.max(caben, 1), ANCHOS_ESQUELETO.length),
    )
  }, [altoContenido])

  /* Qué se ofrece mientras el campo está vacío.
   *
   * Repetir la etiqueta —«Escribe aquí la justificación del área de estudios»
   * bajo un encabezado que ya dice «Justificación del área de estudios»— no
   * aporta nada: que hay que escribir ahí ya se ve. Lo que sí orienta es el
   * ejemplo que la propia estructura normativa adjunta al campo, así que ése
   * manda. La guía redactada (los tres fundamentos) tiene prioridad sobre él
   * porque plantea la pregunta que el campo responde, no una muestra.
   *
   * El prefijo «Ejemplo:» no es decorativo: es la señal de que lo que se lee
   * es una muestra y no el contenido ya escrito. */
  const ejemploDelEsquema =
    campo.holder?.trim() || ejemploDeEsquema(campo.schema)
  const textoPlaceholder =
    placeholder ||
    (ejemploDelEsquema ? `Ejemplo: ${ejemploDelEsquema}` : 'Escribe aquí…')

  const contenidoInicial =
    sanitizeHtml(
      borrador?.contenido_html ?? htmlFromPossiblyPlainText(campo.value),
    ) || '<p></p>'
  const contenidoInicialVacio = isEmptyRichText(contenidoInicial)

  const editor = useEditor({
    extensions: richTextExtensions,
    content: contenidoInicial,
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
  // La extensión Placeholder decora nodos vacíos dentro de ProseMirror. Ese
  // detalle permitía dos estados incorrectos: un primer párrafo vacío podía
  // recibir la guía aunque hubiera texto después y, en algunos builds, la
  // decoración no se reconstruía al borrar el último carácter hasta que el
  // componente se montaba de nuevo. `useEditorState` es la suscripción oficial
  // de Tiptap a las transacciones: la pista depende del documento completo y
  // se actualiza en la misma transacción de escribir, borrar, deshacer o pegar.
  const editorEstaVacio =
    useEditorState({
      editor,
      selector: ({ editor: editorActual }) =>
        editorActual?.isEmpty ?? contenidoInicialVacio,
    }) ?? contenidoInicialVacio

  const guardarHtml = async (html: string) => {
    const ok = await onAplicar(html)
    if (!ok) return false
    savedHtmlRef.current = html
    if (borrador) {
      void deleteDraft.mutateAsync({
        entidad,
        entidadId,
        clave: campo.clave,
      })
    }
    return true
  }

  // Guardado silencioso al salir del editor (como el resto de campos del plan).
  const persist = async () => {
    if (!editor || !canEdit) return
    const html = sanitizeHtml(editor.getHTML())
    if (html === savedHtmlRef.current) return
    await guardarHtml(html)
  }

  /**
   * Escritura que hace el agente. Persiste primero y refresca el editor
   * después: si la escritura falla, el usuario se queda con el texto que ya
   * tenía en pantalla en vez de con una reescritura que el servidor rechazó.
   */
  const aplicarHtmlAgente = async (html: string) => {
    const limpio = sanitizeHtml(html) || '<p></p>'
    const ok = await guardarHtml(limpio)
    if (!ok) throw new Error('No se pudo aplicar el cambio al campo.')
    // Deshacer puede llegar cuando la tarjeta ya no está montada (el usuario
    // cambió de pestaña); la escritura sigue valiendo, el editor ya no.
    if (editor && !editor.isDestroyed) editor.commands.setContent(limpio)
  }

  const agente = useAccionAgente<ResultadoMejorarCampo, string>({
    id: idCampoAgente(entidad, entidadId, campo.clave),
    accion: 'mejorar_campo',
    etiqueta: `Reescribir «${campo.label}»`,
    modo: 'boton',
    ariaLabel: `Reescribir ${campo.label} con IA`,
    disabled: !canEdit || !canUseIA,
    payload: () =>
      ({
        entidad,
        entidad_id: entidadId,
        clave: campo.clave,
        label: campo.label,
        ...(campo.helperText ? { ayuda: campo.helperText } : {}),
        contenido_actual: editor
          ? sanitizeHtml(editor.getHTML())
          : sanitizeHtml(campo.value),
        es_richtext: true,
        campo_schema: campo.schema ?? null,
      }) satisfies PayloadMejorarCampo,
    snapshot: () =>
      editor ? sanitizeHtml(editor.getHTML()) : savedHtmlRef.current,
    aplicar: (resultado) => aplicarHtmlAgente(resultado.contenido),
    restaurar: (previo) => aplicarHtmlAgente(previo),
  })

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

  // Toolbar flotante pegado a la selección. Las coordenadas de ProseMirror
  // ubican sus extremos; los rectángulos nativos describen cada renglón que la
  // selección ocupa y permiten detectar qué parte sigue visible al desplazarse.
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
      const contenedor = contentRef.current?.getBoundingClientRect()
      if (!contenedor) {
        setToolbar(null)
        return
      }

      const seleccionDom = editor.view.dom.ownerDocument.getSelection()
      const rango =
        seleccionDom?.rangeCount &&
        seleccionDom.anchorNode &&
        editor.view.dom.contains(seleccionDom.anchorNode)
          ? seleccionDom.getRangeAt(0)
          : null
      const rectangulos = rango
        ? Array.from(rango.getClientRects()).map((rectangulo) => ({
            top: rectangulo.top,
            right: rectangulo.right,
            bottom: rectangulo.bottom,
            left: rectangulo.left,
          }))
        : []

      setToolbar(
        calcularPosicionToolbarSeleccion({
          inicio: start,
          fin: end,
          rectangulos,
          contenedor,
          altoViewport: window.innerHeight,
          altoToolbar: TOOLBAR_HEIGHT,
          separacion: TOOLBAR_GAP,
          margenViewport: TOOLBAR_VIEWPORT_MARGIN,
        }),
      )
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
        // Edición puntual de campo: sin referencias y sin razonamiento para una
        // respuesta inmediata (el modelo GPT-5.6 admite reasoning "none").
        reasoning_effort: 'none',
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
  const canRedo = Boolean(editor?.can().redo())

  return (
    <>
      <div
        className={cn(
          'flex items-center justify-between gap-4 border-b px-6 py-3',
          destacado ? 'border-primary/15' : 'bg-muted/30',
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <h3
                className={cn(
                  'text-foreground min-w-0 cursor-help truncate font-semibold tracking-tight',
                  destacado ? 'text-2xl' : 'text-xl',
                  expanded && 'titulo-zoom-tipografico',
                )}
              >
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
          {/* La lupa sólo aparece al ampliar: es ahí donde el campo se lee o se
              presenta y donde antes se recurría al zoom del navegador. Vive
              fuera del grupo plegable porque no es una acción de edición. */}
          {expanded && <ControlesZoomTipografico zoom={zoom} />}

          {/* En modo agente el disparador de IA sustituye al lápiz y vive fuera
              del grupo que se pliega: es la acción principal de la tarjeta y
              tiene que verse sin necesidad de enfocarla antes. */}
          {agente.enModoAgente && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'text-primary hover:text-primary hover:bg-primary/10 h-8 w-8 rounded-full',
                    agente.halo.className,
                  )}
                  style={agente.halo.style}
                  {...agente.props}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reescribir con el agente de IA</TooltipContent>
            </Tooltip>
          )}

          <div
            className={cn(
              'flex items-center gap-0.5',
              canEdit &&
                !expanded &&
                'invisible max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity] duration-200 group-focus-within/canvas:visible group-focus-within/canvas:max-w-64 group-focus-within/canvas:opacity-100',
            )}
          >
            {/* Deshacer y rehacer los asume el dock del agente mientras el modo
                está activo: dos pilas compitiendo confundirían al usuario. */}
            {canEdit && canUndo && !agente.enModoAgente && (
              <HeaderIcon
                label="Deshacer"
                onClick={() => editor?.commands.undo()}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </HeaderIcon>
            )}
            {canEdit && canRedo && !agente.enModoAgente && (
              <HeaderIcon
                label="Rehacer"
                onClick={() => editor?.commands.redo()}
              >
                <Redo2 className="h-3.5 w-3.5" />
              </HeaderIcon>
            )}
            {/* Copiar y ampliar tampoco: en modo agente la cabecera de la
                tarjeta tiene un solo mando —el disparador de IA— y añadir
                utilidades de edición manual al lado lo diluye. */}
            {!agente.enModoAgente && (
              <>
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
              </>
            )}
            {canUseIA && !expanded && !agente.enModoAgente && (
              <HeaderIcon
                label="Solicitar cambios a la IA"
                active={promptOpen}
                onClick={() =>
                  promptOpen ? setPromptOpen(false) : openPrompt()
                }
              >
                <Pencil className="h-3.5 w-3.5" />
              </HeaderIcon>
            )}
          </div>
        </div>
      </div>

      <div
        ref={contentRef}
        className={cn(
          'relative min-h-0 flex-1',
          expanded ? 'overflow-y-auto' : '',
          canEdit && 'cursor-text',
        )}
      >
        {/* El esqueleto se superpone en vez de sustituir al editor: desmontarlo
            destruiría la vista de ProseMirror y con ella la selección y el foco
            del usuario. */}
        {agente.ejecutando && (
          <div
            aria-hidden
            className={cn(
              'animate-in fade-in absolute inset-0 z-10 space-y-2 overflow-hidden px-6 py-4 backdrop-blur-[1px]',
              expanded ? 'bg-background/85' : 'bg-card/85',
            )}
          >
            {anchosEsqueleto.map((ancho) => (
              <EsqueletoAgente key={ancho} className={cn('h-4', ancho)} />
            ))}
          </div>
        )}
        <div
          className={cn(
            'canvas-editor relative',
            expanded
              ? 'canvas-editor--fill mx-auto flex min-h-full w-full max-w-3xl flex-col px-6 py-8'
              : 'max-h-[46vh] overflow-y-auto px-6 py-3',
            // Los fundamentos son paneles editoriales comparables: el cuerpo
            // llena la altura común de las tres tarjetas y desplaza sólo su
            // propio contenido cuando uno necesita más espacio.
            destacado &&
              !expanded &&
              'canvas-editor--fill flex h-full min-h-40 flex-col',
            canEdit && 'cursor-text',
            improve.isPending && 'pointer-events-none animate-pulse opacity-60',
            agente.ejecutando && 'pointer-events-none',
          )}
        >
          {canEdit ? (
            <>
              {editorEstaVacio && (
                <p
                  aria-hidden
                  className={cn(
                    'canvas-editor__placeholder absolute right-6 left-6',
                    expanded ? 'top-8' : 'top-3',
                  )}
                >
                  {textoPlaceholder}
                </p>
              )}
              <EditorContent
                editor={editor}
                className={cn(
                  (expanded || destacado) && 'flex min-h-0 flex-1 flex-col',
                )}
              />
            </>
          ) : (
            <div
              ref={readOnlyRef}
              data-comment-scope={commentScope}
              data-comment-key={campo.clave}
              className={cn(expanded && 'flex-1')}
            >
              <RichTextContent html={readOnlyHtml} />
            </div>
          )}
        </div>
      </div>

      {agente.rechazo && (
        <p className="text-muted-foreground animate-in fade-in border-border/60 border-t px-6 py-2.5 text-xs leading-relaxed">
          {agente.rechazo}
        </p>
      )}

      {toolbar && editor && canEdit && (
        <SelectionToolbar
          editor={editor}
          top={toolbar.top}
          left={toolbar.left}
          // En modo agente el compositor de prompts no existe: la instrucción
          // son las palabras de contexto del dock.
          canUseIA={canUseIA && !agente.enModoAgente}
          onRequestChanges={captureExcerpt}
          onComment={commentSelection}
        />
      )}

      {canEdit &&
        canUseIA &&
        !agente.enModoAgente &&
        (promptOpen || expanded) && (
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
            <div className={cn('mx-auto', expanded && 'max-w-3xl')}>
              <AIRequestComposer
                value={prompt}
                onChange={setPrompt}
                webSearchEnabled={false}
                onWebSearchEnabledChange={() => undefined}
                showWebSearch={false}
                showAttachments={false}
                showReasoning={false}
                showVoice
                placeholder="Describe los cambios…"
                disabled={improve.isPending}
                compact
                textareaRef={promptInputRef}
                onSubmit={() => void sendPrompt()}
                submitting={improve.isPending}
              />
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
    TOOLBAR_VIEWPORT_MARGIN,
    Math.min(
      left - TOOLBAR_WIDTH / 2,
      window.innerWidth - TOOLBAR_WIDTH - TOOLBAR_VIEWPORT_MARGIN,
    ),
  )
  const clampedTop = Math.max(
    TOOLBAR_VIEWPORT_MARGIN,
    Math.min(
      top,
      window.innerHeight - TOOLBAR_HEIGHT - TOOLBAR_VIEWPORT_MARGIN,
    ),
  )

  return (
    <div
      role="toolbar"
      aria-label="Acciones de selección"
      className="bg-popover text-popover-foreground animate-in fade-in zoom-in-95 fixed z-70 flex items-center gap-0.5 rounded-lg border p-1 shadow-lg duration-150"
      style={{ top: clampedTop, left: clampedLeft }}
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
