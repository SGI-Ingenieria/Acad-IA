import { useState } from 'react'

import type { NewPlanWizardState } from '../types'

export function useNuevoPlanWizard() {
  const [wizard, setWizard] = useState<NewPlanWizardState>({
    step: 1,
    tipoOrigen: null,
    datosBasicos: {
      nombrePlan: '',
      facultad: { id: '', nombre: '' },
      carrera: { id: '', nombre: '' },
      tipoCiclo: '',
      numCiclos: null,
      estructuraPlanId: null,
    },
    // datosBasicos: {
    //   nombrePlan: "Medicina",
    //   carreraId: "medico",
    //   facultadId: "med",
    //   nivel: "Licenciatura",
    //   tipoCiclo: "SEMESTRE",
    //   numCiclos: 8,
    //   plantillaPlanId: "sep-2025",
    //   plantillaPlanVersion: "v2025.2 (Vigente)",
    //   plantillaMapaId: "sep-2017-xlsx",
    //   plantillaMapaVersion: "v2017.0",
    // },
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
    },
    resumen: {},
    isLoading: false,
    errorMessage: null,
  })

  const canContinueDesdeModo =
    wizard.tipoOrigen === 'MANUAL' ||
    wizard.tipoOrigen === 'IA' ||
    wizard.tipoOrigen === 'CLONADO_INTERNO' ||
    wizard.tipoOrigen === 'CLONADO_TRADICIONAL'

  const canContinueDesdeBasicos =
    wizard.tipoOrigen === 'CLONADO_TRADICIONAL'
      ? !!wizard.datosBasicos.estructuraPlanId
      : !!wizard.datosBasicos.nombrePlan &&
        !!wizard.datosBasicos.carrera.id &&
        !!wizard.datosBasicos.facultad.id &&
        wizard.datosBasicos.numCiclos !== null &&
        wizard.datosBasicos.numCiclos > 0 &&
        !!wizard.datosBasicos.estructuraPlanId

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
      return !!t.archivoPlanId
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
