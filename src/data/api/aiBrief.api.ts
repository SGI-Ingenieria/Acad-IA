import { invokeEdge } from '@/data/supabase/invokeEdge'

/**
 * Todo lo que el wizard ya decidió cuando pide el encuadre. Viaja completo a
 * propósito: sin estos datos el modelo gastaba sus preguntas en volver a pedir
 * el nivel académico, la facultad o la duración del plan.
 */
export type ContextoEncuadrePlan = {
  carrera: string
  nivel?: string | null
  facultad?: string | null
  tipoCiclo?: string | null
  numCiclos?: number | null
  semanasPorCiclo?: number | null
  tipoEstructura?: 'CURRICULAR' | 'NO_CURRICULAR' | null
  estructura?: string | null
  fechaInicioImparticion?: string | null
  instruccionesAdicionales?: string | null
}

/** Una ruta de diseño con su consecuencia declarada, no un «sí/no». */
export type OpcionEncuadre = {
  etiqueta: string
  implicacion: string
}

export type PreguntaEncuadre = {
  id: string
  pregunta: string
  /** Por qué esta decisión es relevante: la pregunta sola no lo explica. */
  porQue: string
  opciones: Array<OpcionEncuadre>
}

export type OportunidadEncuadre = {
  titulo: string
  detalle: string
}

/**
 * Programa o referente curricular con el que se contrastó la propuesta.
 * `origen` distingue lo verificado en la web o en los documentos adjuntos de
 * lo que el modelo aporta de su propio conocimiento.
 */
export type ReferenteEncuadre = {
  nombre: string
  aporte: string
  origen: 'WEB' | 'DOCUMENTO' | 'CONOCIMIENTO'
}

export type ResultadoEncuadrePlan = {
  borradorId: string
  ronda: number
  estado: 'REQUIERE_ACLARACION' | 'LISTO' | 'INCOMPATIBLE'
  fundamentos: {
    perfilIngreso: string
    perfilEgreso: string
    finesAprendizaje: string
  }
  contradicciones: Array<string>
  oportunidades: Array<OportunidadEncuadre>
  referentes: Array<ReferenteEncuadre>
  preguntas: Array<PreguntaEncuadre>
  supuestos: Array<string>
  explicacion: string
}

export type AnalizarEncuadrePlanInput = {
  borradorId?: string | null
  ronda: number
  contexto: ContextoEncuadrePlan
  solicitud: string
  respuestas: Record<string, string>
  webSearchEnabled: boolean
  reasoningEffort: 'auto' | 'none' | 'low' | 'medium' | 'high'
  references: {
    fileIds: Array<string>
    collectionIds: Array<string>
  }
}

export function analizar_encuadre_plan(input: AnalizarEncuadrePlanInput) {
  return invokeEdge<ResultadoEncuadrePlan>('ai-analyze-plan-brief', input)
}
