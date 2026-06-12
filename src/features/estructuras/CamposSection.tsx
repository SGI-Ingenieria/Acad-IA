import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { CamposEditor } from './CamposEditor'
import { camposToDefinicion, parseCampos } from './types'

import type {
  CampoDefinicion,
  EstructuraAsignatura,
  EstructuraPlan,
} from './types'

import {
  useEstructurasAsignaturaCrud,
  useEstructurasPlanCrud,
} from '@/data'

type Modo = 'planes' | 'materias'
type Estructura = EstructuraPlan | EstructuraAsignatura

export function CamposSection({
  estructura,
  modo,
}: {
  estructura: Estructura
  modo: Modo
}) {
  const planCrud = useEstructurasPlanCrud()
  const asigCrud = useEstructurasAsignaturaCrud()

  const [campos, setCampos] = useState<Array<CampoDefinicion>>(() =>
    parseCampos(estructura.definicion),
  )
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setCampos(parseCampos(estructura.definicion))
    setDirty(false)
  }, [estructura.id, estructura.definicion])

  const isSaving = planCrud.update.isPending || asigCrud.update.isPending

  const handleSave = async () => {
    const definicion = camposToDefinicion(campos)
    const crud = modo === 'planes' ? planCrud : asigCrud
    try {
      await crud.update.mutateAsync({
        id: estructura.id,
        input: { definicion },
      })
      setDirty(false)
      toast.success('Estructura guardada')
    } catch {
      toast.error('No se pudo guardar')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-foreground text-sm font-semibold">
          Campos de la estructura
        </h3>
        <p className="text-muted-foreground text-sm">
          Define los campos que conforman esta plantilla. Arrastra para
          reordenar.
        </p>
      </div>
      <CamposEditor
        campos={campos}
        onChange={(next) => {
          setCampos(next)
          setDirty(true)
        }}
        dirty={dirty}
        isSaving={isSaving}
        onSave={handleSave}
      />
    </div>
  )
}
