import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import type { AIGeneratePlanInput } from '@/data'
import type { NivelPlanEstudio, TipoCiclo } from '@/data/types/domain'
import type { NewPlanWizardState } from '@/features/planes/nuevo/types'

import { Button } from '@/components/ui/button'
import {
  useCreatePlanManual,
  useGeneratePlanAI,
  useCatalogosPlanes,
} from '@/data/hooks/usePlans'
import { watchPlanGeneration } from '@/data/realtime/watchAIGeneration'
import { notify } from '@/lib/toast'

export function WizardControls({
  errorMessage,
  onPrev,
  onNext,
  disablePrev,
  disableNext,
  disableCreate,
  isLastStep,
  wizard,
  setWizard,
}: {
  errorMessage?: string | null
  onPrev: () => void
  onNext: () => void
  disablePrev: boolean
  disableNext: boolean
  disableCreate: boolean
  isLastStep: boolean
  wizard: NewPlanWizardState
  setWizard: React.Dispatch<React.SetStateAction<NewPlanWizardState>>
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const generatePlanAI = useGeneratePlanAI()
  const createPlanManual = useCreatePlanManual()
  const { data: catalogos } = useCatalogosPlanes()

  const nivelSeleccionado =
    catalogos?.carreras.find((c) => c.id === wizard.datosBasicos.carrera.id)
      ?.nivel ?? ''

  const closeAndNavigateToList = () => {
    setWizard((w) => ({ ...w, isLoading: false, errorMessage: null }))
    navigate({ to: '/planes', resetScroll: false } as any)
  }

  const handleCreate = async () => {
    setWizard((w) => ({ ...w, isLoading: true, errorMessage: null }))

    try {
      if (wizard.tipoOrigen === 'IA') {
        const tipoCicloSafe = (wizard.datosBasicos.tipoCiclo ||
          'Semestre') as any
        const numCiclosSafe =
          typeof wizard.datosBasicos.numCiclos === 'number'
            ? wizard.datosBasicos.numCiclos
            : 1

        const adjuntos = wizard.iaConfig?.archivosAdjuntos ?? []
        if (adjuntos.some((a) => a.uploadStatus !== 'exito')) {
          throw new Error(
            'Aún se están subiendo los archivos adjuntos. Espera a que todos estén en éxito.',
          )
        }

        const openaiFileIds = adjuntos
          .map((a) => a.openaiFileId)
          .filter((x): x is string => Boolean(x))

        if (openaiFileIds.length !== adjuntos.length) {
          throw new Error(
            'Faltan adjuntos en OpenAI. Reintenta los archivos con error e intenta de nuevo.',
          )
        }

        const archivosReferencia = Array.from(
          new Set([
            ...(wizard.iaConfig?.archivosReferencia ?? []),
            ...openaiFileIds,
          ]),
        )

        const aiInput: AIGeneratePlanInput = {
          datosBasicos: {
            nombrePlan: wizard.datosBasicos.nombrePlan,
            carreraId: wizard.datosBasicos.carrera.id,
            facultadId: wizard.datosBasicos.facultad.id,
            nivel: nivelSeleccionado,
            tipoCiclo: tipoCicloSafe,
            numCiclos: numCiclosSafe,
            estructuraPlanId: wizard.datosBasicos.estructuraPlanId as string,
          },
          iaConfig: {
            descripcionEnfoqueAcademico:
              wizard.iaConfig?.descripcionEnfoqueAcademico || '',
            instruccionesAdicionalesIA:
              wizard.iaConfig?.instruccionesAdicionalesIA || '',
            archivosReferencia,
            repositoriosIds: wizard.iaConfig?.repositoriosReferencia || [],
          },
        }

        const resp: any = await generatePlanAI.mutateAsync(aiInput as any)
        const planId = resp?.plan?.id ?? resp?.id
        if (!planId) {
          throw new Error('No se pudo obtener el id del plan generado por IA')
        }

        watchPlanGeneration({
          planId: String(planId),
          planName: wizard.datosBasicos.nombrePlan,
          queryClient,
          navigate: (path, opts) =>
            navigate({ to: path, state: { showConfetti: opts?.showConfetti } }),
        })

        // Forzamos refetch antes de navegar para que el plan aparezca al
        // instante en /planes con su badge "Generando".
        await queryClient.refetchQueries({ queryKey: ['planes', 'list'] })
        closeAndNavigateToList()
        return
      }

      if (wizard.tipoOrigen === 'CLONADO_TRADICIONAL') {
        const attached = wizard.clonTradicional?.archivoPlanId
        if (!attached) {
          throw new Error(
            'Sube el Word del plan de estudios antes de continuar.',
          )
        }
        if (attached.uploadStatus !== 'exito') {
          throw new Error(
            'El archivo aún no ha terminado de subirse. Espera a que esté en éxito.',
          )
        }

        const openaiFileId = attached.openaiFileId
        if (!openaiFileId) {
          throw new Error('Falta el archivo en OpenAI. Reintenta la subida.')
        }

        const aiInput: AIGeneratePlanInput = {
          clonacionPlan: true,
          datosBasicos: {
            estructuraPlanId: wizard.datosBasicos.estructuraPlanId as string,
          },
          iaConfig: {
            archivosReferencia: [openaiFileId],
          },
        }

        const resp: any = await generatePlanAI.mutateAsync(aiInput as any)
        const planId = resp?.id ?? resp?.plan?.id
        if (!planId) {
          throw new Error('No se pudo obtener el id del plan generado por IA')
        }

        // Clonación termina inmediatamente (no requiere watcher de IA largo).
        queryClient.invalidateQueries({ queryKey: ['planes', 'list'] })
        notify.success('Plan clonado correctamente', {
          duration: 8_000,
          action: {
            label: 'Ver plan',
            onClick: () =>
              navigate({
                to: `/planes/${String(planId)}`,
                state: { showConfetti: true },
              }),
          },
        })
        closeAndNavigateToList()
        return
      }

      if (wizard.tipoOrigen === 'MANUAL') {
        const plan = await createPlanManual.mutateAsync({
          carreraId: wizard.datosBasicos.carrera.id,
          estructuraId: wizard.datosBasicos.estructuraPlanId as string,
          nombre: wizard.datosBasicos.nombrePlan,
          nivel: nivelSeleccionado as NivelPlanEstudio,
          tipoCiclo: wizard.datosBasicos.tipoCiclo as TipoCiclo,
          numCiclos: (wizard.datosBasicos.numCiclos as number) || 1,
          datos: {},
        })

        notify.success(`Plan "${plan.nombre}" creado`)
        setWizard((w) => ({ ...w, isLoading: false, errorMessage: null }))
        navigate({
          to: `/planes/${plan.id}`,
          state: { showConfetti: true },
        })
        return
      }
    } catch (err: any) {
      const message = err?.message ?? 'Error generando el plan'
      setWizard((w) => ({ ...w, isLoading: false, errorMessage: message }))
      notify.error(message)
    }
  }

  return (
    <div className="flex grow items-center justify-between">
      <Button variant="secondary" onClick={onPrev} disabled={disablePrev}>
        Anterior
      </Button>
      <div className="mx-2 flex-1">
        {errorMessage && (
          <span className="text-destructive text-sm font-medium">
            {errorMessage}
          </span>
        )}
      </div>
      {isLastStep ? (
        <Button onClick={handleCreate} disabled={disableCreate}>
          {wizard.isLoading ? 'Creando...' : 'Crear plan'}
        </Button>
      ) : (
        <Button onClick={onNext} disabled={disableNext}>
          Siguiente
        </Button>
      )}
    </div>
  )
}
