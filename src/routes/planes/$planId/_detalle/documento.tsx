import { createFileRoute, useParams } from '@tanstack/react-router'
import {
  FileText,
  Download,
  RefreshCcw,
  ExternalLink,
  CheckCircle2,
  Clock,
  FileJson,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TabPanelSkeleton } from '@/components/ui/route-pending-skeleton'
import { usePlan } from '@/data'
import { fetchPlanPdf } from '@/data/api/document.api'

export const Route = createFileRoute('/planes/$planId/_detalle/documento')({
  component: RouteComponent,
  pendingComponent: TabPanelSkeleton,
})

function RouteComponent() {
  const { planId } = useParams({ from: '/planes/$planId/_detalle/documento' })
  const { data: plan } = usePlan(planId)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const pdfUrlRef = useRef<string | null>(null)
  const isMountedRef = useRef<boolean>(false)
  const [isLoading, setIsLoading] = useState(true)

  const planFileBaseName = sanitizeFileBaseName(plan?.nombre ?? 'plan_estudios')

  const loadPdfPreview = useCallback(async () => {
    try {
      if (isMountedRef.current) setIsLoading(true)
      const pdfBlob = await fetchPlanPdf({
        plan_estudio_id: planId,
        convertTo: 'pdf',
      })

      if (!isMountedRef.current) return
      const url = window.URL.createObjectURL(pdfBlob)

      if (pdfUrlRef.current) window.URL.revokeObjectURL(pdfUrlRef.current)
      pdfUrlRef.current = url
      setPdfUrl(url)
    } catch (error) {
      console.error('Error cargando preview:', error)
    } finally {
      if (isMountedRef.current) setIsLoading(false)
    }
  }, [planId])

  useEffect(() => {
    isMountedRef.current = true
    loadPdfPreview()
    return () => {
      isMountedRef.current = false
      if (pdfUrlRef.current) window.URL.revokeObjectURL(pdfUrlRef.current)
    }
  }, [loadPdfPreview])

  const handleDownloadPdf = async () => {
    try {
      const pdfBlob = await fetchPlanPdf({
        plan_estudio_id: planId,
        convertTo: 'pdf',
      })

      const url = window.URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${planFileBaseName}.pdf`
      document.body.appendChild(link)
      link.click()

      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      alert('No se pudo generar el PDF')
    }
  }

  const handleDownloadWord = async () => {
    try {
      const docBlob = await fetchPlanPdf({
        plan_estudio_id: planId,
      })

      const url = window.URL.createObjectURL(docBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${planFileBaseName}.docx`
      document.body.appendChild(link)
      link.click()

      link.remove()
      setTimeout(() => window.URL.revokeObjectURL(url), 1000)
    } catch (error) {
      console.error(error)
      alert('No se pudo generar el Word')
    }
  }
  return (
    <div className="bg-background flex min-h-screen flex-col gap-6">
      {/* HEADER DE ACCIONES */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-foreground text-xl font-bold">
            Documento del Plan
          </h1>
          <p className="text-muted-foreground text-sm">
            Vista previa y descarga del documento oficial
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={loadPdfPreview}
          >
            <RefreshCcw size={16} /> Regenerar
          </Button>
          <Button size="sm" className="gap-2" onClick={handleDownloadWord}>
            <Download size={16} /> Descargar Word
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleDownloadPdf}
          >
            <Download size={16} /> Descargar PDF
          </Button>
        </div>
      </div>

      {/* TARJETAS DE ESTADO */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatusCard
          icon={<CheckCircle2 className="text-green-500" />}
          label="Estado"
          value="Generado"
        />
        <StatusCard
          icon={<Clock className="text-blue-500" />}
          label="Última generación"
          value="28 Ene 2024, 11:30"
        />
        <StatusCard
          icon={<FileJson className="text-orange-500" />}
          label="Versión"
          value="v1.2"
        />
      </div>

      {/* CONTENEDOR DEL DOCUMENTO (Visor) */}
      {/* CONTENEDOR DEL VISOR REAL */}
      <Card className="border-border overflow-hidden shadow-sm">
        <div className="border-border bg-muted/20 flex items-center justify-between border-b p-2 px-4">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <FileText size={14} /> Preview_Documento.pdf
          </div>
          {pdfUrl && (
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
          {isLoading ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-4">
              <RefreshCcw size={40} className="animate-spin opacity-60" />
              <p className="animate-pulse">Generando vista previa del PDF...</p>
            </div>
          ) : pdfUrl ? (
            /* 3. VISOR DE PDF REAL */
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0`}
              /* Agregadas las clases dark:invert dark:hue-rotate-180 */
              className="h-250 w-full max-w-250 border-none shadow-2xl dark:hue-rotate-180 dark:invert"
              title="PDF Preview"
            />
          ) : (
            <div className="text-muted-foreground flex items-center justify-center p-20">
              No se pudo cargar la vista previa.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function sanitizeFileBaseName(input: string): string {
  const text = String(input)
  const withoutControlChars = Array.from(text)
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')

  const cleaned = withoutControlChars
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')

  return (cleaned || 'documento').slice(0, 150)
}

// Componente pequeño para las tarjetas de estado superior
function StatusCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="border-border bg-muted/30 rounded-full border p-2">
          {icon}
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] font-bold tracking-tight uppercase">
            {label}
          </p>
          <p className="text-foreground text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
