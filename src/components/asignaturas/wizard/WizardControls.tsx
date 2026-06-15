import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import type { AISubjectUnifiedInput } from '@/data'
import type { NewSubjectWizardState } from '@/features/asignaturas/nueva/types'
import type { TablesInsert } from '@/types/supabase'

import { Button } from '@/components/ui/button'
import {
  supabaseBrowser,
  useGenerateSubjectAI,
  qk,
  useCreateSubjectManual,
  subjects_get,
} from '@/data'
import { watchSubjectGeneration } from '@/data/realtime/watchAIGeneration'
import { notify } from '@/lib/toast'

export function WizardControls({
  wizard,
  setWizard,
  errorMessage,
  onPrev,
  onNext,
  disablePrev,
  disableNext,
  disableCreate,
  isLastStep,
}: {
  wizard: NewSubjectWizardState
  setWizard: React.Dispatch<React.SetStateAction<NewSubjectWizardState>>
  errorMessage?: string | null
  onPrev: () => void
  onNext: () => void
  disablePrev: boolean
  disableNext: boolean
  disableCreate: boolean
  isLastStep: boolean
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const generateSubjectAI = useGenerateSubjectAI()
  const createSubjectManual = useCreateSubjectManual()

  const getNombreFromFilename = (filename: string): string => {
    const base = filename.replace(/\.[^.]+$/, '').trim()
    return base.length ? base : filename
  }

  const navigateToAsignaturas = (planId: string) => {
    navigate({
      to: `/planes/${planId}/asignaturas`,
      resetScroll: false,
    })
  }

  const startSubjectWatcher = (args: {
    subjectId: string
    planId: string
    nombre: string
  }) => {
    watchSubjectGeneration({
      subjectId: args.subjectId,
      planId: args.planId,
      subjectName: args.nombre,
      queryClient: qc,
      navigate: (path, opts) =>
        navigate({ to: path, state: { showConfetti: opts?.showConfetti } }),
    })
  }

  const handleCreate = async () => {
    setWizard((w) => ({ ...w, isLoading: true, errorMessage: null }))

    try {
      if (wizard.tipoOrigen === 'CLONADO_INTERNO') {
        if (!wizard.plan_estudio_id) {
          throw new Error('Plan de estudio inválido.')
        }
        const asignaturaOrigenId = wizard.clonInterno?.asignaturaOrigenId
        if (!asignaturaOrigenId) {
          throw new Error('Selecciona una asignatura fuente.')
        }
        if (!wizard.datosBasicos.estructuraId) {
          throw new Error('Estructura inválida.')
        }
        if (!wizard.datosBasicos.nombre.trim()) {
          throw new Error('Nombre inválido.')
        }
        if (wizard.datosBasicos.tipo == null) {
          throw new Error('Tipo inválido.')
        }

        const fuente = await subjects_get(asignaturaOrigenId as any)
        const supabase = supabaseBrowser()
        const codigo = (wizard.datosBasicos.codigo ?? '').trim()

        const payload: TablesInsert<'asignaturas'> = {
          plan_estudio_id: wizard.plan_estudio_id,
          estructura_id: wizard.datosBasicos.estructuraId,
          codigo: codigo ? codigo : null,
          nombre: wizard.datosBasicos.nombre,
          tipo: wizard.datosBasicos.tipo,
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
            wizard.datosBasicos.horasAcademicas ??
            (fuente as any).horas_academicas ??
            null,
          horas_independientes:
            wizard.datosBasicos.horasIndependientes ??
            (fuente as any).horas_independientes ??
            null,
        }

        const { data: inserted, error: insertError } = await supabase
          .from('asignaturas')
          .insert(payload)
          .select('id,plan_estudio_id')
          .single()

        if (insertError) throw new Error(insertError.message)

        qc.invalidateQueries({
          queryKey: qk.planAsignaturas(wizard.plan_estudio_id),
        })
        qc.invalidateQueries({
          queryKey: qk.planHistorial(wizard.plan_estudio_id),
        })

        notify.success(
          `Asignatura "${wizard.datosBasicos.nombre}" clonada correctamente`,
        )
        setWizard((w) => ({ ...w, isLoading: false }))

        navigate({
          to: `/planes/${inserted.plan_estudio_id}/asignaturas/${inserted.id}`,
          state: { showConfetti: true },
          resetScroll: false,
        })
        return
      }

      if (wizard.tipoOrigen === 'CLONADO_TRADICIONAL') {
        if (!wizard.plan_estudio_id) {
          throw new Error('Plan de estudio inválido.')
        }
        const estructuraId = wizard.datosBasicos.estructuraId
        if (!estructuraId) {
          throw new Error('Selecciona una estructura para continuar.')
        }
        const adjuntos = wizard.clonTradicional?.archivosAdjuntos ?? []
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

        const openaiFileIds = adjuntos
          .map((a) => a.openaiFileId)
          .filter((x): x is string => Boolean(x))

        if (openaiFileIds.length !== adjuntos.length) {
          throw new Error(
            'Faltan archivos en OpenAI. Reintenta los archivos con error e intenta de nuevo.',
          )
        }

        const supabase = supabaseBrowser()

        const placeholders: Array<TablesInsert<'asignaturas'>> = adjuntos.map(
          (archivo) => ({
            plan_estudio_id: wizard.plan_estudio_id,
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
              openai: { fileId: archivo.openaiFileId },
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
          const openaiFileId = archivo.openaiFileId
          if (!openaiFileId) return

          const payload: AISubjectUnifiedInput = {
            datosUpdate: {
              id: row.id,
              plan_estudio_id: wizard.plan_estudio_id,
              estructura_id: estructuraId,
              nombre: getNombreFromFilename(archivo.file.name),
            },
            iaConfig: {
              clonacionTradicional: true,
              archivosReferencia: [openaiFileId],
              repositoriosIds: [],
            },
          }

          void generateSubjectAI.mutateAsync(payload as any).catch((e) => {
            console.error(
              'Error generando asignatura (clonado tradicional):',
              e,
            )
          })

          startSubjectWatcher({
            subjectId: String(row.id),
            planId: String(wizard.plan_estudio_id),
            nombre: row.nombre,
          })
        })

        qc.invalidateQueries({
          queryKey: qk.planAsignaturas(wizard.plan_estudio_id),
        })
        qc.invalidateQueries({
          queryKey: qk.planHistorial(wizard.plan_estudio_id),
        })

        setWizard((w) => ({ ...w, isLoading: false }))
        navigateToAsignaturas(wizard.plan_estudio_id)
        return
      }

      if (wizard.tipoOrigen === 'IA_SIMPLE') {
        if (!wizard.plan_estudio_id) {
          throw new Error('Plan de estudio inválido.')
        }
        if (!wizard.datosBasicos.estructuraId) {
          throw new Error('Estructura inválida.')
        }
        if (!wizard.datosBasicos.nombre.trim()) {
          throw new Error('Nombre inválido.')
        }

        const supabase = supabaseBrowser()
        const placeholder: TablesInsert<'asignaturas'> = {
          plan_estudio_id: wizard.plan_estudio_id,
          estructura_id: wizard.datosBasicos.estructuraId,
          nombre: wizard.datosBasicos.nombre,
          codigo: wizard.datosBasicos.codigo ?? null,
          tipo: wizard.datosBasicos.tipo ?? undefined,
          horas_academicas: wizard.datosBasicos.horasAcademicas ?? null,
          horas_independientes: wizard.datosBasicos.horasIndependientes ?? null,
          estado: 'generando',
          tipo_origen: 'IA',
        }

        const { data: inserted, error: insertError } = await supabase
          .from('asignaturas')
          .insert(placeholder)
          .select('id,plan_estudio_id')
          .single()

        if (insertError) throw new Error(insertError.message)
        const subjectId = inserted.id

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

        const payload: AISubjectUnifiedInput = {
          datosUpdate: {
            id: subjectId,
            plan_estudio_id: wizard.plan_estudio_id,
            estructura_id: wizard.datosBasicos.estructuraId,
            nombre: wizard.datosBasicos.nombre,
            codigo: wizard.datosBasicos.codigo ?? null,
            tipo: wizard.datosBasicos.tipo ?? null,
            horas_academicas: wizard.datosBasicos.horasAcademicas ?? null,
            horas_independientes:
              wizard.datosBasicos.horasIndependientes ?? null,
          },
          iaConfig: {
            descripcionEnfoqueAcademico:
              wizard.iaConfig?.descripcionEnfoqueAcademico ?? undefined,
            instruccionesAdicionalesIA:
              wizard.iaConfig?.instruccionesAdicionalesIA ?? undefined,
            archivosReferencia,
            repositoriosIds: wizard.iaConfig?.repositoriosReferencia ?? [],
          },
        }

        // Dispara la Edge sin bloquear; el watcher se encarga del estado.
        void generateSubjectAI.mutateAsync(payload as any).catch((e) => {
          console.error('Error generando asignatura IA (simple):', e)
        })

        startSubjectWatcher({
          subjectId: String(subjectId),
          planId: String(wizard.plan_estudio_id),
          nombre: wizard.datosBasicos.nombre,
        })

        qc.invalidateQueries({
          queryKey: qk.planAsignaturas(wizard.plan_estudio_id),
        })

        setWizard((w) => ({ ...w, isLoading: false }))
        navigateToAsignaturas(wizard.plan_estudio_id)
        return
      }

      if (wizard.tipoOrigen === 'IA_MULTIPLE') {
        const selected = wizard.sugerencias.filter((s) => s.selected)
        if (selected.length === 0) {
          throw new Error('Selecciona al menos una sugerencia.')
        }
        if (!wizard.plan_estudio_id) {
          throw new Error('Plan de estudio inválido.')
        }
        if (!wizard.estructuraId) {
          throw new Error('Selecciona una estructura para continuar.')
        }

        const supabase = supabaseBrowser()

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

        const placeholders: Array<TablesInsert<'asignaturas'>> = selected.map(
          (s): TablesInsert<'asignaturas'> => {
            const p: any = {
              plan_estudio_id: wizard.plan_estudio_id,
              estructura_id: wizard.estructuraId,
              estado: 'generando',
              nombre: s.nombre,
              codigo: s.codigo ?? null,
              horas_academicas: s.horasAcademicas ?? null,
              horas_independientes: s.horasIndependientes ?? null,
              linea_plan_id: s.linea_plan_id ?? null,
              numero_ciclo: s.numero_ciclo ?? null,
            }
            if (s.tipo != null) p.tipo = s.tipo
            return p
          },
        )

        const { data: inserted, error: insertError } = await supabase
          .from('asignaturas')
          .insert(placeholders)
          .select('id,nombre')

        if (insertError) throw new Error(insertError.message)

        if (inserted.length !== selected.length) {
          throw new Error('No se pudieron crear todas las asignaturas.')
        }

        inserted.forEach((row, idx) => {
          const s = selected[idx]
          const payload: AISubjectUnifiedInput = {
            datosUpdate: {
              id: row.id,
              plan_estudio_id: wizard.plan_estudio_id,
              estructura_id: wizard.estructuraId ?? undefined,
              nombre: s.nombre,
              codigo: s.codigo ?? null,
              tipo: s.tipo ?? null,
              horas_academicas: s.horasAcademicas ?? null,
              horas_independientes: s.horasIndependientes ?? null,
              numero_ciclo: s.numero_ciclo ?? null,
              linea_plan_id: s.linea_plan_id ?? null,
            },
            iaConfig: {
              descripcionEnfoqueAcademico: s.descripcion,
              instruccionesAdicionalesIA:
                wizard.iaConfig?.instruccionesAdicionalesIA ?? undefined,
              archivosReferencia,
              repositoriosIds: wizard.iaConfig?.repositoriosReferencia ?? [],
            },
          }

          void generateSubjectAI.mutateAsync(payload as any).catch((e) => {
            console.error('Error generando asignatura IA (multiple):', e)
          })

          startSubjectWatcher({
            subjectId: String(row.id),
            planId: String(wizard.plan_estudio_id),
            nombre: row.nombre,
          })
        })

        qc.invalidateQueries({
          queryKey: qk.planAsignaturas(wizard.plan_estudio_id),
        })

        setWizard((w) => ({ ...w, isLoading: false }))
        navigateToAsignaturas(wizard.plan_estudio_id)
        return
      }

      if (wizard.tipoOrigen === 'MANUAL') {
        if (!wizard.plan_estudio_id) {
          throw new Error('Plan de estudio inválido.')
        }

        const asignatura = await createSubjectManual.mutateAsync({
          plan_estudio_id: wizard.plan_estudio_id,
          estructura_id: wizard.datosBasicos.estructuraId!,
          nombre: wizard.datosBasicos.nombre,
          codigo: wizard.datosBasicos.codigo ?? null,
          tipo: wizard.datosBasicos.tipo ?? undefined,
          horas_academicas: wizard.datosBasicos.horasAcademicas ?? null,
          horas_independientes: wizard.datosBasicos.horasIndependientes ?? null,
          linea_plan_id: null,
          numero_ciclo: null,
        })

        notify.success(`Asignatura "${asignatura.nombre}" creada`)
        setWizard((w) => ({ ...w, isLoading: false }))
        navigate({
          to: `/planes/${wizard.plan_estudio_id}/asignaturas/${asignatura.id}`,
          state: { showConfetti: true },
          resetScroll: false,
        })
        return
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error creando la asignatura'
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
        {(errorMessage ?? wizard.errorMessage) && (
          <span className="text-destructive text-sm font-medium">
            {errorMessage ?? wizard.errorMessage}
          </span>
        )}
      </div>
      {isLastStep ? (
        <Button onClick={handleCreate} disabled={disableCreate}>
          {wizard.isLoading
            ? 'Creando...'
            : wizard.tipoOrigen === 'CLONADO_TRADICIONAL'
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
}
