import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { AIGeneratePlanInput } from '@/data'
import type { NivelPlanEstudio, TipoCiclo } from '@/data/types/domain'
import type { NewPlanWizardState } from '@/features/planes/nuevo/types'
// import type { Database } from '@/types/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

import { Button } from '@/components/ui/button'
import { plans_get_maybe } from '@/data/api/plans.api'
import {
  useCreatePlanManual,
  useGeneratePlanAI,
  useCatalogosPlanes,
} from '@/data/hooks/usePlans'
import { supabaseBrowser } from '@/data/supabase/client'

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
  const [isSpinningIA, setIsSpinningIA] = useState(false)
  const cancelledRef = useRef(false)
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null)
  const watchPlanIdRef = useRef<string | null>(null)
  const watchTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
    }
  }, [])

  const stopPlanWatch = useCallback(() => {
    if (watchTimeoutRef.current) {
      window.clearTimeout(watchTimeoutRef.current)
      watchTimeoutRef.current = null
    }

    watchPlanIdRef.current = null

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
      stopPlanWatch()
    }
  }, [stopPlanWatch])

  const nivelSeleccionado =
    catalogos?.carreras.find((c) => c.id === wizard.datosBasicos.carrera.id)
      ?.nivel ?? ''

  const checkPlanStateAndAct = useCallback(
    async (planId: string) => {
      if (cancelledRef.current) return
      if (watchPlanIdRef.current !== planId) return

      const plan = await plans_get_maybe(planId as any)
      if (!plan) return

      const clave = String(plan.estados_plan?.clave ?? '').toUpperCase()

      if (clave.startsWith('GENERANDO')) return

      if (clave.startsWith('BORRADOR')) {
        stopPlanWatch()
        setIsSpinningIA(false)
        setWizard((w) => ({ ...w, isLoading: false }))

        // Invalidar lista de planes para forzar refresco cuando el usuario vuelva
        try {
          queryClient.invalidateQueries({ queryKey: ['planes', 'list'] })
        } catch {
          // noop
        }

        navigate({
          to: `/planes/${plan.id}`,
          state: { showConfetti: true },
        })
        return
      }

      if (clave.startsWith('FALLIDO')) {
        stopPlanWatch()
        setIsSpinningIA(false)

        setWizard((w) => ({
          ...w,
          isLoading: false,
          errorMessage: 'La generación del plan falló',
        }))
      }
    },
    [navigate, setWizard, stopPlanWatch, queryClient],
  )

  const beginPlanWatch = useCallback(
    (planId: string) => {
      stopPlanWatch()
      watchPlanIdRef.current = planId

      watchTimeoutRef.current = window.setTimeout(
        () => {
          if (cancelledRef.current) return
          if (watchPlanIdRef.current !== planId) return

          stopPlanWatch()
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
      const channel = supabase.channel(`planes-status-${planId}`)
      realtimeChannelRef.current = channel

      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'planes_estudio',
          filter: `id=eq.${planId}`,
        },
        () => {
          void checkPlanStateAndAct(planId)
        },
      )

      channel.subscribe((status) => {
        const st = status as
          | 'SUBSCRIBED'
          | 'TIMED_OUT'
          | 'CLOSED'
          | 'CHANNEL_ERROR'
        if (cancelledRef.current) return
        if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
          stopPlanWatch()
          setIsSpinningIA(false)
          setWizard((w) => ({
            ...w,
            isLoading: false,
            errorMessage:
              'No se pudo suscribir al estado del plan. Intenta de nuevo.',
          }))
        }
      })

      // Fallback inmediato por si el plan ya cambió antes de suscribir.
      void checkPlanStateAndAct(planId)
    },
    [checkPlanStateAndAct, setWizard, stopPlanWatch],
  )

  const handleCreate = async () => {
    // Start loading
    setWizard(
      (w: NewPlanWizardState): NewPlanWizardState => ({
        ...w,
        isLoading: true,
        errorMessage: null,
      }),
    )

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

        console.log(`${new Date().toISOString()} - Enviando a generar plan IA`)

        setIsSpinningIA(true)
        const resp: any = await generatePlanAI.mutateAsync(aiInput as any)
        const planId = resp?.plan?.id ?? resp?.id
        console.log(`${new Date().toISOString()} - Plan IA generado`, resp)

        if (!planId) {
          throw new Error('No se pudo obtener el id del plan generado por IA')
        }

        // Inicia realtime; los efectos navegan o marcan error.
        beginPlanWatch(String(planId))
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

        console.log(
          `${new Date().toISOString()} - Enviando a generar clon desde Word (IA)`,
        )

        setIsSpinningIA(true)
        const resp: any = await generatePlanAI.mutateAsync(aiInput as any)
        const planId = resp?.id ?? resp?.plan?.id
        console.log(
          `${new Date().toISOString()} - Plan IA generado (clon)`,
          resp,
        )

        if (!planId) {
          throw new Error('No se pudo obtener el id del plan generado por IA')
        }

        queryClient.invalidateQueries({ queryKey: ['planes', 'list'] })

        navigate({
          to: `/planes/${String(planId)}`,
          state: { showConfetti: true },
        })
        return
      }

      if (wizard.tipoOrigen === 'MANUAL') {
        // Crear plan vacío manualmente usando el hook
        const plan = await createPlanManual.mutateAsync({
          carreraId: wizard.datosBasicos.carrera.id,
          estructuraId: wizard.datosBasicos.estructuraPlanId as string,
          nombre: wizard.datosBasicos.nombrePlan,
          nivel: nivelSeleccionado as NivelPlanEstudio,
          tipoCiclo: wizard.datosBasicos.tipoCiclo as TipoCiclo,
          numCiclos: (wizard.datosBasicos.numCiclos as number) || 1,
          datos: {},
        })

        // Navegar al nuevo plan
        navigate({
          to: `/planes/${plan.id}`,
          state: { showConfetti: true },
        })
        return
      }
    } catch (err: any) {
      setIsSpinningIA(false)
      stopPlanWatch()
      setWizard((w) => ({
        ...w,
        isLoading: false,
        errorMessage: err?.message ?? 'Error generando el plan',
      }))
    } finally {
      // Si entramos en watch realtime, el loading se corta desde checkPlanStateAndAct.
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

      <div className="mx-2 flex w-5 items-center justify-center">
        <Loader2
          className={
            isSpinningIA
              ? 'text-muted-foreground h-6 w-6 animate-spin'
              : 'h-6 w-6 opacity-0'
          }
          aria-hidden={!isSpinningIA}
        />
      </div>
      {isLastStep ? (
        <Button onClick={handleCreate} disabled={disableCreate}>
          Crear plan
        </Button>
      ) : (
        <Button onClick={onNext} disabled={disableNext}>
          Siguiente
        </Button>
      )}
    </div>
  )
}
