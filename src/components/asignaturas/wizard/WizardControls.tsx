import { useStore } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import type { AISubjectUnifiedInput } from '@/data'
import type { NuevaAsignaturaFormValues } from '@/features/asignaturas/nueva/types'
import type { TablesInsert } from '@/types/supabase'

import { withForm } from '@/components/form'
import { Button } from '@/components/ui/button'
import {
  supabaseBrowser,
  supabaseBrowserWithHeaders,
  useGenerateSubjectAI,
  useLanzarGeneracionAsignatura,
  qk,
  useCreateSubjectManual,
  usePlan,
  useSubjectEstructuraDelPlan,
  subjects_get,
} from '@/data'
import { requestAdminOverrideReason } from '@/data/auth/planCapabilities'
import {
  serializeGenerationDraft,
  watchSubjectGeneration,
} from '@/data/realtime/watchAIGeneration'
import {
  nuevaAsignaturaFormOpts,
  validarCreacion,
} from '@/features/asignaturas/nueva/schema'
import { makeTempId } from '@/lib/optimistic'
import { notify } from '@/lib/toast'
import { defaultAsignaturasSearch } from '@/types/search'

export const WizardControls = withForm({
  ...nuevaAsignaturaFormOpts,
  props: {} as {
    onPrev: () => void
    onNext: () => void
    disablePrev: boolean
    disableNext: boolean
    disableCreate: boolean
    isLastStep: boolean
    adminOverrideRequired?: boolean
    onCreateEmpty?: () => void
    onCreateWithAI?: () => void
  },
  render: function Render({
    form,
    onPrev,
    onNext,
    disablePrev,
    disableNext,
    disableCreate,
    isLastStep,
    adminOverrideRequired = false,
    onCreateEmpty,
    onCreateWithAI,
  }) {
    const navigate = useNavigate()
    const qc = useQueryClient()
    const generateSubjectAI = useGenerateSubjectAI()
    const lanzarGeneracion = useLanzarGeneracionAsignatura()
    const createSubjectManual = useCreateSubjectManual()

    // Error del último intento de creación: presentación efímera (los
    // detalles también se notifican con toast). Sustituye a
    // `wizard.errorMessage`.
    const [serverError, setServerError] = useState<string | null>(null)

    const tipoOrigen = useStore(form.store, (s) => s.values.tipoOrigen)
    const planEstudioId = useStore(form.store, (s) => s.values.plan_estudio_id)

    // La plantilla de la asignatura no la elige el usuario: cada plantilla de
    // plan tiene exactamente una plantilla de asignatura (1:1 en base de datos).
    const { data: plan } = usePlan(planEstudioId)
    const { estructura: estructuraAsignatura } = useSubjectEstructuraDelPlan(
      plan?.estructura_id,
    )

    const getNombreFromFilename = (filename: string): string => {
      const base = filename.replace(/\.[^.]+$/, '').trim()
      return base.length ? base : filename
    }

    const navigateToAsignaturas = (planId: string) => {
      void navigate({
        to: '/planes/$planId/asignaturas',
        params: { planId },
        search: defaultAsignaturasSearch,
        resetScroll: false,
      })
    }

    const startSubjectWatcher = (args: {
      subjectId: string
      planId: string
      nombre: string
      responseId?: string
      values: NuevaAsignaturaFormValues
    }) => {
      watchSubjectGeneration({
        subjectId: args.subjectId,
        planId: args.planId,
        subjectName: args.nombre,
        responseId: args.responseId,
        draft: {
          wizard: serializeGenerationDraft(args.values),
        },
        queryClient: qc,
        navigate: (path, opts) =>
          navigate({ to: path, state: { showConfetti: opts?.showConfetti } }),
      })
    }

    // La creación es una operación remota multi-paso: TanStack Query aporta
    // el estado pendiente (sustituye a `wizard.isLoading`) y la protección
    // contra doble envío.
    const crearAsignatura = useMutation({
      mutationFn: async () => {
        // Snapshot de los valores al momento del click.
        const values = form.state.values

        const validationError = validarCreacion(values)
        if (validationError) {
          throw new Error(validationError)
        }

        const estructuraId = estructuraAsignatura?.id
        if (!estructuraId) {
          throw new Error(
            'El plan no tiene una plantilla de asignatura asignada. Configúrala en Administración → Estructuras.',
          )
        }

        const adminOverrideReason = adminOverrideRequired
          ? await requestAdminOverrideReason(
              'crear asignaturas fuera de la etapa normal del plan',
            )
          : null
        if (adminOverrideRequired && !adminOverrideReason) {
          throw new Error(
            'El motivo del sobreescritura administrativa es obligatorio.',
          )
        }
        if (
          adminOverrideRequired &&
          values.tipoOrigen &&
          ['IA_SIMPLE', 'CLONADO_TRADICIONAL'].includes(values.tipoOrigen)
        ) {
          throw new Error(
            'La IA no esta disponible cuando el plan ya esta en una etapa congelada.',
          )
        }
        const getSupabaseForWrite = () =>
          adminOverrideReason
            ? supabaseBrowserWithHeaders({
                'x-admin-override-reason': adminOverrideReason,
              })
            : supabaseBrowser()

        if (values.tipoOrigen === 'CLONADO_INTERNO') {
          if (!values.plan_estudio_id) {
            throw new Error('Plan de estudio inválido.')
          }
          const asignaturaOrigenId = values.clonInterno.asignaturaOrigenId
          if (!asignaturaOrigenId) {
            throw new Error('Selecciona una asignatura fuente.')
          }
          if (!values.datosBasicos.nombre.trim()) {
            throw new Error('Nombre inválido.')
          }
          if (values.datosBasicos.tipo == null) {
            throw new Error('Tipo inválido.')
          }

          const fuente = await subjects_get(asignaturaOrigenId)
          const supabase = getSupabaseForWrite()
          const codigo = (values.datosBasicos.codigo ?? '').trim()

          const payload: TablesInsert<'asignaturas'> = {
            plan_estudio_id: values.plan_estudio_id,
            estructura_id: estructuraId,
            codigo: codigo ? codigo : null,
            nombre: values.datosBasicos.nombre,
            tipo: values.datosBasicos.tipo,
            datos: (fuente as any).datos,
            contenido_tematico: (fuente as any).contenido_tematico,
            criterios_de_evaluacion: (fuente as any).criterios_de_evaluacion,
            tipo_origen: 'CLONADO_INTERNO',
            meta_origen: {
              ...(fuente as any).meta_origen,
              asignatura_origen_id: fuente.id,
              plan_origen_id: (fuente as any).plan_estudio_id,
            },
            horas_academicas:
              values.datosBasicos.horasAcademicas ??
              (fuente as any).horas_academicas ??
              null,
            horas_independientes:
              values.datosBasicos.horasIndependientes ??
              (fuente as any).horas_independientes ??
              null,
            numero_ciclo: values.datosBasicos.numeroCiclo,
            linea_plan_id: values.datosBasicos.lineaPlanId,
          }

          const { data: inserted, error: insertError } = await supabase
            .from('asignaturas')
            .insert(payload)
            .select('id,plan_estudio_id')
            .single()

          if (insertError) throw new Error(insertError.message)

          qc.invalidateQueries({
            queryKey: qk.planAsignaturas(values.plan_estudio_id),
          })
          qc.invalidateQueries({
            queryKey: qk.planHistorial(values.plan_estudio_id),
          })

          notify.success(
            `Asignatura "${values.datosBasicos.nombre}" clonada correctamente`,
          )

          void navigate({
            to: '/planes/$planId/asignaturas/$asignaturaId',
            params: {
              planId: inserted.plan_estudio_id,
              asignaturaId: inserted.id,
            },
            state: { showConfetti: true },
            resetScroll: false,
          })
          return
        }

        if (values.tipoOrigen === 'CLONADO_TRADICIONAL') {
          if (!values.plan_estudio_id) {
            throw new Error('Plan de estudio inválido.')
          }
          const adjuntos = values.clonTradicional.archivosAdjuntos
          if (adjuntos.length === 0) {
            throw new Error('Sube al menos un Word o PDF para continuar.')
          }
          if (adjuntos.length > 10) {
            throw new Error('Máximo 10 archivos por carga.')
          }
          if (adjuntos.some((a) => a.uploadStatus !== 'exito')) {
            throw new Error(
              'Aún se están subiendo los archivos. Espera a que todos estén en éxito.',
            )
          }

          const documentFileIds = adjuntos
            .map((a) => a.archivoId)
            .filter((x): x is string => Boolean(x))

          if (documentFileIds.length !== adjuntos.length) {
            throw new Error(
              'Faltan archivos documentales. Reintenta los archivos con error e intenta de nuevo.',
            )
          }

          const supabase = getSupabaseForWrite()

          const placeholders: Array<TablesInsert<'asignaturas'>> = adjuntos.map(
            (archivo) => ({
              plan_estudio_id: values.plan_estudio_id,
              estructura_id: estructuraId,
              estado: 'generando',
              tipo_origen: 'CLONADO_TRADICIONAL',
              nombre: getNombreFromFilename(archivo.file.name),
              codigo: null,
              horas_academicas: null,
              horas_independientes: null,
              numero_ciclo: null,
              linea_plan_id: null,
              meta_origen: {
                archivo: {
                  nombre: archivo.file.name,
                  size: archivo.file.size,
                  type: archivo.file.type,
                },
                archivos: {
                  archivoId: archivo.archivoId ?? null,
                  path: archivo.path ?? null,
                  sha256: archivo.sha256 ?? null,
                },
              } as any,
            }),
          )

          const { data: inserted, error: insertError } = await supabase
            .from('asignaturas')
            .insert(placeholders)
            .select('id,nombre')

          if (insertError) throw new Error(insertError.message)

          if (inserted.length !== adjuntos.length) {
            throw new Error('No se pudieron crear todas las asignaturas.')
          }

          inserted.forEach((row, idx) => {
            const archivo = adjuntos[idx]
            const documentFileId = archivo.archivoId
            if (!documentFileId) return

            const payload: AISubjectUnifiedInput = {
              datosUpdate: {
                id: row.id,
                plan_estudio_id: values.plan_estudio_id,
                estructura_id: estructuraId,
                nombre: getNombreFromFilename(archivo.file.name),
              },
              iaConfig: {
                clonacionTradicional: true,
                references: {
                  fileIds: [documentFileId],
                  collectionIds: [],
                },
                webSearchEnabled: false,
              },
            }

            void generateSubjectAI
              .mutateAsync(payload as any)
              .then((resp: any) => {
                startSubjectWatcher({
                  subjectId: String(row.id),
                  planId: String(values.plan_estudio_id),
                  nombre: row.nombre,
                  responseId: resp?.openai?.responseId
                    ? String(resp.openai.responseId)
                    : undefined,
                  values,
                })
              })
              .catch((e) => {
                console.error(
                  'Error generando asignatura (clonado tradicional):',
                  e,
                )
              })
          })

          qc.invalidateQueries({
            queryKey: qk.planAsignaturas(values.plan_estudio_id),
          })
          qc.invalidateQueries({
            queryKey: qk.planHistorial(values.plan_estudio_id),
          })

          navigateToAsignaturas(values.plan_estudio_id)
          return
        }

        if (values.tipoOrigen === 'IA_SIMPLE') {
          if (!values.plan_estudio_id) {
            throw new Error('Plan de estudio inválido.')
          }
          if (!values.datosBasicos.nombre.trim()) {
            throw new Error('Nombre inválido.')
          }

          // Se valida antes de insertar: si los adjuntos no están listos, la
          // fila «generando» quedaría huérfana y nadie la completaría.
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

          await lanzarGeneracion.mutateAsync({
            tempId: makeTempId(),
            placeholder: {
              plan_estudio_id: values.plan_estudio_id,
              estructura_id: estructuraId,
              nombre: values.datosBasicos.nombre,
              codigo: values.datosBasicos.codigo ?? null,
              tipo: values.datosBasicos.tipo ?? undefined,
              horas_academicas: values.datosBasicos.horasAcademicas ?? null,
              horas_independientes:
                values.datosBasicos.horasIndependientes ?? null,
              numero_ciclo: values.datosBasicos.numeroCiclo,
              linea_plan_id: values.datosBasicos.lineaPlanId,
              tipo_origen: 'IA',
            },
            ia: {
              descripcionEnfoqueAcademico:
                values.iaConfig.descripcionEnfoqueAcademico || undefined,
              instruccionesAdicionalesIA:
                values.iaConfig.instruccionesAdicionalesIA || undefined,
              references: {
                fileIds,
                collectionIds: values.iaConfig.coleccionesReferencia,
              },
              webSearchEnabled: values.iaConfig.webSearchEnabled,
              reasoningEffort: values.iaConfig.reasoningEffort,
            },
            draft: values,
            adminOverrideReason,
          })

          navigateToAsignaturas(values.plan_estudio_id)
          return
        }

        if (values.tipoOrigen === 'MANUAL') {
          if (!values.plan_estudio_id) {
            throw new Error('Plan de estudio inválido.')
          }

          const asignatura = await createSubjectManual.mutateAsync({
            plan_estudio_id: values.plan_estudio_id,
            estructura_id: estructuraId,
            nombre: values.datosBasicos.nombre,
            codigo: values.datosBasicos.codigo ?? null,
            tipo: values.datosBasicos.tipo ?? undefined,
            horas_academicas: values.datosBasicos.horasAcademicas ?? null,
            horas_independientes:
              values.datosBasicos.horasIndependientes ?? null,
            linea_plan_id: values.datosBasicos.lineaPlanId,
            numero_ciclo: values.datosBasicos.numeroCiclo,
            adminOverrideReason,
          })

          notify.success(`Asignatura "${asignatura.nombre}" creada`)
          void navigate({
            to: '/planes/$planId/asignaturas/$asignaturaId',
            params: {
              planId: values.plan_estudio_id,
              asignaturaId: asignatura.id,
            },
            state: { showConfetti: true },
            resetScroll: false,
          })
          return
        }
      },
      onMutate: () => {
        setServerError(null)
      },
      onError: (err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Error creando la asignatura'
        setServerError(message)
        notify.error(message)
      },
    })

    const handleCreate = () => {
      if (crearAsignatura.isPending) return
      crearAsignatura.mutate()
    }

    const isCreating = crearAsignatura.isPending

    return (
      <div className="flex grow items-center justify-between">
        <Button
          variant="secondary"
          onClick={onPrev}
          disabled={disablePrev || isCreating}
        >
          Anterior
        </Button>
        <div className="mx-2 flex-1">
          {serverError && (
            <span className="text-destructive text-sm font-medium">
              {serverError}
            </span>
          )}
        </div>
        {onCreateEmpty && onCreateWithAI ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onCreateEmpty}
              disabled={disableNext}
            >
              Crear vacía
            </Button>
            <Button onClick={onCreateWithAI} disabled={disableNext}>
              Crear con IA
            </Button>
          </div>
        ) : isLastStep ? (
          <Button onClick={handleCreate} disabled={disableCreate || isCreating}>
            {isCreating
              ? 'Creando...'
              : tipoOrigen === 'CLONADO_TRADICIONAL'
                ? 'Crear asignaturas'
                : 'Crear Asignatura'}
          </Button>
        ) : (
          <Button onClick={onNext} disabled={disableNext}>
            Siguiente
          </Button>
        )}
      </div>
    )
  },
})
