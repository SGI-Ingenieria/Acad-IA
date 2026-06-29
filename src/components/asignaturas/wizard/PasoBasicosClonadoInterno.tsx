import { AlertTriangle } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { NewSubjectWizardState } from '@/features/asignaturas/nueva/types'

import { PasoBasicosForm } from '@/components/asignaturas/wizard/PasoBasicosForm/PasoBasicosForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePlan, useSubject, useSubjectEstructuras } from '@/data'

export function PasoBasicosClonadoInterno({
  wizard,
  onChange,
}: {
  wizard: NewSubjectWizardState
  onChange: React.Dispatch<React.SetStateAction<NewSubjectWizardState>>
}) {
  const sourceId = wizard.clonInterno?.asignaturaOrigenId ?? null
  const { data: source, isLoading, isError } = useSubject(sourceId)
  const { data: plan } = usePlan(wizard.plan_estudio_id)
  const { data: estructurasDestino } = useSubjectEstructuras(
    plan?.estructura_id ?? null,
  )

  const lastAppliedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!source) return

    const estructuraDestino =
      estructurasDestino?.find((item) => item.id === source.estructura_id) ??
      estructurasDestino?.find(
        (item) => item.nombre === source.estructuras_asignatura?.nombre,
      ) ??
      estructurasDestino?.[0]

    const appliedKey = `${source.id}:${estructuraDestino?.id ?? ''}`
    if (lastAppliedRef.current === appliedKey) return
    lastAppliedRef.current = appliedKey

    onChange((w) => ({
      ...w,
      datosBasicos: {
        ...w.datosBasicos,
        nombre: source.nombre,
        codigo: source.codigo ?? '',
        tipo: (source.tipo as any) ?? null,
        creditos: source.creditos,
        horasAcademicas: (source as any).horas_academicas ?? null,
        horasIndependientes: (source as any).horas_independientes ?? null,
        estructuraId: (estructuraDestino?.id ??
          w.datosBasicos.estructuraId) as any,
      },
    }))
  }, [estructurasDestino, onChange, source])

  if (!sourceId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos básicos</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Selecciona una asignatura fuente para continuar.
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos básicos</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Cargando información de la asignatura fuente…
        </CardContent>
      </Card>
    )
  }

  if (isError || !source) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5" />
            No se pudo cargar la fuente
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Intenta seleccionar otra asignatura.
        </CardContent>
      </Card>
    )
  }

  return (
    <PasoBasicosForm
      wizard={wizard}
      onChange={onChange}
      estructuraFuenteId={source.estructura_id ?? null}
      estructuraPlanId={plan?.estructura_id ?? null}
    />
  )
}
