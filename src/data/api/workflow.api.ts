import { supabaseBrowser } from '../supabase/client'
import { invokeEdge } from '../supabase/invokeEdge'

import { getUserIdOrThrow, throwIfError } from './_helpers'

import type {
  CategoriaComentario,
  ComentarioAsignatura,
  ComentarioPlan,
  EstadoPlanRow,
  Experto,
  PlanExperto,
  TipoEstructuraPlan,
  TipoExperto,
  UUID,
} from '../types/domain'
import type { Tables, TablesUpdate } from '@/types/supabase'

const COMENTARIO_SELECT =
  'id,plan_estudio_id,estado_id,comentario_padre_id,autor_id,categoria,cuerpo,resuelto,creado_en,autor:autor_id(id,nombre_completo)'

const COMENTARIO_ASIG_SELECT =
  'id,asignatura_id,comentario_padre_id,autor_id,categoria,cuerpo,resuelto,creado_en,autor:autor_id(id,nombre_completo)'

const TRANSICION_SELECT =
  'id,desde_estado_id,hacia_estado_id,rol_permitido_id,tipo_estructura,creado_en,' +
  'desde:desde_estado_id(id,clave,etiqueta,color,orden),' +
  'hacia:hacia_estado_id(id,clave,etiqueta,color,orden),' +
  'rol:rol_permitido_id(id,clave,nombre)'

export type TransicionConRefs = Tables<'transiciones_estado_plan'> & {
  desde: Pick<
    EstadoPlanRow,
    'id' | 'clave' | 'etiqueta' | 'color' | 'orden'
  > | null
  hacia: Pick<
    EstadoPlanRow,
    'id' | 'clave' | 'etiqueta' | 'color' | 'orden'
  > | null
  rol: Pick<Tables<'roles'>, 'id' | 'clave' | 'nombre'> | null
}

export type RolAdmin = Pick<
  Tables<'roles'>,
  | 'id'
  | 'clave'
  | 'nombre'
  | 'descripcion'
  | 'nivel_jerarquico'
  | 'alcance_default'
>

export type PermisoAdmin = Tables<'permisos'>
export type RolPermisoAdmin = Tables<'roles_permisos'>

// ── Transiciones permitidas para el usuario actual (panel de transición) ───────
export async function transiciones_permitidas(
  planId: UUID,
): Promise<Array<EstadoPlanRow>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase.rpc('transiciones_permitidas_plan', {
    p_plan_id: planId,
  })
  throwIfError(error)
  return data ?? []
}

// ── Comentarios del plan (por fase) ────────────────────────────────────────────
export async function comentarios_plan_list(
  planId: UUID,
): Promise<Array<ComentarioPlan>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('comentarios_plan')
    .select(COMENTARIO_SELECT)
    .eq('plan_estudio_id', planId)
    .order('creado_en', { ascending: true })

  throwIfError(error)
  return data ?? []
}

export async function comentario_plan_create(input: {
  planId: UUID
  cuerpo: string
  estadoId?: UUID | null
  categoria?: CategoriaComentario
  comentarioPadreId?: UUID | null
}): Promise<ComentarioPlan> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  const { data, error } = await supabase
    .from('comentarios_plan')
    .insert({
      plan_estudio_id: input.planId,
      estado_id: input.estadoId ?? null,
      comentario_padre_id: input.comentarioPadreId ?? null,
      autor_id: userId,
      categoria: input.categoria ?? 'INTERNO',
      cuerpo: input.cuerpo.trim(),
    })
    .select(COMENTARIO_SELECT)
    .single()

  throwIfError(error)
  return data as unknown as ComentarioPlan
}

// ── Transición de estado de la asignatura (flujo PR de la materia) ─────────────
export type EstadoAsignaturaTransicion = 'borrador' | 'revisada' | 'aprobada'

export async function subjects_transition_state(payload: {
  asignaturaId: UUID
  nuevoEstado: EstadoAsignaturaTransicion
  comentario?: string
}): Promise<{ ok: true }> {
  return invokeEdge<{ ok: true }>('subjects_transition_state', payload)
}

// ── Comentarios de la asignatura (flujo PR de la materia) ──────────────────────
export async function comentarios_asignatura_list(
  asignaturaId: UUID,
): Promise<Array<ComentarioAsignatura>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('comentarios_asignatura')
    .select(COMENTARIO_ASIG_SELECT)
    .eq('asignatura_id', asignaturaId)
    .order('creado_en', { ascending: true })

  throwIfError(error)
  return data ?? []
}

export async function comentario_asignatura_create(input: {
  asignaturaId: UUID
  cuerpo: string
  categoria?: CategoriaComentario
  comentarioPadreId?: UUID | null
}): Promise<ComentarioAsignatura> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  const { data, error } = await supabase
    .from('comentarios_asignatura')
    .insert({
      asignatura_id: input.asignaturaId,
      comentario_padre_id: input.comentarioPadreId ?? null,
      autor_id: userId,
      categoria: input.categoria ?? 'INTERNO',
      cuerpo: input.cuerpo.trim(),
    })
    .select(COMENTARIO_ASIG_SELECT)
    .single()

  throwIfError(error)
  return data as unknown as ComentarioAsignatura
}

// ── Expertos y sedes hermanas ──────────────────────────────────────────────────
export async function expertos_list(): Promise<Array<Experto>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('expertos')
    .select(
      'id,usuario_id,nombre,institucion,contacto,tipo,creado_por,creado_en',
    )
    .order('nombre', { ascending: true })

  throwIfError(error)
  return data ?? []
}

export async function experto_create(input: {
  nombre: string
  institucion?: string | null
  contacto?: string | null
  tipo?: TipoExperto
  usuarioId?: UUID | null
}): Promise<Experto> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  const { data, error } = await supabase
    .from('expertos')
    .insert({
      nombre: input.nombre.trim(),
      institucion: input.institucion?.trim() || null,
      contacto: input.contacto?.trim() || null,
      tipo: input.tipo ?? 'EXPERTO',
      usuario_id: input.usuarioId ?? null,
      creado_por: userId,
    })
    .select(
      'id,usuario_id,nombre,institucion,contacto,tipo,creado_por,creado_en',
    )
    .single()

  throwIfError(error)
  return data as Experto
}

export async function experto_delete(id: UUID): Promise<void> {
  const supabase = supabaseBrowser()
  const { error } = await supabase.from('expertos').delete().eq('id', id)
  throwIfError(error)
}

export async function plan_expertos_list(
  planId: UUID,
): Promise<Array<PlanExperto>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('plan_expertos')
    .select(
      'id,plan_estudio_id,experto_id,creado_en,expertos(id,usuario_id,nombre,institucion,contacto,tipo,creado_por,creado_en)',
    )
    .eq('plan_estudio_id', planId)
    .order('creado_en', { ascending: true })

  throwIfError(error)
  return data ?? []
}

export async function plan_experto_add(input: {
  planId: UUID
  expertoId: UUID
}): Promise<{ id: UUID }> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('plan_expertos')
    .insert({ plan_estudio_id: input.planId, experto_id: input.expertoId })
    .select('id')
    .single()

  throwIfError(error)
  return data as { id: UUID }
}

export async function plan_experto_remove(id: UUID): Promise<void> {
  const supabase = supabaseBrowser()
  const { error } = await supabase.from('plan_expertos').delete().eq('id', id)
  throwIfError(error)
}

// ── Administración del state machine (estados + transiciones) ──────────────────
export async function roles_list(): Promise<Array<RolAdmin>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('roles')
    .select('id,clave,nombre,descripcion,nivel_jerarquico,alcance_default')
    .order('nivel_jerarquico', { ascending: true })

  throwIfError(error)
  return data ?? []
}

export async function permisos_list(): Promise<Array<PermisoAdmin>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('permisos')
    .select('id,clave,nombre,descripcion,grupo,orden,creado_en')
    .order('grupo', { ascending: true })
    .order('orden', { ascending: true })

  throwIfError(error)
  return data ?? []
}

export async function roles_permisos_list(): Promise<Array<RolPermisoAdmin>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('roles_permisos')
    .select('rol_id,permiso_id,creado_en')
    .order('creado_en', { ascending: true })

  throwIfError(error)
  return data ?? []
}

function normalizeRoleKey(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '_')
}

export async function rol_create(input: {
  clave: string
  nombre: string
  descripcion?: string | null
  nivel_jerarquico?: number
  alcance_default?: string
}): Promise<RolAdmin> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('roles')
    .insert({
      clave: normalizeRoleKey(input.clave),
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      nivel_jerarquico: input.nivel_jerarquico ?? 100,
      alcance_default: input.alcance_default ?? 'global',
    })
    .select('id,clave,nombre,descripcion,nivel_jerarquico,alcance_default')
    .single()

  throwIfError(error)
  return data as RolAdmin
}

export async function rol_update(
  id: UUID,
  input: {
    nombre?: string
    descripcion?: string | null
    nivel_jerarquico?: number
    alcance_default?: string
  },
): Promise<RolAdmin> {
  const supabase = supabaseBrowser()
  const patch: TablesUpdate<'roles'> = {}
  if (input.nombre !== undefined) patch['nombre'] = input.nombre.trim()
  if (input.descripcion !== undefined) {
    patch['descripcion'] = input.descripcion?.trim() || null
  }
  if (input.nivel_jerarquico !== undefined) {
    patch['nivel_jerarquico'] = input.nivel_jerarquico
  }
  if (input.alcance_default !== undefined) {
    patch['alcance_default'] = input.alcance_default
  }

  const { data, error } = await supabase
    .from('roles')
    .update(patch)
    .eq('id', id)
    .select('id,clave,nombre,descripcion,nivel_jerarquico,alcance_default')
    .single()

  throwIfError(error)
  return data as RolAdmin
}

export async function rol_delete(id: UUID): Promise<void> {
  const supabase = supabaseBrowser()
  const { error } = await supabase.from('roles').delete().eq('id', id)
  throwIfError(error)
}

export async function rol_permiso_set(input: {
  rolId: UUID
  permisoId: UUID
  enabled: boolean
}): Promise<void> {
  const supabase = supabaseBrowser()

  if (input.enabled) {
    const { error } = await supabase.from('roles_permisos').upsert(
      {
        rol_id: input.rolId,
        permiso_id: input.permisoId,
      },
      { onConflict: 'rol_id,permiso_id' },
    )
    throwIfError(error)
    return
  }

  const { error } = await supabase
    .from('roles_permisos')
    .delete()
    .eq('rol_id', input.rolId)
    .eq('permiso_id', input.permisoId)
  throwIfError(error)
}

export async function transiciones_list(): Promise<Array<TransicionConRefs>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('transiciones_estado_plan')
    .select(TRANSICION_SELECT)
    .order('creado_en', { ascending: true })

  throwIfError(error)
  return (data ?? []) as unknown as Array<TransicionConRefs>
}

export async function transicion_create(input: {
  desdeEstadoId: UUID
  haciaEstadoId: UUID
  rolPermitidoId: UUID
  tipoEstructura?: TipoEstructuraPlan | null
}): Promise<{ id: UUID }> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('transiciones_estado_plan')
    .insert({
      desde_estado_id: input.desdeEstadoId,
      hacia_estado_id: input.haciaEstadoId,
      rol_permitido_id: input.rolPermitidoId,
      tipo_estructura: input.tipoEstructura ?? null,
    })
    .select('id')
    .single()

  throwIfError(error)
  return data as { id: UUID }
}

export async function transicion_delete(id: UUID): Promise<void> {
  const supabase = supabaseBrowser()
  const { error } = await supabase
    .from('transiciones_estado_plan')
    .delete()
    .eq('id', id)
  throwIfError(error)
}

export async function estado_plan_create(input: {
  clave: string
  etiqueta: string
  orden?: number
  es_final?: boolean
  color?: string | null
}): Promise<EstadoPlanRow> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('estados_plan')
    .insert({
      clave: input.clave.trim().toUpperCase().replace(/\s+/g, '_'),
      etiqueta: input.etiqueta.trim(),
      orden: input.orden ?? 0,
      es_final: input.es_final ?? false,
      color: input.color?.trim() || null,
    })
    .select('id,clave,etiqueta,orden,es_final,color')
    .single()

  throwIfError(error)
  return data as EstadoPlanRow
}

export async function estado_plan_update(
  id: UUID,
  input: {
    etiqueta?: string
    orden?: number
    es_final?: boolean
    color?: string | null
  },
): Promise<EstadoPlanRow> {
  const supabase = supabaseBrowser()
  const patch: TablesUpdate<'estados_plan'> = {}
  if (input.etiqueta !== undefined) patch['etiqueta'] = input.etiqueta.trim()
  if (input.orden !== undefined) patch['orden'] = input.orden
  if (input.es_final !== undefined) patch['es_final'] = input.es_final
  if (input.color !== undefined) patch['color'] = input.color?.trim() || null

  const { data, error } = await supabase
    .from('estados_plan')
    .update(patch)
    .eq('id', id)
    .select('id,clave,etiqueta,orden,es_final,color')
    .single()

  throwIfError(error)
  return data as EstadoPlanRow
}

export async function estado_plan_delete(id: UUID): Promise<void> {
  const supabase = supabaseBrowser()
  const { error } = await supabase.from('estados_plan').delete().eq('id', id)
  throwIfError(error)
}
