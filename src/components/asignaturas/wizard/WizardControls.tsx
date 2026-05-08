import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { AISubjectUnifiedInput } from '@/data'
import type { NewSubjectWizardState } from '@/features/asignaturas/nueva/types'
import type { TablesInsert } from '@/types/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

import { Button } from '@/components/ui/button'
import {
  supabaseBrowser,
  useGenerateSubjectAI,
  qk,
  useCreateSubjectManual,
  subjects_get_maybe,
  subjects_get,
} from '@/data'

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
  const [isSpinningIA, setIsSpinningIA] = useState(false)
  const cancelledRef = useRef(false)
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null)
  const watchSubjectIdRef = useRef<string | null>(null)
  const watchTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
    }
  }, [])

  const stopSubjectWatch = useCallback(() => {
    if (watchTimeoutRef.current) {
      window.clearTimeout(watchTimeoutRef.current)
      watchTimeoutRef.current = null
    }

    watchSubjectIdRef.current = null

    const ch = realtimeChannelRef.current
    if (ch) {
      realtimeChannelRef.current = null
      try {
        supabaseBrowser().removeChannel(ch)
      } catch {
        // noop
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      stopSubjectWatch()
    }
  }, [stopSubjectWatch])

  const handleSubjectReady = (args: {
    id: string
    plan_estudio_id: string
    estado?: unknown
  }) => {
    if (cancelledRef.current) return

    const estado = String(args.estado ?? '').toLowerCase()
    if (estado === 'generando') return

    stopSubjectWatch()
    setIsSpinningIA(false)
    setWizard((w) => ({ ...w, isLoading: false }))

    navigate({
      to: `/planes/${args.plan_estudio_id}/asignaturas/${args.id}`,
      state: { showConfetti: true },
    })
  }

  const beginSubjectWatch = (args: { subjectId: string; planId: string }) => {
    stopSubjectWatch()

    watchSubjectIdRef.current = args.subjectId

    // Timeout de seguridad (mismo límite que teníamos con polling)
    watchTimeoutRef.current = window.setTimeout(
      () => {
        if (cancelledRef.current) return
        if (watchSubjectIdRef.current !== args.subjectId) return

        stopSubjectWatch()
        setIsSpinningIA(false)
        setWizard((w) => ({
          ...w,
          isLoading: false,
          errorMessage:
            'La generación está tardando demasiado. Intenta de nuevo en unos minutos.',
        }))
      },
      6 * 60 * 1000,
    )

    const supabase = supabaseBrowser()
    const channel = supabase.channel(`asignaturas-status-${args.subjectId}`)
    realtimeChannelRef.current = channel

    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'asignaturas',
        filter: `id=eq.${args.subjectId}`,
      },
      (payload) => {
        if (cancelledRef.current) return

        const next: any = (payload as any)?.new
        if (!next?.id || !next?.plan_estudio_id) return
        handleSubjectReady({
          id: String(next.id),
          plan_estudio_id: String(next.plan_estudio_id),
          estado: next.estado,
        })
      },
    )

    channel.subscribe((status) => {
      if (cancelledRef.current) return
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        stopSubjectWatch()
        setIsSpinningIA(false)
        setWizard((w) => ({
          ...w,
          isLoading: false,
          errorMessage:
            'No se pudo suscribir al estado de la asignatura. Intenta de nuevo.',
        }))
      }
    })
  }

  const handleCreate = async () => {
    setWizard((w) => ({
      ...w,
      isLoading: true,
      errorMessage: null,
    }))

    let startedWaiting = false

    try {
      const getNombreFromFilename = (filename: string): string => {
        const base = filename.replace(/\.[^.]+$/, '').trim()
        return base.length ? base : filename
      }

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
        if (wizard.datosBasicos.creditos == null) {
          throw new Error('Créditos inválidos.')
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
          creditos: wizard.datosBasicos.creditos,
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

        console.log('payload:', payload)

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
        setIsSpinningIA(true)

        const placeholders: Array<TablesInsert<'asignaturas'>> = adjuntos.map(
          (archivo) => ({
            plan_estudio_id: wizard.plan_estudio_id,
            estructura_id: estructuraId,
            estado: 'generando',
            tipo_origen: 'CLONADO_TRADICIONAL',
            nombre: getNombreFromFilename(archivo.file.name),
            codigo: null,
            creditos: 1,
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
              openai: {
                fileId: archivo.openaiFileId,
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
          .select('id')

        if (insertError) {
          throw new Error(insertError.message)
        }

        const insertedIds = inserted.map((r) => r.id)
        if (insertedIds.length !== adjuntos.length) {
          throw new Error('No se pudieron crear todas las asignaturas.')
        }

        insertedIds.forEach((id, idx) => {
          const archivo = adjuntos[idx]
          const openaiFileId = archivo.openaiFileId
          if (!openaiFileId) return

          const payload: AISubjectUnifiedInput = {
            datosUpdate: {
              id,
              plan_estudio_id: wizard.plan_estudio_id,
              estructura_id: estructuraId,
              nombre: getNombreFromFilename(archivo.file.name),
              creditos: 1,
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
        })

        qc.invalidateQueries({
          queryKey: qk.planAsignaturas(wizard.plan_estudio_id),
        })
        qc.invalidateQueries({
          queryKey: qk.planHistorial(wizard.plan_estudio_id),
        })

        navigate({
          to: `/planes/${wizard.plan_estudio_id}/asignaturas`,
          resetScroll: false,
        })

        setIsSpinningIA(false)
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
        if (wizard.datosBasicos.creditos == null) {
          throw new Error('Créditos inválidos.')
        }

        console.log(`${new Date().toISOString()} - Insertando asignatura IA`)

        const supabase = supabaseBrowser()
        const placeholder: TablesInsert<'asignaturas'> = {
          plan_estudio_id: wizard.plan_estudio_id,
          estructura_id: wizard.datosBasicos.estructuraId,
          nombre: wizard.datosBasicos.nombre,
          codigo: wizard.datosBasicos.codigo ?? null,
          tipo: wizard.datosBasicos.tipo ?? undefined,
          creditos: wizard.datosBasicos.creditos,
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

        setIsSpinningIA(true)

        // Inicia watch realtime antes de disparar la Edge para no perder updates.
        startedWaiting = true
        beginSubjectWatch({ subjectId, planId: wizard.plan_estudio_id })

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
            creditos: wizard.datosBasicos.creditos,
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

        console.log(
          `${new Date().toISOString()} - Disparando Edge IA asignatura (unified)`,
        )

        await generateSubjectAI.mutateAsync(payload as any)

        // Fallback: una lectura puntual por si el UPDATE llegó antes de suscribir.
        const latest = await subjects_get_maybe(subjectId)
        if (latest) {
          handleSubjectReady({
            id: latest.id as any,
            plan_estudio_id: latest.plan_estudio_id as any,
            estado: (latest as any).estado,
          })
        }

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

        setIsSpinningIA(true)

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
              creditos: s.creditos ?? 0,
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
          .select('id')

        if (insertError) {
          throw new Error(insertError.message)
        }

        const insertedIds = inserted.map((r) => r.id)
        if (insertedIds.length !== selected.length) {
          throw new Error('No se pudieron crear todas las asignaturas.')
        }

        // Disparar generación en paralelo (no bloquear navegación)
        insertedIds.forEach((id, idx) => {
          const s = selected[idx]
          const creditosForEdge =
            typeof s.creditos === 'number' && s.creditos > 0
              ? s.creditos
              : undefined
          const payload: AISubjectUnifiedInput = {
            datosUpdate: {
              id,
              plan_estudio_id: wizard.plan_estudio_id,
              estructura_id: wizard.estructuraId ?? undefined,
              nombre: s.nombre,
              codigo: s.codigo ?? null,
              tipo: s.tipo ?? null,
              creditos: creditosForEdge,
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
        })

        // Invalidar la query del listado del plan (una vez) para que la lista
        // muestre el estado actualizado y recargue cuando lleguen updates.
        qc.invalidateQueries({
          queryKey: qk.planAsignaturas(wizard.plan_estudio_id),
        })

        navigate({
          to: `/planes/${wizard.plan_estudio_id}/asignaturas`,
          resetScroll: false,
        })

        setIsSpinningIA(false)

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
          creditos: wizard.datosBasicos.creditos ?? 0,
          horas_academicas: wizard.datosBasicos.horasAcademicas ?? null,
          horas_independientes: wizard.datosBasicos.horasIndependientes ?? null,
          linea_plan_id: null,
          numero_ciclo: null,
        })

        navigate({
          to: `/planes/${wizard.plan_estudio_id}/asignaturas/${asignatura.id}`,
          state: { showConfetti: true },
          resetScroll: false,
        })
      }
    } catch (err: any) {
      setIsSpinningIA(false)
      stopSubjectWatch()
      setWizard((w) => ({
        ...w,
        isLoading: false,
        errorMessage: err?.message ?? 'Error creando la asignatura',
      }))
    } finally {
      if (!startedWaiting) {
        setIsSpinningIA(false)
        setWizard((w) => ({ ...w, isLoading: false }))
      }
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

      <div className="mx-2 flex w-5 items-center justify-center">
        <Loader2
          className={
            wizard.tipoOrigen === 'IA_SIMPLE' && isSpinningIA
              ? 'text-muted-foreground h-6 w-6 animate-spin'
              : 'h-6 w-6 opacity-0'
          }
          aria-hidden={!(wizard.tipoOrigen === 'IA_SIMPLE' && isSpinningIA)}
        />
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
