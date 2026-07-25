import { useState } from 'react'

import { valoresInicialesNuevaAsignatura } from '../schema'

import type { NuevaAsignaturaFormValues } from '../types'

import { consumeCancelledGenerationDraft } from '@/data/realtime/watchAIGeneration'

/**
 * Calcula, una sola vez por montaje, los `defaultValues` del form global del
 * wizard y el paso inicial del stepper.
 *
 * Este hook es la versión reducida del antiguo `useNuevaAsignaturaWizard`:
 * el estado vive ahora en TanStack Form (ver `NuevaAsignaturaModalContainer`)
 * y los booleans `canContinue*` fueron sustituidos por la validación por paso
 * de `camposPorPaso` + zod (ver `../schema.ts`). Aquí solo queda la
 * restauración del borrador de una generación cancelada, que debe consumirse
 * exactamente una vez (initializer de `useState`).
 */
export function useNuevaAsignaturaWizardDefaults(planId: string): {
  defaultValues: NuevaAsignaturaFormValues
  initialStep: 'metodo' | 'resumen'
} {
  const [init] = useState(() => {
    const restored = consumeCancelledGenerationDraft<
      Partial<NuevaAsignaturaFormValues>
    >('subject', (entry) => entry.kind === 'subject' && entry.planId === planId)

    const base = valoresInicialesNuevaAsignatura(planId)

    if (!restored) {
      return { defaultValues: base, initialStep: 'metodo' as const }
    }

    // Mezcla defensiva por sección: los borradores antiguos serializaban el
    // wizard completo (con `step`, `isLoading`, `errorMessage`…); aquí solo
    // se restauran los valores que pertenecen al form.
    const defaultValues: NuevaAsignaturaFormValues = {
      ...base,
      plan_estudio_id: planId,
      tipoOrigen: restored.tipoOrigen ?? base.tipoOrigen,
      datosBasicos: { ...base.datosBasicos, ...restored.datosBasicos },
      clonInterno: { ...base.clonInterno, ...restored.clonInterno },
      clonTradicional: {
        ...base.clonTradicional,
        ...restored.clonTradicional,
      },
      iaConfig: { ...base.iaConfig, ...restored.iaConfig },
      archivosAdjuntosDedupePending: 0,
    }

    return { defaultValues, initialStep: 'resumen' as const }
  })

  return init
}
