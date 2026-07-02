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
  useClonePlan,
} from '@/data/hooks/usePlans'
import {
  serializeGenerationDraft,
  watchPlanGeneration,
} from '@/data/realtime/watchAIGeneration'
import { getPlanDisplayName } from '@/lib/plan-display'
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
  const clonePlan = useClonePlan()
  const { data: catalogos } = useCatalogosPlanes()

  const nivelSeleccionado =
    catalogos?.carreras.find((c) => c.id === wizard.datosBasicos.carrera.id)
      ?.nivel ?? ''

  const closeAndNavigateToList = () => {
    setWizard((w) => ({ ...w, isLoading: false, errorMessage: null }))
    navigate({ to: '/planes', resetScroll: false } as any)
  }

  const handleCreate = () => {
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
            fechaInicioImparticion:
              wizard.datosBasicos.fechaInicioImparticion,
            confirmarFechaPasada: wizard.confirmarFechaPasada,
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
            reasoningEffort: wizard.iaConfig?.reasoningEffort ?? 'auto',
          },
        }

        // Toast temporal mientras la Edge responde con el plan.id (~3-5s).
        // Cuando llegue, el watcher reemplaza este toast con uno persistente.
        const initToastId = `plan-init-${Date.now()}`
        notify.loading(
          `Iniciando generación de "${wizard.datosBasicos.nombrePlan}"...`,
          { id: initToastId, duration: Infinity },
        )

        // Usamos mutateAsync().then() (no mutate con callbacks): la promesa
        // sobrevive al desmontaje del wizard. Con callbacks de mutate(), al
        // navegar fuera el observer se destruye y onSuccess nunca corre →
        // el watcher jamás arranca y el toast se queda colgado.
        const planNombre = wizard.datosBasicos.nombrePlan
        generatePlanAI
          .mutateAsync(aiInput as any)
          .then((resp: any) => {
            notify.dismiss(initToastId)
            const planId = resp?.plan?.id ?? resp?.id
            const responseId =
              resp?.openai?.responseId ??
              resp?.plan?.meta_origen?.ai?.responseId ??
              resp?.meta_origen?.ai?.responseId
            if (!planId) {
              notify.error('No se pudo obtener el id del plan generado por IA.')
              return
            }
            watchPlanGeneration({
              planId: String(planId),
              planName: planNombre,
              responseId: responseId ? String(responseId) : undefined,
              draft: {
                wizard: serializeGenerationDraft(wizard),
              },
              queryClient,
              navigate: (path, opts) =>
                navigate({
                  to: path,
                  state: { showConfetti: opts?.showConfetti },
                } as any),
            })
            queryClient.refetchQueries({ queryKey: ['planes', 'list'] })
          })
          .catch((err) => {
            notify.dismiss(initToastId)
            notify.error(err, {
              description: 'No se pudo iniciar la generación del plan.',
            })
          })

        // Cierra inmediatamente; la promesa corre en background.
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
            fechaInicioImparticion:
              wizard.datosBasicos.fechaInicioImparticion,
            confirmarFechaPasada: wizard.confirmarFechaPasada,
          },
          iaConfig: {
            archivosReferencia: [openaiFileId],
          },
        }

        const initToastId = `plan-clone-${Date.now()}`
        notify.loading('Clonando plan desde Word...', {
          id: initToastId,
          duration: Infinity,
        })

        generatePlanAI
          .mutateAsync(aiInput as any)
          .then((resp: any) => {
            notify.dismiss(initToastId)
            const planId = resp?.id ?? resp?.plan?.id
            queryClient.refetchQueries({ queryKey: ['planes', 'list'] })
            notify.success('Plan clonado correctamente', {
              duration: 8_000,
              action: planId
                ? {
                    label: 'Ver plan',
                    onClick: () =>
                      navigate({
                        to: `/planes/${String(planId)}`,
                        state: { showConfetti: true },
                      } as any),
                  }
                : undefined,
            })
          })
          .catch((err) => {
            notify.dismiss(initToastId)
            notify.error(err, {
              description: 'No se pudo clonar el plan.',
            })
          })

        closeAndNavigateToList()
        return
      }

      if (wizard.tipoOrigen === 'CLONADO_INTERNO') {
        const planOrigenId = wizard.clonInterno?.planOrigenId
        if (!planOrigenId) {
          throw new Error('Selecciona el plan de estudios que quieres clonar.')
        }

        clonePlan
          .mutateAsync({
            planOrigenId,
            overrides: {
              carrera_id: wizard.datosBasicos.carrera.id,
              estructura_id: wizard.datosBasicos.estructuraPlanId as string,
              nombre_propuesto: wizard.datosBasicos.nombrePlan,
              fechaInicioImparticion:
                wizard.datosBasicos.fechaInicioImparticion,
              confirmarFechaPasada: wizard.confirmarFechaPasada,
              nivel: nivelSeleccionado as NivelPlanEstudio,
              tipo_ciclo: wizard.datosBasicos.tipoCiclo as TipoCiclo,
              numero_ciclos: (wizard.datosBasicos.numCiclos as number) || 1,
            },
          })
          .then((plan) => {
            notify.success(`Plan "${getPlanDisplayName(plan)}" clonado`, {
              action: {
                label: 'Ver plan',
                onClick: () =>
                  navigate({
                    to: `/planes/${plan.id}`,
                    state: { showConfetti: true },
                  } as any),
              },
            })
            queryClient.refetchQueries({ queryKey: ['planes', 'list'] })
          })
          .catch((err) => {
            notify.error(err, {
              description: 'No se pudo clonar el plan del sistema.',
            })
          })

        closeAndNavigateToList()
        return
      }

      if (wizard.tipoOrigen === 'MANUAL') {
        createPlanManual
          .mutateAsync({
            carreraId: wizard.datosBasicos.carrera.id,
            estructuraId: wizard.datosBasicos.estructuraPlanId as string,
            nombrePropuesto: wizard.datosBasicos.nombrePlan,
            fechaInicioImparticion:
              wizard.datosBasicos.fechaInicioImparticion,
            confirmarFechaPasada: wizard.confirmarFechaPasada,
            nivel: nivelSeleccionado as NivelPlanEstudio,
            tipoCiclo: wizard.datosBasicos.tipoCiclo as TipoCiclo,
            numCiclos: (wizard.datosBasicos.numCiclos as number) || 1,
            datos: {},
          })
          .then((plan) => {
            notify.success(`Plan "${getPlanDisplayName(plan)}" creado`, {
              action: {
                label: 'Ver plan',
                onClick: () =>
                  navigate({
                    to: `/planes/${plan.id}`,
                    state: { showConfetti: true },
                  } as any),
              },
            })
            queryClient.refetchQueries({ queryKey: ['planes', 'list'] })
          })
          .catch((err) => {
            notify.error(err, {
              description: 'No se pudo crear el plan manualmente.',
            })
          })

        closeAndNavigateToList()
        return
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error generando el plan'
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
