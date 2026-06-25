export type AIGeneratePlanInput = {
  clonacionPlan?: boolean
  datosBasicos: {
    nombrePlan?: string
    carreraId?: string
    facultadId?: string
    tipoCiclo: 'Semestre' | 'Cuatrimestre' | 'Trimestre' | 'Otro'
    numCiclos: number
    estructuraPlanId: string
  }
  iaConfig: {
    descripcionEnfoqueAcademico?: string
    instruccionesAdicionalesIA?: string
    archivosReferencia?: Array<string>
    repositoriosIds?: Array<string>
    usarMCP?: boolean
    reasoningEffort?: 'auto' | 'none' | 'low' | 'medium' | 'high'
  }
  lineas?: Array<{
    nombre: string
    orden: number
    area?: string
    color?: string | null
  }>
  archivosAdjuntos?: Array<File>
}
