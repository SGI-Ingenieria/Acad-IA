import { useState } from 'react'

import { valoresInicialesNuevoPlan } from '../schema'

import type { NuevoPlanFormValues } from '../types'

import { consumeCancelledGenerationDraft } from '@/data/realtime/watchAIGeneration'

/**
 * Borrador restaurable de una generación cancelada. Los borradores antiguos
 * serializaban el wizard completo (con `step`, `isLoading`, `errorMessage` y
 * el alias legado `fechaInicioVigencia`); por eso el merge es defensivo y por
 * sección.
 */
type BorradorNuevoPlan = Partial<Omit<NuevoPlanFormValues, 'datosBasicos'>> & {
  datosBasicos?: Partial<NuevoPlanFormValues['datosBasicos']> & {
    fechaInicioVigencia?: string | null
  }
}

/**
 * Calcula, una sola vez por montaje, los `defaultValues` del form global del
 * wizard y el paso inicial del stepper.
 *
 * Este hook es la versión reducida del antiguo `useNuevoPlanWizard`: el
 * estado vive ahora en TanStack Form (ver `NuevoPlanModalContainer`) y los
 * booleans `canContinue*` fueron sustituidos por la validación por paso de
 * `camposPorPaso` + zod (ver `../schema.ts`). Aquí solo queda la restauración
 * del borrador de una generación cancelada, que debe consumirse exactamente
 * una vez (initializer de `useState`).
 */
export function useNuevoPlanWizardDefaults(): {
  defaultValues: NuevoPlanFormValues
  initialStep: 'modo' | 'resumen'
} {
  const [init] = useState(() => {
    const restored = consumeCancelledGenerationDraft<BorradorNuevoPlan>('plan')

    const base = valoresInicialesNuevoPlan()

    if (!restored) {
      return { defaultValues: base, initialStep: 'modo' as const }
    }

    const datosBasicos = restored.datosBasicos
    const defaultValues: NuevoPlanFormValues = {
      ...base,
      tipoOrigen: restored.tipoOrigen ?? base.tipoOrigen,
      datosBasicos: {
        nombrePlan: datosBasicos?.nombrePlan ?? base.datosBasicos.nombrePlan,
        facultad: {
          ...base.datosBasicos.facultad,
          ...datosBasicos?.facultad,
        },
        carrera: {
          ...base.datosBasicos.carrera,
          ...datosBasicos?.carrera,
        },
        tipoCiclo: datosBasicos?.tipoCiclo ?? base.datosBasicos.tipoCiclo,
        numCiclos: datosBasicos?.numCiclos ?? base.datosBasicos.numCiclos,
        tipoEstructura:
          datosBasicos?.tipoEstructura ?? base.datosBasicos.tipoEstructura,
        estructuraPlanId:
          datosBasicos?.estructuraPlanId ?? base.datosBasicos.estructuraPlanId,
        fechaInicioImparticion:
          datosBasicos?.fechaInicioImparticion ??
          datosBasicos?.fechaInicioVigencia ??
          null,
      },
      clonInterno: { ...base.clonInterno, ...restored.clonInterno },
      clonTradicional: {
        ...base.clonTradicional,
        ...restored.clonTradicional,
      },
      iaConfig: { ...base.iaConfig, ...restored.iaConfig },
      confirmarFechaPasada: restored.confirmarFechaPasada ?? false,
      archivosAdjuntosDedupePending: 0,
    }

    return { defaultValues, initialStep: 'resumen' as const }
  })

  return init
}
