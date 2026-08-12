import { toast } from 'sonner'

import { PlantillasExcelTab } from './PlantillasExcelTab'
import { PlantillasTab } from './PlantillasTab'

import type { EstructuraAsignatura, EstructuraPlan } from './types'

import { useEstructurasAsignaturaCrud, useEstructurasPlanCrud } from '@/data'

type Modo = 'planes' | 'materias'
type Estructura = EstructuraPlan | EstructuraAsignatura

export function PlantillasSection({
  estructura,
  modo,
}: {
  estructura: Estructura
  modo: Modo
}) {
  const planCrud = useEstructurasPlanCrud()
  const asigCrud = useEstructurasAsignaturaCrud()

  const handleTemplateSelect = async (templateId: string | null) => {
    const crud = modo === 'planes' ? planCrud : asigCrud
    try {
      await crud.update.mutateAsync({
        id: estructura.id,
        input: { template_id: templateId },
      })
      toast.success(
        templateId
          ? 'Plantilla activa actualizada'
          : 'Plantilla activa eliminada',
      )
    } catch {
      toast.error('No se pudo actualizar la plantilla activa')
    }
  }

  const handleExcelTemplateSelect = async (excelTemplateId: string | null) => {
    try {
      await planCrud.update.mutateAsync({
        id: estructura.id,
        input: { excel_template_id: excelTemplateId },
      })
      toast.success(
        excelTemplateId
          ? 'Plantilla Excel activa actualizada'
          : 'Plantilla Excel activa eliminada',
      )
    } catch {
      toast.error('No se pudo actualizar la plantilla Excel activa')
    }
  }

  return (
    <div className="space-y-region">
      <PlantillasTab
        estructuraId={estructura.id}
        templateId={estructura.template_id}
        onTemplateSelect={handleTemplateSelect}
      />

      {modo === 'planes' && (
        <div className="border-border/60 pt-region border-t">
          <PlantillasExcelTab
            estructuraId={estructura.id}
            templateId={(estructura as EstructuraPlan).excel_template_id}
            onTemplateSelect={handleExcelTemplateSelect}
          />
        </div>
      )}
    </div>
  )
}
