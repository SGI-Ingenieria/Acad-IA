import { useStore } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { ImportacionProgramasReviewDialog } from './ImportacionProgramasReviewDialog'

import type { ImportacionAcademicaDetalle } from '@/data'

import { withForm } from '@/components/form'
import { Button } from '@/components/ui/button'
import {
  useLanzarGeneracionAsignatura,
  useCreateSubjectManual,
  useCloneSubject,
  usePlan,
  useSubjectEstructuraDelPlan,
  useAnalizarImportacionAcademica,
  useAplicarImportacionProgramas,
  useCancelarImportacionAcademica,
  useCrearImportacionAcademica,
  useVincularArchivoImportacion,
} from '@/data'
import { requestAdminOverrideReason } from '@/data/auth/planCapabilities'
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
  }) {
    const navigate = useNavigate()
    const lanzarGeneracion = useLanzarGeneracionAsignatura()
    const createSubjectManual = useCreateSubjectManual()
    const cloneSubject = useCloneSubject()
    const createImport = useCrearImportacionAcademica()
    const linkImportFile = useVincularArchivoImportacion()
    const analyzeImport = useAnalizarImportacionAcademica()
    const applyPrograms = useAplicarImportacionProgramas()
    const cancelImport = useCancelarImportacionAcademica()

    // Error del último intento de creación: presentación efímera (los
    // detalles también se notifican con toast). Sustituye a
    // `wizard.errorMessage`.
    const [serverError, setServerError] = useState<string | null>(null)
    const [importacionRevision, setImportacionRevision] =
      useState<ImportacionAcademicaDetalle | null>(null)

    const tipoOrigen = useStore(form.store, (s) => s.values.tipoOrigen)
    const planEstudioId = useStore(form.store, (s) => s.values.plan_estudio_id)

    // La plantilla de la asignatura no la elige el usuario: cada plantilla de
    // plan tiene exactamente una plantilla de asignatura (1:1 en base de datos).
    const { data: plan } = usePlan(planEstudioId)
    const { estructura: estructuraAsignatura } = useSubjectEstructuraDelPlan(
      plan?.estructura_id,
    )

    const navigateToAsignaturas = (planId: string) => {
      void navigate({
        to: '/planes/$planId/asignaturas',
        params: { planId },
        search: defaultAsignaturasSearch,
        resetScroll: false,
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

          const inserted = await cloneSubject.mutateAsync({
            asignaturaOrigenId,
            planDestinoId: values.plan_estudio_id,
            adminOverrideReason,
            overrides: {
              nombre: values.datosBasicos.nombre,
              codigo: values.datosBasicos.codigo || undefined,
              tipo: values.datosBasicos.tipo,
              horas_academicas:
                values.datosBasicos.horasAcademicas ?? undefined,
              horas_independientes:
                values.datosBasicos.horasIndependientes ?? undefined,
              numero_ciclo: values.datosBasicos.numeroCiclo ?? undefined,
              linea_plan_id: values.datosBasicos.lineaPlanId ?? undefined,
            },
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

          const toastId = `programas-import-${Date.now()}`
          notify.loading('Analizando programas de asignatura...', {
            id: toastId,
            duration: Infinity,
          })
          try {
            const importacion = await createImport.mutateAsync({
              tipo: 'PROGRAMAS_ASIGNATURA',
              carreraId: plan?.carrera_id ?? null,
              estructuraDestinoId: plan?.estructura_id ?? null,
              planDestinoId: values.plan_estudio_id,
            })
            await Promise.all(
              documentFileIds.map((fileId) =>
                linkImportFile.mutateAsync({
                  importacionId: importacion.id,
                  fileId,
                  rol: 'PROGRAMA',
                }),
              ),
            )
            const revision = await analyzeImport.mutateAsync(importacion.id)
            notify.dismiss(toastId)
            return { kind: 'PROGRAM_REVIEW' as const, revision }
          } catch (error) {
            notify.dismiss(toastId)
            throw error
          }
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
              codigo: null,
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
            codigo: null,
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
      onSuccess: (result) => {
        if (result?.kind === 'PROGRAM_REVIEW') {
          setImportacionRevision(result.revision)
        }
      },
    })

    const handleCreate = () => {
      if (crearAsignatura.isPending) return
      crearAsignatura.mutate()
    }

    const isCreating = crearAsignatura.isPending

    const applyReviewedPrograms = async (idsExternos: Array<string>) => {
      if (!importacionRevision || !planEstudioId) return
      try {
        const result = await applyPrograms.mutateAsync({
          importacionId: importacionRevision.id,
          idsExternos,
        })
        setImportacionRevision(null)
        notify.success(
          `${result.asignatura_ids.length} programa${result.asignatura_ids.length === 1 ? '' : 's'} importado${result.asignatura_ids.length === 1 ? '' : 's'}`,
        )
        navigateToAsignaturas(planEstudioId)
      } catch (error) {
        notify.error(error, {
          description: 'No se pudieron importar los programas.',
        })
      }
    }

    const changeReviewOpen = (open: boolean) => {
      if (open || !importacionRevision || applyPrograms.isPending) return
      const importacionId = importacionRevision.id
      setImportacionRevision(null)
      void cancelImport.mutateAsync(importacionId).catch((error) => {
        notify.error(error, {
          description: 'No se pudo cancelar la importación.',
        })
      })
    }

    return (
      <>
        <div className="flex grow items-center justify-between">
          <Button
            variant="secondary"
            onClick={onPrev}
            disabled={disablePrev || isCreating}
          >
            Anterior
          </Button>
          <div className="mx-relacionado flex-1">
            {serverError && (
              <span className="text-destructive text-sm font-medium">
                {serverError}
              </span>
            )}
          </div>
          {isLastStep ? (
            <Button
              onClick={handleCreate}
              disabled={disableCreate || isCreating}
            >
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
        <ImportacionProgramasReviewDialog
          importacion={importacionRevision}
          open={Boolean(importacionRevision)}
          isApplying={applyPrograms.isPending}
          onOpenChange={changeReviewOpen}
          onApply={applyReviewedPrograms}
        />
      </>
    )
  },
})
