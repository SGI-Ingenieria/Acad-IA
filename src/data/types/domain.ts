import type { Enums, Tables } from '../../types/supabase'

export type UUID = string

export type TipoEstructuraPlan = Enums<'tipo_estructura_plan'>
export type NivelPlanEstudio = Enums<'nivel_plan_estudio'>
export type TipoCiclo = Enums<'tipo_ciclo'>

export type TipoOrigen = Enums<'tipo_origen'>

export type TipoAsignatura = Enums<'tipo_asignatura'>

export type TipoBibliografia = Enums<'tipo_bibliografia'>
export type TipoFuenteBibliografia = Enums<'tipo_fuente_bibliografia'>

export type EstadoTareaRevision = Enums<'estado_tarea_revision'>
export type TipoNotificacion = Enums<'tipo_notificacion'>

export type TipoInteraccionIA = Enums<'tipo_interaccion_ia'>

export type ModalidadEducativa = 'Escolar' | 'No escolarizada' | 'Mixta'
export type DisenoCurricular = 'Rígido' | 'Flexible'

/** Basado en tu schema JSON (va típicamente dentro de planes_estudio.datos) */
export type PlanDatosSep = {
  nivel?: string
  nombre?: string
  modalidad_educativa?: ModalidadEducativa

  antecedente_academico?: string
  area_de_estudio?: string
  clave_del_plan_de_estudios?: string

  diseno_curricular?: DisenoCurricular

  total_de_ciclos_del_plan_de_estudios?: string
  duracion_del_ciclo_escolar?: string
  carga_horaria_a_la_semana?: number

  fines_de_aprendizaje_o_formacion?: string
  perfil_de_egreso?: string

  programa_de_investigacion?: string | null
  curso_propedeutico?: string | null

  perfil_de_ingreso?: string

  administracion_y_operatividad_del_plan_de_estudios?: string | null
  sustento_teorico_del_modelo_curricular?: string | null
  justificacion_de_la_propuesta_curricular?: string | null
  propuesta_de_evaluacion_periodica_del_plan_de_estudios?: string | null
}

export type PlanEstudioWithRel = Tables<'planes_estudio'> & {
  carreras:
    | (Tables<'carreras'> & {
        facultades: Tables<'facultades'> | null
      })
    | null
  estados_plan: Tables<'estados_plan'> | null
}

export type Paged<T> = { data: Array<T>; count: number | null }

export type FacultadRow = Tables<'facultades'>
export type CarreraRow = Tables<'carreras'>

export type EstructuraPlanRow = Tables<'estructuras_plan'>

export type EstructuraAsignatura = Tables<'estructuras_asignatura'>

export type EstadoPlanRow = Tables<'estados_plan'>
export type PlanEstudioRow = Tables<'planes_estudio'>

export type PlanEstudio = PlanEstudioRow & {
  carreras: (CarreraRow & { facultades: FacultadRow | null }) | null
  estructuras_plan: EstructuraPlanRow | null
  estados_plan: EstadoPlanRow | null
}

export type LineaPlan = Tables<'lineas_plan'>

export type Asignatura = Tables<'asignaturas'>

export type BibliografiaAsignatura = Tables<'bibliografia_asignatura'>

export type CambioPlan = Tables<'cambios_plan'>

export type CambioAsignatura = Tables<'cambios_asignatura'>

export type InteraccionIA = Tables<'interacciones_ia'>

export type TareaRevision = Tables<'tareas_revision'>

export type Notificacion = Tables<'notificaciones'>

export type Archivo = Tables<'archivos'>

// ── Flujo y estados ──────────────────────────────────────────────────────────
export type TransicionEstadoPlan = Tables<'transiciones_estado_plan'>

export type CategoriaComentario = 'INTERNO' | 'EXPERTO' | 'SEDE'

export type ComentarioPlan = Tables<'comentarios_plan'> & {
  autor: Pick<Tables<'usuarios_app'>, 'id' | 'nombre_completo'> | null
}
export type ComentarioAsignatura = Tables<'comentarios_asignatura'> & {
  autor: Pick<Tables<'usuarios_app'>, 'id' | 'nombre_completo'> | null
}

export type TipoExperto = 'EXPERTO' | 'SEDE_HERMANA'
export type Experto = Tables<'expertos'>
export type PlanExperto = Tables<'plan_expertos'> & {
  expertos: Experto | null
}
