import type { Tables } from '../_shared/database.types.ts'

export type AIGenerateSubjectInput = {
  datosUpdate: {
    id?: Tables<'asignaturas'>['id'] // si viene, es update; si no, es insert
    plan_estudio_id: Tables<'asignaturas'>['plan_estudio_id']
    estructura_id?: Tables<'asignaturas'>['estructura_id'] | null

    nombre?: Tables<'asignaturas'>['nombre']
    codigo?: Tables<'asignaturas'>['codigo']
    tipo?: Tables<'asignaturas'>['tipo'] | null
    creditos?: Tables<'asignaturas'>['creditos'] | null
    horas_academicas?: Tables<'asignaturas'>['horas_academicas'] | null
    horas_independientes?: Tables<'asignaturas'>['horas_independientes'] | null
    numero_ciclo?: Tables<'asignaturas'>['numero_ciclo'] | null
    linea_plan_id?: Tables<'asignaturas'>['linea_plan_id'] | null
    orden_celda?: Tables<'asignaturas'>['orden_celda'] | null
  }
  iaConfig?: {
    clonacionTradicional?: boolean
    descripcionEnfoqueAcademico?: string
    instruccionesAdicionalesIA?: string
    archivosReferencia?: Array<string> // OpenAI file ids
    repositoriosIds?: Array<string>
  }
}
