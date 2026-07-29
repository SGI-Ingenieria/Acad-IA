import { useStore } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'

import type { AIGeneratePlanInput } from '@/data'
import type { NivelPlanEstudio, TipoCiclo } from '@/data/types/domain'
import type { PasoWizardId } from '@/features/planes/nuevo/schema'

import { withForm } from '@/components/form'
import { Button } from '@/components/ui/button'
import {
  useCreatePlanManual,
  useGeneratePlanAI,
  useCatalogosPlanes,
  useClonePlan,
} from '@/data/hooks/usePlans'
import { qk } from '@/data/query/keys'
import {
  serializeGenerationDraft,
  watchPlanGeneration,
} from '@/data/realtime/watchAIGeneration'
import {
  errorPasoActual,
  nuevoPlanFormOpts,
  validarCreacion,
} from '@/features/planes/nuevo/schema'
import { getPlanDisplayName } from '@/lib/plan-display'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { defaultPlanesSearch } from '@/types/search'

/** Id estable para enlazar la acción principal con su motivo de bloqueo. */
const MOTIVO_ID = 'wizard-motivo-bloqueo'

export const WizardControls = withForm({
  ...nuevoPlanFormOpts,
  props: {} as {
    stepId: PasoWizardId
    esCurricular: boolean
    onPrev: () => void
    onNext: () => void
    disablePrev: boolean
    disableNext: boolean
    disableCreate: boolean
    isLastStep: boolean
    isNextPending?: boolean
    nextPendingLabel?: string
    /** Trabajo en curso que impide avanzar (subidas, deduplicación…). */
    motivoPendiente?: string | null
  },
  render: function Render({
    form,
    stepId,
    esCurricular,
    onPrev,
    onNext,
    disablePrev,
    disableNext,
    disableCreate,
    isLastStep,
    isNextPending = false,
    nextPendingLabel = 'Procesando…',
    motivoPendiente = null,
  }) {
    // Suscripción a los valores para poder explicar, en vivo, qué falta para
    // completar el paso (el resto del wizard no debe re-renderizarse por eso).
    const valoresActuales = useStore(form.store, (state) => state.values)
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const generatePlanAI = useGeneratePlanAI()
    const createPlanManual = useCreatePlanManual()
    const clonePlan = useClonePlan()
    const { data: catalogos } = useCatalogosPlanes()

    // Error del último intento de creación: presentación efímera (los
    // detalles también se notifican con toast). Sustituye a
    // `wizard.errorMessage`.
    const [serverError, setServerError] = useState<string | null>(null)

    const closeAndNavigateToList = () => {
      void navigate({
        to: '/planes',
        search: defaultPlanesSearch,
        resetScroll: false,
      })
    }

    // La creación es una operación remota multi-paso: TanStack Query aporta
    // el estado pendiente (sustituye a `wizard.isLoading`) y la protección
    // contra doble envío.
    const crearPlan = useMutation({
      // `async` sin `await` a propósito: convierte los throws de validación en
      // rechazos que maneja `onError`, mientras las mutaciones internas corren
      // en background con mutateAsync().then() para sobrevivir al desmontaje
      // del wizard (el cierre es inmediato, igual que el flujo original).
      // eslint-disable-next-line @typescript-eslint/require-await
      mutationFn: async () => {
        // Snapshot de los valores al momento del click.
        const values = form.state.values

        // Misma definición que usa el wizard para validar cada paso: si aquí
        // se dedujera de otro campo, el resumen podría bloquear la creación
        // por una regla que ningún paso anterior mostró.
        const validationError = validarCreacion(values, esCurricular)
        if (validationError) {
          throw new Error(validationError)
        }

        const nivelSeleccionado =
          catalogos?.carreras.find(
            (c) => c.id === values.datosBasicos.carrera.id,
          )?.nivel ?? ''

        if (values.tipoOrigen === 'IA') {
          const tipoCicloSafe = (values.datosBasicos.tipoCiclo ||
            'Semestre') as any
          const numCiclosSafe =
            typeof values.datosBasicos.numCiclos === 'number'
              ? values.datosBasicos.numCiclos
              : 1

          const adjuntos = values.iaConfig.archivosAdjuntos
          if (adjuntos.some((a) => a.uploadStatus !== 'exito')) {
            throw new Error(
              'Aún se están subiendo los archivos adjuntos. Espera a que todos estén en éxito.',
            )
          }

          const documentFileIds = adjuntos
            .map((a) => a.archivoId)
            .filter((x): x is string => Boolean(x))

          if (documentFileIds.length !== adjuntos.length) {
            throw new Error(
              'Faltan adjuntos documentales. Reintenta los archivos con error e intenta de nuevo.',
            )
          }

          const fileIds = Array.from(
            new Set([
              ...values.iaConfig.archivosReferencia,
              ...documentFileIds,
            ]),
          )

          const aiInput: AIGeneratePlanInput = {
            datosBasicos: {
              nombrePlan: values.datosBasicos.nombrePlan,
              fechaInicioImparticion:
                values.datosBasicos.fechaInicioImparticion,
              confirmarFechaPasada: values.confirmarFechaPasada,
              carreraId: values.datosBasicos.carrera.id,
              facultadId: values.datosBasicos.facultad.id,
              nivel: nivelSeleccionado,
              tipoCiclo: tipoCicloSafe,
              numCiclos: numCiclosSafe,
              semanasPorCiclo: values.datosBasicos.semanasPorCiclo,
              estructuraPlanId: values.datosBasicos.estructuraPlanId as string,
              estructuraRecomendadaId:
                values.datosBasicos.estructuraRecomendadaId,
              motivoEstructuraManual:
                values.datosBasicos.motivoEstructuraManual || null,
            },
            iaConfig: {
              descripcionEnfoqueAcademico:
                values.iaConfig.descripcionEnfoqueAcademico || '',
              instruccionesAdicionalesIA:
                values.iaConfig.instruccionesAdicionalesIA || '',
              references: {
                fileIds,
                collectionIds: values.iaConfig.coleccionesReferencia,
              },
              webSearchEnabled: values.iaConfig.webSearchEnabled,
              reasoningEffort: values.iaConfig.reasoningEffort,
              borradorDisenoId: values.iaBrief.borradorId,
              briefCurricular: {
                fundamentos: values.iaBrief.fundamentos,
                // Las respuestas se emparejan con su pregunta: sueltas, el
                // generador recibe valores sin la decisión que representan.
                aclaraciones: values.iaBrief.preguntas.map((pregunta) => ({
                  pregunta: pregunta.pregunta,
                  porQue: pregunta.porQue,
                  respuesta: values.iaBrief.respuestas[pregunta.id] ?? '',
                })),
                respuestas: values.iaBrief.respuestas,
                contradicciones: values.iaBrief.contradicciones,
                oportunidades: values.iaBrief.oportunidades,
                referentes: values.iaBrief.referentes,
                supuestos: values.iaBrief.supuestos,
                explicacion: values.iaBrief.explicacion,
              },
            },
            alcance: values.iaConfig.alcance,
          }

          // Toast temporal mientras la Edge responde con el plan.id (~3-5s).
          // Cuando llegue, el watcher reemplaza este toast con uno persistente.
          const initToastId = `plan-init-${Date.now()}`
          notify.loading(
            `Iniciando generación de "${values.datosBasicos.nombrePlan}"...`,
            { id: initToastId, duration: Infinity },
          )

          // Usamos mutateAsync().then() (no mutate con callbacks): la promesa
          // sobrevive al desmontaje del wizard. Con callbacks de mutate(), al
          // navegar fuera el observer se destruye y onSuccess nunca corre →
          // el watcher jamás arranca y el toast se queda colgado.
          const planNombre = values.datosBasicos.nombrePlan
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
                notify.error(
                  'No se pudo obtener el id del plan generado por IA.',
                )
                return
              }
              watchPlanGeneration({
                planId: String(planId),
                planName: planNombre,
                responseId: responseId ? String(responseId) : undefined,
                draft: {
                  wizard: serializeGenerationDraft(values),
                },
                queryClient,
                navigate: (path, opts) =>
                  navigate({
                    to: path,
                    state: { showConfetti: opts?.showConfetti },
                  } as any),
              })
              queryClient.refetchQueries({ queryKey: qk.planesListRoot() })
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

        if (values.tipoOrigen === 'CLONADO_TRADICIONAL') {
          const attached = values.clonTradicional.archivoPlanId
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

          const documentFileId = attached.archivoId
          if (!documentFileId) {
            throw new Error('Falta el archivo documental. Reintenta la subida.')
          }

          const aiInput: AIGeneratePlanInput = {
            clonacionPlan: true,
            datosBasicos: {
              estructuraPlanId: values.datosBasicos.estructuraPlanId as string,
              fechaInicioImparticion:
                values.datosBasicos.fechaInicioImparticion,
              confirmarFechaPasada: values.confirmarFechaPasada,
            },
            iaConfig: {
              references: { fileIds: [documentFileId], collectionIds: [] },
              webSearchEnabled: false,
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
              queryClient.refetchQueries({ queryKey: qk.planesListRoot() })
              notify.success('Plan clonado correctamente', {
                duration: 8_000,
                action: planId
                  ? {
                      label: 'Ver plan',
                      onClick: () =>
                        void navigate({
                          to: '/planes/$planId',
                          params: { planId: String(planId) },
                          state: { showConfetti: true },
                        }),
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

        if (values.tipoOrigen === 'CLONADO_INTERNO') {
          const planOrigenId = values.clonInterno.planOrigenId
          if (!planOrigenId) {
            throw new Error(
              'Selecciona el plan de estudios que quieres clonar.',
            )
          }

          clonePlan
            .mutateAsync({
              planOrigenId,
              overrides: {
                carrera_id: values.datosBasicos.carrera.id,
                estructura_id: values.datosBasicos.estructuraPlanId as string,
                nombre_propuesto: values.datosBasicos.nombrePlan,
                fechaInicioImparticion:
                  values.datosBasicos.fechaInicioImparticion,
                confirmarFechaPasada: values.confirmarFechaPasada,
                nivel: nivelSeleccionado as NivelPlanEstudio,
                tipo_ciclo: values.datosBasicos.tipoCiclo as TipoCiclo,
                numero_ciclos: (values.datosBasicos.numCiclos as number) || 1,
                semanas_por_ciclo: values.datosBasicos.semanasPorCiclo,
              },
            })
            .then((plan) => {
              notify.success(`Plan "${getPlanDisplayName(plan)}" clonado`, {
                action: {
                  label: 'Ver plan',
                  onClick: () =>
                    void navigate({
                      to: '/planes/$planId',
                      params: { planId: plan.id },
                      state: { showConfetti: true },
                    }),
                },
              })
              queryClient.refetchQueries({ queryKey: qk.planesListRoot() })
            })
            .catch((err) => {
              notify.error(err, {
                description: 'No se pudo clonar el plan del sistema.',
              })
            })

          closeAndNavigateToList()
          return
        }

        if (values.tipoOrigen === 'MANUAL') {
          createPlanManual
            .mutateAsync({
              carreraId: values.datosBasicos.carrera.id,
              estructuraId: values.datosBasicos.estructuraPlanId as string,
              estructuraRecomendadaId:
                values.datosBasicos.estructuraRecomendadaId,
              motivoEstructuraManual:
                values.datosBasicos.motivoEstructuraManual,
              nombrePropuesto: values.datosBasicos.nombrePlan,
              fechaInicioImparticion:
                values.datosBasicos.fechaInicioImparticion,
              confirmarFechaPasada: values.confirmarFechaPasada,
              nivel: nivelSeleccionado as NivelPlanEstudio,
              tipoCiclo: values.datosBasicos.tipoCiclo as TipoCiclo,
              numCiclos: (values.datosBasicos.numCiclos as number) || 1,
              semanasPorCiclo: values.datosBasicos.semanasPorCiclo,
              datos: {},
            })
            .then((plan) => {
              notify.success(`Plan "${getPlanDisplayName(plan)}" creado`, {
                action: {
                  label: 'Ver plan',
                  onClick: () =>
                    void navigate({
                      to: '/planes/$planId',
                      params: { planId: plan.id },
                      state: { showConfetti: true },
                    }),
                },
              })
              queryClient.refetchQueries({ queryKey: qk.planesListRoot() })
            })
            .catch((err) => {
              notify.error(err, {
                description: 'No se pudo crear el plan manualmente.',
              })
            })

          closeAndNavigateToList()
          return
        }
      },
      onMutate: () => {
        setServerError(null)
      },
      onError: (err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Error generando el plan'
        setServerError(message)
        notify.error(message)
      },
    })

    const handleCreate = () => {
      if (crearPlan.isPending) return
      crearPlan.mutate()
    }

    const isCreating = crearPlan.isPending

    // Motivo por el que la acción principal todavía no puede completarse. Se
    // evalúa con el mismo schema que valida el paso, de modo que el texto que
    // ve el usuario y el error de validación no pueden divergir.
    const motivoBloqueo =
      motivoPendiente ?? errorPasoActual(stepId, valoresActuales, esCurricular)
    const bloqueado = Boolean(motivoBloqueo)
    // `aria-disabled` en lugar de `disabled`: el control sigue siendo
    // enfocable y, al pulsarlo, el wizard marca los campos que faltan en vez
    // de dejar al usuario ante un botón mudo.
    const estadoBloqueado = {
      'aria-disabled': bloqueado || undefined,
      'aria-describedby': bloqueado ? MOTIVO_ID : undefined,
      className: cn(bloqueado && 'opacity-60'),
    }

    return (
      <div className="flex grow items-center justify-between">
        <Button
          variant="secondary"
          onClick={onPrev}
          disabled={disablePrev || isCreating}
        >
          Anterior
        </Button>
        <div className="mx-2 flex-1 text-right">
          {serverError ? (
            <span className="text-destructive text-sm font-medium">
              {serverError}
            </span>
          ) : motivoBloqueo ? (
            <span
              id={MOTIVO_ID}
              className="text-muted-foreground text-sm"
              aria-live="polite"
            >
              {motivoBloqueo}
            </span>
          ) : null}
        </div>
        {isLastStep ? (
          <Button
            onClick={handleCreate}
            disabled={disableCreate || isCreating}
            {...estadoBloqueado}
          >
            {isCreating ? 'Creando...' : 'Crear plan'}
          </Button>
        ) : !bloqueado || isNextPending ? (
          <Button
            onClick={onNext}
            disabled={disableNext}
            aria-busy={isNextPending}
            {...estadoBloqueado}
          >
            {isNextPending ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden />
                {nextPendingLabel}
              </>
            ) : (
              'Siguiente'
            )}
          </Button>
        ) : null}
      </div>
    )
  },
})
