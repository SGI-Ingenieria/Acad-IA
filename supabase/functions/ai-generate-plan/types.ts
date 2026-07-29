import type { AlcanceGeneracionPlan } from './alcance.ts'

export type AIGeneratePlanInput = {
  clonacionPlan?: boolean
  datosBasicos: {
    nombrePlan?: string
    fechaInicioImparticion?: string | null
    confirmarFechaPasada?: boolean
    carreraId?: string
    facultadId?: string
    tipoCiclo: 'Semestre' | 'Cuatrimestre' | 'Trimestre' | 'Otro'
    numCiclos: number
    /** Obligatoria con `tipoCiclo === 'Otro'`; ignorada en cualquier otro tipo. */
    semanasPorCiclo?: number | null
    estructuraPlanId: string
    estructuraRecomendadaId?: string | null
    motivoEstructuraManual?: string | null
  }
  iaConfig: {
    descripcionEnfoqueAcademico?: string
    instruccionesAdicionalesIA?: string
    references?: {
      fileIds?: Array<string>
      collectionIds?: Array<string>
    }
    webSearchEnabled?: boolean
    reasoningEffort?: 'auto' | 'none' | 'low' | 'medium' | 'high'
    briefCurricular?: Record<string, unknown>
    borradorDisenoId?: string | null
  }
  lineas?: Array<{
    nombre: string
    orden: number
    area?: string
    color?: string | null
  }>
  /**
   * Qué se genera además del plan. Parcial a propósito: un cliente anterior al
   * alcance no manda nada, y `normalizarAlcance` completa los huecos con el
   * comportamiento histórico. Ver `alcance.ts`.
   */
  alcance?: Partial<AlcanceGeneracionPlan>
}
