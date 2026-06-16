import {
  CheckCheck,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

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
  fetchAsignaturaPdf,
  fetchPlanPdf,
  fetchPreviewPayload,
} from '@/data/api/document.api'

interface DocumentoOficialViewProps {
  modo: 'plan' | 'asignatura'
  entityId: string
  entityName: string
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function tok(cls: string, content: string) {
  return `<span class="${cls}">${esc(content)}</span>`
}

function highlightJsonHtml(json: string): string {
  let html = ''
  let i = 0

  while (i < json.length) {
    const ch = json[i]

    if (ch === '"') {
      const start = i++
      while (i < json.length) {
        if (json[i] === '\\') {
          i += 2
          continue
        }
        if (json[i] === '"') {
          i++
          break
        }
        i++
      }
      const raw = json.slice(start, i)
      let j = i
      while (j < json.length && (json[j] === ' ' || json[j] === '\t')) j++
      html +=
        json[j] === ':'
          ? tok('text-sky-400', raw)
          : tok('text-emerald-400', raw)
      continue
    }

    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      const start = i
      if (json[i] === '-') i++
      while (i < json.length && json[i] >= '0' && json[i] <= '9') i++
      if (json[i] === '.') {
        i++
        while (i < json.length && json[i] >= '0' && json[i] <= '9') i++
      }
      if (json[i] === 'e' || json[i] === 'E') {
        i++
        if (json[i] === '+' || json[i] === '-') i++
        while (i < json.length && json[i] >= '0' && json[i] <= '9') i++
      }
      html += tok('text-amber-400', json.slice(start, i))
      continue
    }

    if (json.startsWith('true', i)) {
      html += tok('text-orange-400', 'true')
      i += 4
      continue
    }
    if (json.startsWith('false', i)) {
      html += tok('text-orange-400', 'false')
      i += 5
      continue
    }
    if (json.startsWith('null', i)) {
      html += tok('text-red-400', 'null')
      i += 4
      continue
    }

    if ('{}[],'.includes(ch) || ch === ':') {
      html += tok('text-muted-foreground', ch)
      i++
      continue
    }

    html += esc(ch)
    i++
  }

  return html
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
}: DocumentoOficialViewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const pdfUrlRef = useRef<string | null>(null)
  const isMountedRef = useRef(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(true)
  const [isDownloadingWord, setIsDownloadingWord] = useState(false)
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonPayload, setJsonPayload] = useState<unknown>(null)
  const [jsonLoading, setJsonLoading] = useState(false)
  const [copied, setCopied] = useState(false)

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
    <div className="flex flex-col gap-4">
      {/* Tarjeta de vista previa con toolbar integrado */}
      <Card className="border-border overflow-hidden shadow-sm">
        <div className="border-border bg-muted/20 flex items-center justify-between border-b px-4 py-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <FileText size={14} /> Vista previa del documento
          </div>

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
              onClick={handleOpenJson}
            >
              <Code2 className="h-3.5 w-3.5" />
              JSON técnico
            </Button>

            {pdfUrl && !isLoadingPreview && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => window.open(pdfUrl, '_blank')}
                title="Abrir en nueva pestaña"
              >
                <ExternalLink size={13} />
              </Button>
            )}
          </div>
        </div>

        <CardContent className="bg-muted flex min-h-200 justify-center p-0">
          {isLoadingPreview ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-4">
              <Loader2 size={40} className="animate-spin opacity-60" />
              <p className="animate-pulse text-sm">Generando vista previa...</p>
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
        <DialogContent className="flex max-h-[90vh] w-full flex-col overflow-hidden sm:max-w-4xl">
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
              className="absolute top-2 right-2 z-10 h-7 gap-1 text-xs"
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
                // biome-ignore lint/security/noDangerouslySetInnerHtml: payload comes from our own backend
                <pre
                  className="font-mono text-xs wrap-break-word whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: highlightJsonHtml(
                      JSON.stringify(jsonPayload, null, 2),
                    ),
                  }}
                />
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
