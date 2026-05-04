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
  }
  archivosAdjuntos?: Array<File>
}
