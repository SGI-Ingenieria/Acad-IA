import type { Database, Enums, Tables } from '../../types/supabase'

export type UUID = string

export type TipoEstructuraPlan = Enums<'tipo_estructura_plan'>
export type NivelPlanEstudio = Enums<'nivel_plan_estudio'>
export type TipoCiclo = Enums<'tipo_ciclo'>

export type TipoOrigen = Enums<'tipo_origen'>

export type TipoAsignatura = Enums<'tipo_asignatura'>
export type EstadoAsignatura = Enums<'estado_asignatura'>

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

export type RolResponsableAsignatura = Enums<'rol_responsable_asignatura'>

/** Motivo por el que el usuario ve una asignatura en el catálogo `/asignaturas`. */
export type CatalogoAsignaturaMotivo =
  | { tipo: 'global'; label: string }
  | { tipo: 'facultad'; label: string }
  | { tipo: 'carrera'; label: string }
  | { tipo: 'experto'; label: string }
  | {
      tipo: 'responsable_asignatura'
      rol: RolResponsableAsignatura
      label: string
    }

export type CatalogoAsignaturaResponsable = {
  usuario_id: UUID
  rol: RolResponsableAsignatura
  nombre: string | null
}

type CatalogoAsignaturaRpcRow =
  Database['public']['Functions']['catalogo_asignaturas_buscar']['Returns'][number]

/**
 * Fila del catálogo global de asignaturas. Igual que la fila cruda del RPC pero
 * con `motivos_acceso` y `responsables` tipados (el RPC los devuelve como `Json`)
 * y con `codigo`/`numero_ciclo` marcados como nullable: son columnas opcionales
 * de `asignaturas` que el generador de tipos infiere (incorrectamente) como no
 * nulas al provenir de una función `RETURNS TABLE`.
 */
export type CatalogoAsignaturaRow = Omit<
  CatalogoAsignaturaRpcRow,
  'motivos_acceso' | 'responsables' | 'codigo' | 'numero_ciclo'
> & {
  codigo: string | null
  numero_ciclo: number | null
  motivos_acceso: Array<CatalogoAsignaturaMotivo>
  responsables: Array<CatalogoAsignaturaResponsable>
}

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

export type ComentarioReferencia = {
  textoSeleccionado?: string
  contenedor?: string
  from?: number
  until?: number
  ruta?: string
  origen?: 'plan' | 'asignatura'
}

export type ComentarioAdjunto = Pick<
  Tables<'comentarios_adjuntos'>,
  'id' | 'comentario_id' | 'bucket' | 'path' | 'nombre' | 'mime' | 'size' | 'creado_en'
>

/** Metadata de un adjunto ya subido a Storage, listo para persistir. */
export type AdjuntoComentarioInput = {
  bucket: string
  path: string
  nombre: string | null
  mime: string | null
  size: number | null
}

export type ComentarioPlan = Tables<'comentarios_plan'> & {
  autor: Pick<Tables<'usuarios_app'>, 'id' | 'nombre_completo'> | null
  adjuntos?: Array<ComentarioAdjunto> | null
}
export type ComentarioAsignatura = Tables<'comentarios_asignatura'> & {
  autor: Pick<Tables<'usuarios_app'>, 'id' | 'nombre_completo'> | null
}

export type TipoExperto = 'EXPERTO' | 'SEDE_HERMANA'
export type Experto = Tables<'expertos'>
export type PlanExperto = Tables<'plan_expertos'> & {
  expertos: Experto | null
}
