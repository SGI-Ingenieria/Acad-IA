import { Link } from '@tanstack/react-router'
import {
  CheckCheck,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileWarning,
  Layers,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { FieldMeta } from '@/data/api/document.api'

import { RichTextContent } from '@/components/editor/RichTextContent'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  fetchAsignaturaPdf,
  fetchPlanPdf,
  fetchPreviewPayload,
} from '@/data/api/document.api'
import { usePlan } from '@/data/hooks/usePlans'
import { getEdgeFunctionErrorCode } from '@/data/supabase/invokeEdge'
import { cn } from '@/lib/utils'

interface DocumentoOficialViewProps {
  modo: 'plan' | 'asignatura'
  entityId: string
  entityName: string
}

function sanitizeFileBaseName(input: string): string {
  const withoutCtrl = Array.from(String(input))
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
  const cleaned = withoutCtrl
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
  return (cleaned || 'documento').slice(0, 150)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  )
}

function isScalar(value: unknown): boolean {
  return value === null || typeof value !== 'object'
}

/** Convierte `horasEstimadas` → `Horas estimadas`, `contenido_tematico` → `Contenido tematico`. */
function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function formatScalar(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  return String(value)
}

/** Sufijo de unidad inferido del nombre de la clave (`2` → `2 h`, `30` → `30 %`). */
function unitFor(key: string): string | null {
  const k = key.toLowerCase()
  if (k.includes('hora')) return ' h'
  if (k.includes('porcentaje') || k.includes('percent') || k.includes('%'))
    return ' %'
  return null
}

// Clave cuyo valor es el "título" del elemento (se muestra como texto principal).
const PRIMARY_KEY_RE =
  /^(nombre|titulo|título|title|label|texto|criterio|concepto|descripci[oó]n|tema|autor|referencia|cita|item)$/i
// Clave que representa un número de orden (se muestra como "Unidad 1", etc.).
const ORDER_KEY_RE = /^(unidad|n[uú]mero|numero|orden|posici[oó]n)$/i

/**
 * Renderiza un objeto de forma legible (sin volcar las claves crudas del JSON):
 * número de orden + texto principal en una línea, los demás escalares como
 * badges compactos, y los valores complejos (arreglos/objetos anidados) como
 * sub-listas con una etiqueta humanizada.
 */
function ObjectValue({ obj }: { obj: Record<string, unknown> }) {
  const entries = Object.entries(obj).filter(
    ([, v]) => !isEmptyValue(v) && !(Array.isArray(v) && v.length === 0),
  )
  if (entries.length === 0) {
    return <span className="text-muted-foreground/40 text-xs italic">—</span>
  }

  const scalars = entries.filter(([, v]) => isScalar(v))
  const complex = entries.filter(([, v]) => !isScalar(v))

  const orderEntry = scalars.find(([k]) => ORDER_KEY_RE.test(k))
  const primaryEntry =
    scalars.find(([k]) => PRIMARY_KEY_RE.test(k)) ??
    scalars.find(([k, v]) => typeof v === 'string' && k !== orderEntry?.[0])
  const badges = scalars.filter(
    ([k]) => k !== orderEntry?.[0] && k !== primaryEntry?.[0],
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {orderEntry && (
          <span className="text-muted-foreground shrink-0 text-xs font-medium tabular-nums">
            {humanizeKey(orderEntry[0])} {formatScalar(orderEntry[1])}
          </span>
        )}
        {primaryEntry && (
          <span className="text-xs font-medium wrap-break-word whitespace-pre-wrap">
            {formatScalar(primaryEntry[1])}
          </span>
        )}
        {badges.map(([k, v]) => {
          const unit = unitFor(k)
          return (
            <Badge
              key={k}
              variant="secondary"
              className="text-[10px] font-normal"
            >
              {unit
                ? `${formatScalar(v)}${unit}`
                : `${humanizeKey(k)}: ${formatScalar(v)}`}
            </Badge>
          )
        })}
      </div>

      {complex.map(([k, v]) => (
        <div key={k} className="ml-1 pt-1 pl-2">
          <span className="text-muted-foreground/70 text-[10px] font-medium tracking-wide uppercase">
            {humanizeKey(k)}
          </span>
          <FieldValue value={v} />
        </div>
      ))}
    </div>
  )
}

/**
 * Renderiza cualquier valor del payload de forma legible. Se usa recursivamente
 * para que los elementos de un campo —p. ej. cada unidad de contenido temático
 * o cada entrada de bibliografía— se previsualicen completos, no como
 * `[N elementos]`.
 */
function FieldValue({
  value,
  isRichtext = false,
}: {
  value: unknown
  isRichtext?: boolean
}) {
  if (isEmptyValue(value)) {
    return <span className="text-muted-foreground/40 text-xs italic">—</span>
  }

  if (isRichtext && typeof value === 'string') {
    return <RichTextContent html={value} className="text-xs" />
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground/40 text-xs italic">—</span>
    }
    return (
      <div className="flex flex-col gap-1.5">
        {value.map((item, i) => (
          <div key={i} className="flex gap-1.5">
            <span className="text-muted-foreground/40 shrink-0 text-xs tabular-nums">
              {isScalar(item) ? `${i + 1}.` : '•'}
            </span>
            <div className="min-w-0 flex-1">
              <FieldValue value={item} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (typeof value === 'object') {
    return <ObjectValue obj={value as Record<string, unknown>} />
  }

  if (typeof value === 'boolean') {
    return (
      <Badge variant={value ? 'default' : 'secondary'} className="text-[10px]">
        {value ? 'Sí' : 'No'}
      </Badge>
    )
  }

  return (
    <span className="text-xs wrap-break-word whitespace-pre-wrap">
      {String(value)}
    </span>
  )
}

/** Celda del nombre del campo, con tooltip que muestra su `key`. */
function FieldNameCell({
  field,
  rowSpan,
  count,
}: {
  field: FieldMeta
  rowSpan?: number
  count?: number
}) {
  return (
    <td rowSpan={rowSpan} className="w-[45%] px-3 py-2 align-top">
      <TooltipProvider>
        <Tooltip delayDuration={400}>
          <TooltipTrigger asChild>
            <span className="cursor-default text-sm">{field.title}</span>
          </TooltipTrigger>
          <TooltipContent side="right">
            <code className="font-mono text-xs">{field.key}</code>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {count !== undefined && (
        <span className="text-muted-foreground ml-1.5 text-xs tabular-nums">
          ({count})
        </span>
      )}
    </td>
  )
}

/**
 * Devuelve las filas (`<tr>`) de un campo. Si el valor es un arreglo no vacío,
 * la celda del nombre se combina (rowSpan) al estilo Excel y cada elemento
 * ocupa su propia fila.
 */
function FieldRows({ field, value }: { field: FieldMeta; value: unknown }) {
  if (Array.isArray(value) && value.length > 0) {
    return (
      <>
        {value.map((item, i) => (
          <tr key={`${field.key}-${i}`} className="hover:bg-muted/20">
            {i === 0 && (
              <FieldNameCell
                field={field}
                rowSpan={value.length}
                count={value.length}
              />
            )}
            <td className="px-3 py-2">
              <FieldValue value={item} />
            </td>
          </tr>
        ))}
      </>
    )
  }

  return (
    <tr className="hover:bg-muted/20">
      <FieldNameCell field={field} />
      <td className="px-3 py-2 align-top">
        <FieldValue value={value} isRichtext={field.isRichtext} />
      </td>
    </tr>
  )
}

function FieldTable({
  fields,
  data,
}: {
  fields: Array<FieldMeta>
  data: Record<string, unknown>
}) {
  const always = fields.filter((f) => f.isAlways)
  const estructura = fields.filter((f) => !f.isAlways)

  return (
    <table className="w-full border-separate border-spacing-y-0.5 text-left">
      <thead>
        <tr>
          <th className="text-muted-foreground w-[45%] px-3 py-2 text-xs font-medium">
            Campo
          </th>
          <th className="text-muted-foreground px-3 py-2 text-xs font-medium">
            Valor
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td
            colSpan={2}
            className="text-muted-foreground px-3 pt-4 pb-1 text-[11px] font-semibold tracking-wider uppercase"
          >
            Siempre incluidos
          </td>
        </tr>
        {always.map((field) => (
          <FieldRows key={field.key} field={field} value={data[field.key]} />
        ))}

        {estructura.length > 0 && (
          <>
            <tr>
              <td
                colSpan={2}
                className="text-muted-foreground px-3 pt-5 pb-1 text-[11px] font-semibold tracking-wider uppercase"
              >
                De la estructura
              </td>
            </tr>
            {estructura.map((field) => (
              <FieldRows
                key={field.key}
                field={field}
                value={data[field.key]}
              />
            ))}
          </>
        )}
      </tbody>
    </table>
  )
}

export function DocumentoOficialView({
  modo,
  entityId,
  entityName,
}: DocumentoOficialViewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const pdfUrlRef = useRef<string | null>(null)
  const isMountedRef = useRef(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(true)
  const [previewError, setPreviewError] = useState<
    'missing-template' | 'generic' | null
  >(null)
  const [isDownloadingWord, setIsDownloadingWord] = useState(false)
  const [camposOpen, setCamposOpen] = useState(false)
  const [camposPayload, setCamposPayload] = useState<{
    data: unknown
    fields: Array<FieldMeta>
  } | null>(null)
  const [camposLoading, setCamposLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // En modo plan resolvemos la estructura del plan para poder enlazar
  // directamente a su configuración de plantilla cuando aún no tiene una.
  const { data: plan } = usePlan(modo === 'plan' ? entityId : undefined)
  const estructuraId = plan?.estructura_id ?? null

  const fileBaseName = sanitizeFileBaseName(entityName)

  const fetchDocument = useCallback(
    (convertTo?: 'pdf') => {
      if (modo === 'plan') {
        return fetchPlanPdf({ plan_estudio_id: entityId, convertTo })
      }
      return fetchAsignaturaPdf({ asignatura_id: entityId, convertTo })
    },
    [modo, entityId],
  )

  const loadPdfPreview = useCallback(async () => {
    try {
      if (isMountedRef.current) {
        setIsLoadingPreview(true)
        setPreviewError(null)
      }
      const blob = await fetchDocument('pdf')
      if (!isMountedRef.current) return
      const url = window.URL.createObjectURL(blob)
      if (pdfUrlRef.current) window.URL.revokeObjectURL(pdfUrlRef.current)
      pdfUrlRef.current = url
      setPdfUrl(url)
    } catch (err) {
      console.error('Error cargando preview:', err)
      if (isMountedRef.current) {
        setPdfUrl(null)
        // La estructura del plan (o la asignatura) aún no tiene plantilla
        // asignada: es un estado esperado, no un fallo de red o del servidor.
        const isMissingTemplate =
          getEdgeFunctionErrorCode(err) === 'MISSING_TEMPLATE_ID'
        setPreviewError(isMissingTemplate ? 'missing-template' : 'generic')
      }
    } finally {
      if (isMountedRef.current) setIsLoadingPreview(false)
    }
  }, [fetchDocument])

  useEffect(() => {
    isMountedRef.current = true
    void loadPdfPreview()
    return () => {
      isMountedRef.current = false
      if (pdfUrlRef.current) window.URL.revokeObjectURL(pdfUrlRef.current)
    }
  }, [loadPdfPreview])

  const handleDownloadWord = async () => {
    try {
      setIsDownloadingWord(true)
      const blob = await fetchDocument()
      triggerDownload(blob, `${fileBaseName}.docx`)
    } catch {
      toast.error('No se pudo generar el Word')
    } finally {
      setIsDownloadingWord(false)
    }
  }

  const handleOpenCampos = async () => {
    setCamposOpen(true)
    if (camposPayload !== null) return
    try {
      setCamposLoading(true)
      const result = await fetchPreviewPayload(
        modo === 'plan'
          ? { plan_estudio_id: entityId }
          : { asignatura_id: entityId },
      )
      setCamposPayload(result)
    } catch {
      toast.error('No se pudo obtener los campos del documento')
    } finally {
      setCamposLoading(false)
    }
  }

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(camposPayload?.data, null, 2),
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  // La previsualización completa solo tiene sentido cuando ya existe un PDF.
  // Mientras carga o falla, el estado se ajusta a su propio contenido para no
  // dejar una superficie vacía que obligue a desplazarse por la página.
  const hasPdfPreview = Boolean(pdfUrl && !isLoadingPreview)

  return (
    <div className="flex flex-col gap-3">
      <section aria-labelledby="document-preview-heading">
        <header className="flex flex-wrap items-center justify-end gap-3 px-1 pb-3">
          {pdfUrl && !isLoadingPreview && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={handleDownloadWord}
                disabled={isDownloadingWord}
              >
                {isDownloadingWord ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Descargar Word
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={handleOpenCampos}
              >
                <Code2 className="h-3.5 w-3.5" />
                Campos del documento
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => window.open(pdfUrl, '_blank')}
                  >
                    <ExternalLink size={13} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abrir en nueva pestaña</TooltipContent>
              </Tooltip>
            </div>
          )}
        </header>

        <div
          className={cn(
            'bg-muted/40 flex justify-center overflow-hidden',
            hasPdfPreview && 'min-h-200',
          )}
        >
          {isLoadingPreview ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-4 px-6 py-10">
              <Loader2 size={40} className="animate-spin opacity-60" />
              <p className="animate-pulse text-sm">Generando vista previa...</p>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0`}
              className="h-250 w-full max-w-250 border-none dark:hue-rotate-180 dark:invert"
              title="Vista previa del documento"
            />
          ) : previewError === 'missing-template' ? (
            <div className="flex max-w-md flex-col items-center justify-center gap-4 px-6 py-10 text-center">
              <div className="text-muted-foreground bg-muted flex h-14 w-14 items-center justify-center rounded-full">
                <FileWarning className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-sm">
                  Aún no hay una plantilla cargada
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {modo === 'plan' && estructuraId && (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/administracion/estructuras/$modo/{-$id}/plantillas"
                      params={{ modo: 'planes', id: estructuraId }}
                      search={{
                        tipo:
                          plan?.estructuras_plan?.tipo === 'NO_CURRICULAR'
                            ? 'NO_CURRICULAR'
                            : 'CURRICULAR',
                        q: '',
                        orden: 'nombre_asc',
                      }}
                    >
                      <Layers className="mr-2 h-4 w-4" />
                      Configurar plantilla
                    </Link>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void loadPdfPreview()}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reintentar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex max-w-md flex-col items-center justify-center gap-4 px-6 py-10 text-center">
              <div className="text-muted-foreground bg-muted flex h-14 w-14 items-center justify-center rounded-full">
                <FileWarning className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <p className="text-foreground text-sm font-semibold">
                  No se pudo cargar la vista previa
                </p>
                <p className="text-muted-foreground text-sm">
                  Ocurrió un error al generar el documento. Verifica tu conexión
                  e inténtalo de nuevo.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void loadPdfPreview()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reintentar
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Diálogo de campos del documento */}
      <Dialog open={camposOpen} onOpenChange={setCamposOpen}>
        <DialogContent className="flex max-h-[90vh] w-full flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5" /> Campos del documento
            </DialogTitle>
            <DialogDescription>
              Campos que se envían a Carbone para generar el documento.
              Información de depuración.
            </DialogDescription>
          </DialogHeader>

          <div className="relative flex min-h-0 flex-1 flex-col">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-1 right-1 z-10 h-7 gap-1 text-xs"
              onClick={handleCopyJson}
              disabled={!camposPayload}
            >
              {copied ? (
                <CheckCheck className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copiado' : 'Copiar JSON'}
            </Button>

            <div className="max-h-[60vh] overflow-auto">
              {camposLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : camposPayload !== null ? (
                <FieldTable
                  fields={camposPayload.fields}
                  data={camposPayload.data as Record<string, unknown>}
                />
              ) : (
                <p className="text-muted-foreground p-4 text-sm">
                  No se pudo obtener los campos.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
