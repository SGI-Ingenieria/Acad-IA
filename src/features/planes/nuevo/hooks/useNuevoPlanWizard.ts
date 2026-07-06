import { useMemo, useState } from 'react'

import type { NewPlanWizardState } from '../types'

import { useCatalogosPlanes } from '@/data/hooks/usePlans'
import { consumeCancelledGenerationDraft } from '@/data/realtime/watchAIGeneration'
import { isFechaCurricularPasada } from '@/lib/plan-curricular'

const defaultWizardState: NewPlanWizardState = {
  step: 1,
  tipoOrigen: null,
  datosBasicos: {
    nombrePlan: '',
    facultad: { id: '', nombre: '' },
    carrera: { id: '', nombre: '' },
    tipoCiclo: '',
    numCiclos: null,
    estructuraPlanId: null,
    fechaInicioImparticion: null,
  },
  clonInterno: { planOrigenId: null },
  clonTradicional: {
    archivoPlanId: null,
  },
  iaConfig: {
    descripcionEnfoqueAcademico: '',
    instruccionesAdicionalesIA: '',
    archivosReferencia: [],
    repositoriosReferencia: [],
    archivosAdjuntos: [],
    reasoningEffort: 'auto',
  },
  confirmarFechaPasada: false,
  lineas: [],
  resumen: {},
  isLoading: false,
  errorMessage: null,
}

export function useNuevoPlanWizard() {
  const [wizard, setWizard] = useState<NewPlanWizardState>(() => {
    const restored = consumeCancelledGenerationDraft<NewPlanWizardState>('plan')

    if (!restored) return defaultWizardState

    return {
      ...defaultWizardState,
      ...restored,
      datosBasicos: {
        ...defaultWizardState.datosBasicos,
        ...restored.datosBasicos,
        fechaInicioImparticion:
          restored.datosBasicos.fechaInicioImparticion ??
          (
            restored.datosBasicos as
              | { fechaInicioVigencia?: string | null }
              | undefined
          )?.fechaInicioVigencia ??
          null,
      },
      step: 4,
      isLoading: false,
      errorMessage: null,
    }
  })

  const { data: catalogos } = useCatalogosPlanes()

  const estructuraSeleccionada = useMemo(
    () =>
      catalogos?.estructurasPlan.find(
        (e) => e.id === wizard.datosBasicos.estructuraPlanId,
      ),
    [catalogos?.estructurasPlan, wizard.datosBasicos.estructuraPlanId],
  )

  const esCurricular = estructuraSeleccionada?.tipo === 'CURRICULAR'

  const canContinueDesdeModo =
    wizard.tipoOrigen === 'MANUAL' ||
    wizard.tipoOrigen === 'IA' ||
    wizard.tipoOrigen === 'CLONADO_INTERNO' ||
    wizard.tipoOrigen === 'CLONADO_TRADICIONAL'

  const canContinueDesdeBasicos = (() => {
    if (wizard.tipoOrigen === 'CLONADO_TRADICIONAL') {
      if (!wizard.datosBasicos.estructuraPlanId) return false
      if (!esCurricular) return true
      return (
        !!wizard.datosBasicos.fechaInicioImparticion &&
        (!isFechaCurricularPasada(
          wizard.datosBasicos.fechaInicioImparticion,
        ) ||
          !!wizard.confirmarFechaPasada)
      )
    }

    const base =
      !!wizard.datosBasicos.carrera.id &&
      !!wizard.datosBasicos.facultad.id &&
      wizard.datosBasicos.numCiclos !== null &&
      wizard.datosBasicos.numCiclos > 0 &&
      !!wizard.datosBasicos.estructuraPlanId

    if (!base) return false

    if (!esCurricular) return !!wizard.datosBasicos.nombrePlan.trim()

    return (
      !!wizard.datosBasicos.fechaInicioImparticion &&
      (!isFechaCurricularPasada(wizard.datosBasicos.fechaInicioImparticion) ||
        !!wizard.confirmarFechaPasada)
    )
  })()

  const canContinueDesdeDetalles = (() => {
    if (wizard.tipoOrigen === 'MANUAL') return true
    if (wizard.tipoOrigen === 'IA') {
      // Requerimos descripción del enfoque y notas adicionales
      return !!wizard.iaConfig?.descripcionEnfoqueAcademico
    }
    if (wizard.tipoOrigen === 'CLONADO_INTERNO') {
      return !!wizard.clonInterno?.planOrigenId
    }
    if (wizard.tipoOrigen === 'CLONADO_TRADICIONAL') {
      const t = wizard.clonTradicional
      if (!t) return false
      return !!t.archivoPlanId && t.archivoPlanId.uploadStatus === 'exito'
    }
    return false
  })()

  return {
    wizard,
    setWizard,
    canContinueDesdeModo,
    canContinueDesdeBasicos,
    canContinueDesdeDetalles,
  }
}
