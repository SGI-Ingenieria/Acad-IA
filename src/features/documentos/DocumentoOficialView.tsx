import {
  Check,
  ChevronDown,
  Code2,
  Copy,
  CheckCheck,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Star,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  fetchAsignaturaPdf,
  fetchPlanPdf,
  fetchPlantillaDocx,
  fetchPreviewPayload,
} from '@/data/api/document.api'
import { usePlantillas } from '@/data'
import { cn } from '@/lib/utils'

interface DocumentoOficialViewProps {
  modo: 'plan' | 'asignatura'
  entityId: string
  entityName: string
  estructuraId: string | null
  templateId: string | null
  onTemplateChange: (templateId: string) => Promise<void>
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

export function DocumentoOficialView({
  modo,
  entityId,
  entityName,
  estructuraId,
  templateId,
  onTemplateChange,
}: DocumentoOficialViewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const pdfUrlRef = useRef<string | null>(null)
  const isMountedRef = useRef(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(true)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [isChangingTemplate, setIsChangingTemplate] = useState(false)
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonPayload, setJsonPayload] = useState<unknown>(null)
  const [jsonLoading, setJsonLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const fileBaseName = sanitizeFileBaseName(entityName)

  const { data: plantillas = [] } = usePlantillas(estructuraId ?? '', {
    enabled: !!estructuraId,
  })

  const activeTemplate = templateId
    ? plantillas.find((p) => p.id === templateId || p.versionId === templateId)
    : null

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
      if (isMountedRef.current) setIsLoadingPreview(true)
      const blob = await fetchDocument('pdf')
      if (!isMountedRef.current) return
      const url = window.URL.createObjectURL(blob)
      if (pdfUrlRef.current) window.URL.revokeObjectURL(pdfUrlRef.current)
      pdfUrlRef.current = url
      setPdfUrl(url)
    } catch (err) {
      console.error('Error cargando preview:', err)
      if (isMountedRef.current) setPdfUrl(null)
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

  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true)
      const blob = await fetchDocument('pdf')
      triggerDownload(blob, `${fileBaseName}.pdf`)
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  const handleDownloadWord = async () => {
    try {
      const blob = await fetchDocument()
      triggerDownload(blob, `${fileBaseName}.docx`)
    } catch {
      toast.error('No se pudo generar el Word')
    }
  }

  const handleDownloadTemplate = async () => {
    if (!templateId) return
    try {
      const blob = await fetchPlantillaDocx(templateId)
      triggerDownload(blob, `plantilla_${fileBaseName}.docx`)
    } catch {
      toast.error('No se pudo descargar la plantilla')
    }
  }

  const handleTemplateSelect = async (newId: string) => {
    if (newId === templateId) return
    try {
      setIsChangingTemplate(true)
      await onTemplateChange(newId)
      void loadPdfPreview()
    } catch {
      toast.error('No se pudo cambiar la plantilla')
    } finally {
      setIsChangingTemplate(false)
    }
  }

  const handleOpenJson = async () => {
    setJsonOpen(true)
    if (jsonPayload !== null) return
    try {
      setJsonLoading(true)
      const payload = await fetchPreviewPayload(
        modo === 'plan'
          ? { plan_estudio_id: entityId }
          : { asignatura_id: entityId },
      )
      setJsonPayload(payload)
    } catch {
      toast.error('No se pudo obtener el JSON técnico')
    } finally {
      setJsonLoading(false)
    }
  }

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(jsonPayload, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-foreground text-xl font-bold">
            Documento Oficial
          </h1>
          <p className="text-muted-foreground text-sm">
            Vista previa y descarga del documento
          </p>

          {/* Plantilla activa + selector */}
          {estructuraId && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {activeTemplate ? (
                <>
                  <Badge className="border-primary/20 bg-primary/10 text-primary gap-1 border px-1.5 py-0.5 text-xs font-medium">
                    <Star className="h-2.5 w-2.5 fill-current" /> Plantilla en
                    uso
                  </Badge>
                  <span className="text-foreground text-sm font-medium">
                    {activeTemplate.name ?? activeTemplate.id}
                  </span>
                  {activeTemplate.id && (
                    <span className="text-muted-foreground font-mono text-xs">
                      v{activeTemplate.versionId.slice(0, 8)}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground text-sm">
                  Sin plantilla activa
                </span>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs"
                    disabled={isChangingTemplate}
                  >
                    {isChangingTemplate && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    Cambiar
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {plantillas.length === 0 ? (
                    <DropdownMenuItem disabled>
                      No hay plantillas disponibles
                    </DropdownMenuItem>
                  ) : (
                    plantillas.map((p) => {
                      const id = p.id || p.versionId
                      const isActive =
                        id === templateId || p.versionId === templateId
                      return (
                        <DropdownMenuItem
                          key={id}
                          onClick={() => handleTemplateSelect(id)}
                          className={cn(isActive && 'font-medium')}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4 shrink-0',
                              !isActive && 'invisible',
                            )}
                          />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate">
                              {p.name ?? id}
                            </span>
                            {p.id && (
                              <span className="text-muted-foreground font-mono text-xs">
                                v{p.versionId.slice(0, 8)}
                              </span>
                            )}
                          </div>
                        </DropdownMenuItem>
                      )
                    })
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            className="gap-2"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
          >
            {isDownloadingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Descargar PDF
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownloadWord}>
                <Download className="mr-2 h-4 w-4" /> Descargar Word
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDownloadTemplate}
                disabled={!templateId}
              >
                <FileText className="mr-2 h-4 w-4" /> Descargar plantilla
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleOpenJson}>
                <Code2 className="mr-2 h-4 w-4" /> Ver JSON técnico
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Vista previa PDF */}
      <Card className="border-border overflow-hidden shadow-sm">
        <div className="border-border bg-muted/20 flex items-center justify-between border-b px-4 py-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <FileText size={14} /> Vista previa del documento
          </div>
          {pdfUrl && !isLoadingPreview && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => window.open(pdfUrl, '_blank')}
            >
              Abrir en nueva pestaña <ExternalLink size={12} />
            </Button>
          )}
        </div>
        <CardContent className="bg-muted flex min-h-200 justify-center p-0">
          {isLoadingPreview ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-4">
              <Loader2 size={40} className="animate-spin opacity-60" />
              <p className="animate-pulse text-sm">
                Generando vista previa...
              </p>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0`}
              className="h-250 w-full max-w-250 border-none shadow-2xl dark:hue-rotate-180 dark:invert"
              title="Vista previa del documento"
            />
          ) : (
            <div className="text-muted-foreground flex items-center justify-center p-20 text-sm">
              No se pudo cargar la vista previa.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo JSON técnico */}
      <Dialog open={jsonOpen} onOpenChange={setJsonOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5" /> JSON técnico
            </DialogTitle>
            <DialogDescription>
              Payload enviado a Carbone para generación del documento.
              Información de depuración, no destinada al usuario final.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 z-10 h-7 gap-1 text-xs"
              onClick={handleCopyJson}
              disabled={!jsonPayload}
            >
              {copied ? (
                <CheckCheck className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>

            <div className="bg-muted max-h-[60vh] overflow-auto rounded-lg p-4">
              {jsonLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : jsonPayload !== null ? (
                <pre className="wrap-break-word whitespace-pre-wrap font-mono text-xs">
                  {JSON.stringify(jsonPayload, null, 2)}
                </pre>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No se pudo obtener el payload.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
