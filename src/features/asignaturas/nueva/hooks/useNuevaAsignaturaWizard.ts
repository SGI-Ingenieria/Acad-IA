import { useState } from 'react'

import type { NewSubjectWizardState } from '../types'

export function useNuevaAsignaturaWizard(planId: string) {
  const [wizard, setWizard] = useState<NewSubjectWizardState>({
    step: 1,
    plan_estudio_id: planId,
    estructuraId: null,
    tipoOrigen: null,
    datosBasicos: {
      nombre: '',
      codigo: '',
      tipo: null,
      creditos: null,
      horasAcademicas: null,
      horasIndependientes: null,
      estructuraId: '',
    },
    sugerencias: [],
    clonInterno: {},
    clonTradicional: {
      archivosAdjuntos: [],
    },
    iaConfig: {
      descripcionEnfoqueAcademico: '',
      instruccionesAdicionalesIA: '',
      archivosReferencia: [],
      repositoriosReferencia: [],
      archivosAdjuntos: [],
    },
    iaMultiple: {
      enfoque: '',
      cantidadDeSugerencias: 10,
      isLoading: false,
    },
    resumen: {},
    archivosAdjuntosDedupePending: 0,
    isLoading: false,
    errorMessage: null,
  })

  const canContinueDesdeMetodo =
    wizard.tipoOrigen === 'MANUAL' ||
    wizard.tipoOrigen === 'IA_SIMPLE' ||
    wizard.tipoOrigen === 'IA_MULTIPLE' ||
    wizard.tipoOrigen === 'CLONADO_INTERNO' ||
    wizard.tipoOrigen === 'CLONADO_TRADICIONAL'

  const canContinueDesdeBasicos =
    wizard.tipoOrigen === 'CLONADO_TRADICIONAL'
      ? !!wizard.datosBasicos.estructuraId
      : (!!wizard.datosBasicos.nombre &&
          wizard.datosBasicos.tipo !== null &&
          wizard.datosBasicos.creditos !== null &&
          wizard.datosBasicos.creditos > 0 &&
          !!wizard.datosBasicos.estructuraId) ||
        (wizard.tipoOrigen === 'IA_MULTIPLE' &&
          wizard.sugerencias.filter((s) => s.selected).length > 0)

  const canContinueDesdeDetalles = (() => {
    if (wizard.tipoOrigen === 'MANUAL') return true
    if (wizard.tipoOrigen === 'IA_SIMPLE') {
      return !!wizard.iaConfig?.descripcionEnfoqueAcademico
    }
    if (wizard.tipoOrigen === 'CLONADO_INTERNO') {
      return !!wizard.clonInterno?.asignaturaOrigenId
    }
    if (wizard.tipoOrigen === 'CLONADO_TRADICIONAL') {
      return (wizard.clonTradicional?.archivosAdjuntos ?? []).length > 0
    }
    if (wizard.tipoOrigen === 'IA_MULTIPLE') {
      return wizard.estructuraId !== null
    }
    return false
  })()

  return {
    wizard,
    setWizard,
    canContinueDesdeMetodo,
    canContinueDesdeBasicos,
    canContinueDesdeDetalles,
  }
}
