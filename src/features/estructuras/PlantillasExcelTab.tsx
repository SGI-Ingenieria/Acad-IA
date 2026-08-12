import { FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { TemplateCard } from './PlantillasTab'

import type { CarboneTemplate } from '@/data'

import { Button } from '@/components/ui/button'
import { usePlantillas, usePlantillasCrud } from '@/data'

/**
 * Gestor de la plantilla Excel del mapa curricular para una estructura de plan.
 * Espeja a PlantillasTab (Word) pero opera sobre archivos .xlsx y persiste la
 * plantilla activa en `estructuras_plan.excel_template_id`.
 */
export function PlantillasExcelTab({
  estructuraId,
  templateId,
  onTemplateSelect,
}: {
  estructuraId: string
  templateId?: string | null
  onTemplateSelect: (id: string | null) => void
}) {
  const { data: plantillas = [], isLoading } = usePlantillas(estructuraId, {
    kind: 'excel',
  })
  const crud = usePlantillasCrud(estructuraId, 'excel')
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [addVersionTo, setAddVersionTo] = useState<string | null>(null)

  const triggerUpload = (existingId?: string) => {
    setAddVersionTo(existingId ?? null)
    fileRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.xlsx')) {
      toast.error('Solo se aceptan archivos .xlsx')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    const currentExistingId = addVersionTo
    setAddVersionTo(null)
    setUploading(true)
    try {
      const result = await crud.upload.mutateAsync({
        file,
        estructuraId,
        kind: 'excel',
        existingId: currentExistingId ?? undefined,
      })
      const newId = result.id ?? result.templateId
      if (newId && !templateId) {
        onTemplateSelect(newId)
      }
      if (currentExistingId) {
        toast.success('Nueva versión subida correctamente')
      } else {
        toast.success('Plantilla subida correctamente')
      }
    } catch {
      toast.error('No se pudo subir la plantilla')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async (tpl: CarboneTemplate) => {
    const effectiveId = tpl.id || tpl.versionId
    try {
      await crud.remove.mutateAsync(effectiveId)
      if (templateId === effectiveId) onTemplateSelect(null)
      toast.success('Plantilla eliminada')
    } catch {
      toast.error('No se pudo eliminar la plantilla')
    }
  }

  const handleSelect = (tpl: CarboneTemplate) => {
    const effectiveId = tpl.id || tpl.versionId
    if (!effectiveId) {
      toast.error('Esta plantilla no tiene una referencia técnica válida')
      return
    }
    onTemplateSelect(effectiveId)
  }

  return (
    <div className="space-y-grupo">
      {/* Header */}
      <div className="gap-grupo flex items-start justify-between">
        <div>
          <p className="font-semibold">Plantillas Excel — Mapa curricular</p>
        </div>
        <Button size="sm" onClick={() => triggerUpload()} disabled={uploading}>
          {uploading ? (
            <Loader2 className="mr-relacionado h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-relacionado h-4 w-4" />
          )}
          Subir plantilla
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* List */}
      {isLoading && (
        <div className="py-pagina flex items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && plantillas.length === 0 && (
        <div className="border-border/60 gap-control py-pagina flex flex-col items-center rounded-xl border border-dashed">
          <div className="bg-muted p-control rounded-xl">
            <FileSpreadsheet className="text-muted-foreground h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-foreground text-sm font-medium">
              Sin plantillas
            </p>
            <p className="text-muted-foreground text-xs">
              Sube un archivo .xlsx para exportar el mapa curricular de esta
              estructura.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => triggerUpload()}>
            <Upload className="mr-relacionado h-4 w-4" /> Subir plantilla
          </Button>
        </div>
      )}

      {!isLoading && plantillas.length > 0 && (
        <div className="space-y-relacionado">
          {plantillas.map((tpl) => {
            const effectiveId = tpl.id || tpl.versionId
            return (
              <TemplateCard
                key={effectiveId}
                tpl={tpl}
                extension=".xlsx"
                isActive={
                  !!templateId &&
                  (templateId === tpl.id || templateId === tpl.versionId)
                }
                onSelect={() => handleSelect(tpl)}
                onDelete={() => handleDelete(tpl)}
                onAddVersion={() => triggerUpload(tpl.id || undefined)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
