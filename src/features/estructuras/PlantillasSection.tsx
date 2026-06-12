import { toast } from 'sonner'

import { PlantillasTab } from './PlantillasTab'

import type { EstructuraAsignatura, EstructuraPlan } from './types'

import {
  useEstructurasAsignaturaCrud,
  useEstructurasPlanCrud,
} from '@/data'

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

  return (
    <PlantillasTab
      estructuraId={estructura.id}
      templateId={estructura.template_id}
      onTemplateSelect={handleTemplateSelect}
    />
  )
}
