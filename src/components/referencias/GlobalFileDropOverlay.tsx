import { FileUp, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { RefObject } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  onFiles: (files: Array<File>) => void | Promise<void>
  busy?: boolean
  acceptPaste?: boolean
  className?: string
  scopeRef?: RefObject<HTMLElement | null>
}

type SuperficieCargaGlobal = {
  id: symbol
  contieneObjetivo: (target: EventTarget | null) => boolean
  aceptaPegado: () => boolean
  onFiles: (files: Array<File>) => void | Promise<void>
  setVisible: (visible: boolean) => void
}

/**
 * Coordina todas las superficies de IA montadas para que un gesto global se
 * entregue una sola vez. La superficie recién montada o con foco es la dueña.
 */
export function crearCoordinadorCargaGlobal() {
  const superficies = new Map<symbol, SuperficieCargaGlobal>()
  const ordenActividad: Array<symbol> = []
  let activa: symbol | null = null

  const recordarActividad = (id: symbol) => {
    const index = ordenActividad.indexOf(id)
    if (index >= 0) ordenActividad.splice(index, 1)
    ordenActividad.push(id)
  }

  const activar = (id: symbol) => {
    if (!superficies.has(id)) return
    if (activa && activa !== id) superficies.get(activa)?.setVisible(false)
    activa = id
    recordarActividad(id)
  }

  const registrar = (superficie: SuperficieCargaGlobal) => {
    superficies.set(superficie.id, superficie)
    activar(superficie.id)
    return () => {
      superficie.setVisible(false)
      superficies.delete(superficie.id)
      const index = ordenActividad.indexOf(superficie.id)
      if (index >= 0) ordenActividad.splice(index, 1)
      if (activa !== superficie.id) return
      activa = ordenActividad.at(-1) ?? null
    }
  }

  const resolverParaObjetivo = (target: EventTarget | null) => {
    const coincidente = [...ordenActividad]
      .reverse()
      .find((id) => superficies.get(id)?.contieneObjetivo(target))
    if (coincidente) activar(coincidente)
    return activa ? superficies.get(activa) : undefined
  }

  const entregar = (files: Array<File>) => {
    const superficie = activa ? superficies.get(activa) : undefined
    if (!superficie || files.length === 0) return false
    void superficie.onFiles(files)
    return true
  }

  const mostrarActiva = (visible: boolean) => {
    if (!activa) return
    superficies.get(activa)?.setVisible(visible)
  }

  const reiniciar = () => {
    for (const superficie of superficies.values()) {
      superficie.setVisible(false)
    }
  }

  return {
    activar,
    registrar,
    resolverParaObjetivo,
    entregar,
    mostrarActiva,
    reiniciar,
    aceptaPegadoActivo: () =>
      activa ? (superficies.get(activa)?.aceptaPegado() ?? false) : false,
    cantidad: () => superficies.size,
  }
}

const coordinadorGlobal = crearCoordinadorCargaGlobal()
let cleanupGlobalListeners: (() => void) | null = null
let dragDepth = 0

function hasFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

const MAX_REFERENCE_FILES = 5

function fileIdentity(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}:${file.type}`
}

export function normalizarArchivosReferencia(
  files: Array<File>,
  limit = MAX_REFERENCE_FILES,
) {
  const seen = new Set<string>()
  return files
    .filter((file) => {
      const identity = fileIdentity(file)
      if (seen.has(identity)) return false
      seen.add(identity)
      return true
    })
    .slice(0, limit)
}

export function obtenerArchivosDelPortapapeles(
  clipboardData: Pick<DataTransfer, 'files' | 'items'> | null,
): Array<File> {
  const direct = Array.from(clipboardData?.files ?? [])
  const files = direct.length
    ? direct
    : Array.from(clipboardData?.items ?? []).flatMap((item) => {
        if (item.kind !== 'file') return []
        const file = item.getAsFile()
        return file ? [file] : []
      })

  return normalizarArchivosReferencia(files).map((file, index) => {
    if (file.name && file.name !== 'image.png') return file
    const extension =
      (
        {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp',
        } as Record<string, string>
      )[file.type] ?? 'bin'
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `imagen-pegada-${stamp}-${index + 1}.${extension}`
    const renamed = new File([file.slice(0, file.size, file.type)], filename, {
      type: file.type,
      lastModified: file.lastModified || Date.now(),
    })
    // Bun conserva en ocasiones el nombre del File usado como BlobPart. El
    // fallback sólo corrige esos entornos; los navegadores mantienen el nombre
    // entregado al constructor.
    if (renamed.name !== filename) {
      try {
        Object.defineProperty(renamed, 'name', {
          value: filename,
          enumerable: true,
        })
      } catch {
        return renamed
      }
    }
    return renamed
  })
}

export function obtenerArchivosParaPegadoGlobal(
  acceptPaste: boolean,
  defaultPrevented: boolean,
  clipboardData: Pick<DataTransfer, 'files' | 'items'> | null,
) {
  return acceptPaste && !defaultPrevented
    ? obtenerArchivosDelPortapapeles(clipboardData)
    : []
}

function instalarListenersGlobales() {
  if (cleanupGlobalListeners || typeof window === 'undefined') return

  const enter = (event: DragEvent) => {
    if (!hasFiles(event)) return
    const superficie = coordinadorGlobal.resolverParaObjetivo(event.target)
    if (!superficie) return
    event.preventDefault()
    dragDepth += 1
    coordinadorGlobal.mostrarActiva(true)
  }
  const over = (event: DragEvent) => {
    if (!hasFiles(event)) return
    const superficie = coordinadorGlobal.resolverParaObjetivo(event.target)
    if (!superficie) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  }
  const leave = (event: DragEvent) => {
    if (!hasFiles(event)) return
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) coordinadorGlobal.mostrarActiva(false)
  }
  const drop = (event: DragEvent) => {
    if (!hasFiles(event)) return
    const superficie = coordinadorGlobal.resolverParaObjetivo(event.target)
    if (!superficie) return
    event.preventDefault()
    dragDepth = 0
    coordinadorGlobal.mostrarActiva(false)
    const files = normalizarArchivosReferencia(
      Array.from(event.dataTransfer?.files ?? []),
    )
    coordinadorGlobal.entregar(files)
  }
  const reset = () => {
    dragDepth = 0
    coordinadorGlobal.reiniciar()
  }
  const paste = (event: ClipboardEvent) => {
    const superficie = coordinadorGlobal.resolverParaObjetivo(event.target)
    if (!superficie) return
    const files = obtenerArchivosParaPegadoGlobal(
      coordinadorGlobal.aceptaPegadoActivo(),
      event.defaultPrevented,
      event.clipboardData,
    )
    // El pegado de texto conserva el comportamiento nativo. Sólo tomamos el
    // evento cuando el portapapeles realmente contiene archivos.
    if (!files.length) return
    event.preventDefault()
    coordinadorGlobal.entregar(files)
  }

  window.addEventListener('dragenter', enter)
  window.addEventListener('dragover', over)
  window.addEventListener('dragleave', leave)
  window.addEventListener('drop', drop)
  window.addEventListener('blur', reset)
  window.addEventListener('paste', paste)
  cleanupGlobalListeners = () => {
    window.removeEventListener('dragenter', enter)
    window.removeEventListener('dragover', over)
    window.removeEventListener('dragleave', leave)
    window.removeEventListener('drop', drop)
    window.removeEventListener('blur', reset)
    window.removeEventListener('paste', paste)
    cleanupGlobalListeners = null
    reset()
  }
}

export function GlobalFileDropOverlay({
  onFiles,
  busy,
  acceptPaste = false,
  className,
  scopeRef,
}: Props) {
  const [visible, setVisible] = useState(false)
  const idRef = useRef(Symbol('superficie-carga-ia'))
  const onFilesRef = useRef(onFiles)
  const acceptPasteRef = useRef(acceptPaste)
  onFilesRef.current = onFiles
  acceptPasteRef.current = acceptPaste

  useEffect(() => {
    const id = idRef.current
    const activar = () => coordinadorGlobal.activar(id)
    const unregister = coordinadorGlobal.registrar({
      id,
      aceptaPegado: () => acceptPasteRef.current,
      contieneObjetivo: (target) =>
        typeof Node !== 'undefined' &&
        target instanceof Node &&
        Boolean(scopeRef?.current?.contains(target)),
      onFiles: (files) => onFilesRef.current(files),
      setVisible,
    })
    const scope = scopeRef?.current
    scope?.addEventListener('pointerdown', activar, true)
    scope?.addEventListener('focusin', activar, true)
    instalarListenersGlobales()

    return () => {
      scope?.removeEventListener('pointerdown', activar, true)
      scope?.removeEventListener('focusin', activar, true)
      unregister()
      if (coordinadorGlobal.cantidad() === 0) cleanupGlobalListeners?.()
    }
  }, [scopeRef])

  // La carga continúa de fondo y se refleja en los chips o filas optimistas.
  // El overlay sólo existe durante el gesto de arrastre para no bloquear la UI.
  if (!visible) return null
  return (
    <div
      className={cn(
        'bg-background/90 p-seccion fixed inset-0 z-[100] grid place-items-center backdrop-blur-sm',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="border-primary/40 bg-card text-card-foreground px-pagina py-pagina flex max-w-md flex-col items-center rounded-3xl border text-center shadow-2xl">
        <span className="bg-primary/10 text-primary mb-seccion grid size-16 place-items-center rounded-2xl">
          {busy ? (
            <Loader2 className="size-7 animate-spin" />
          ) : (
            <FileUp className="size-7" />
          )}
        </span>
        <p className="text-xl font-semibold">
          {busy ? 'Añadiendo referencias…' : 'Añade tus referencias'}
        </p>
        <p className="text-muted-foreground mt-relacionado text-sm">
          {busy
            ? 'La conversación seguirá disponible mientras termina la carga.'
            : 'Suelta aquí hasta cinco archivos para incorporarlos a esta interacción con IA.'}
        </p>
      </div>
    </div>
  )
}
