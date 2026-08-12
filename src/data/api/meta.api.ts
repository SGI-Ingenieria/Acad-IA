import { supabaseBrowser } from '../supabase/client'

import { getUserIdOrThrow, requireData, throwIfError } from './_helpers'

import type { Json, Tables, TablesUpdate } from '@/types/supabase'

export type EstructuraPropagationOperations = {
  renames?: Array<{ from: string; to: string }>
  removed?: Array<string>
  typeChanged?: Array<string>
}

export async function facultades_list(): Promise<Array<Tables<'facultades'>>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('facultades')
    .select(
      'id,nombre,nombre_corto,prefijo,color,icono,activa,creado_en,actualizado_en',
    )
    .order('nombre', { ascending: true })

  throwIfError(error)
  return data as Array<Tables<'facultades'>>
}

export async function facultades_create(input: {
  nombre: string
  nombre_corto?: string | null
  prefijo?: string | null
  color?: string | null
  icono?: string | null
}): Promise<Tables<'facultades'>> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  const { data, error } = await supabase
    .from('facultades')
    .insert({
      nombre: input.nombre.trim(),
      nombre_corto: input.nombre_corto?.trim() || null,
      prefijo: input.prefijo?.trim() || null,
      color: input.color?.trim() || null,
      icono: input.icono?.trim() || null,
      activa: true,
      actualizado_en: new Date().toISOString(),
      creado_por: userId,
    })
    .select(
      'id,nombre,nombre_corto,prefijo,color,icono,activa,creado_en,actualizado_en',
    )
    .single()

  throwIfError(error)
  return data as Tables<'facultades'>
}

export async function facultades_update(
  facultadId: string,
  input: {
    nombre: string
    nombre_corto?: string | null
    prefijo?: string | null
    color?: string | null
    icono?: string | null
  },
): Promise<Tables<'facultades'>> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  const { data, error } = await supabase
    .from('facultades')
    .update({
      nombre: input.nombre.trim(),
      nombre_corto: input.nombre_corto?.trim() || null,
      prefijo: input.prefijo?.trim() || null,
      color: input.color?.trim() || null,
      icono: input.icono?.trim() || null,
      actualizado_en: new Date().toISOString(),
      actualizado_por: userId,
    })
    .eq('id', facultadId)
    .select(
      'id,nombre,nombre_corto,prefijo,color,icono,activa,creado_en,actualizado_en',
    )
    .single()

  throwIfError(error)
  return data as Tables<'facultades'>
}

export async function facultades_archive(facultadId: string): Promise<{
  id: string
}> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  const now = new Date().toISOString()

  const { error: facultadError } = await supabase
    .from('facultades')
    .update({ activa: false, actualizado_en: now, actualizado_por: userId })
    .eq('id', facultadId)

  throwIfError(facultadError)

  const { error: carrerasError } = await supabase
    .from('carreras')
    .update({ activa: false, actualizado_en: now, actualizado_por: userId })
    .eq('facultad_id', facultadId)

  throwIfError(carrerasError)

  return { id: facultadId }
}

const LINEAS_SUGERIDAS_COLS =
  'id,facultad_id,nombre,area,color,orden,activa,creado_en,actualizado_en'

export async function lineas_sugeridas_list(
  facultadId: string,
): Promise<Array<Tables<'lineas_curriculares_sugeridas'>>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('lineas_curriculares_sugeridas')
    .select(LINEAS_SUGERIDAS_COLS)
    .eq('facultad_id', facultadId)
    .eq('activa', true)
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true })

  throwIfError(error)
  return data as Array<Tables<'lineas_curriculares_sugeridas'>>
}

export async function lineas_sugeridas_create(input: {
  facultad_id: string
  nombre: string
  area?: string | null
  color?: string | null
  orden?: number
}): Promise<Tables<'lineas_curriculares_sugeridas'>> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  const { data, error } = await supabase
    .from('lineas_curriculares_sugeridas')
    .insert({
      facultad_id: input.facultad_id,
      nombre: input.nombre.trim(),
      area: input.area?.trim() || null,
      color: input.color?.trim() || null,
      orden: input.orden ?? 0,
      creado_por: userId,
    })
    .select(LINEAS_SUGERIDAS_COLS)
    .single()

  throwIfError(error)
  return data as Tables<'lineas_curriculares_sugeridas'>
}

export async function lineas_sugeridas_update(
  id: string,
  input: {
    nombre: string
    area?: string | null
    color?: string | null
    orden?: number
  },
): Promise<Tables<'lineas_curriculares_sugeridas'>> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  const { data, error } = await supabase
    .from('lineas_curriculares_sugeridas')
    .update({
      nombre: input.nombre.trim(),
      area: input.area?.trim() || null,
      color: input.color?.trim() || null,
      ...(input.orden !== undefined ? { orden: input.orden } : {}),
      actualizado_en: new Date().toISOString(),
      actualizado_por: userId,
    })
    .eq('id', id)
    .select(LINEAS_SUGERIDAS_COLS)
    .single()

  throwIfError(error)
  return data as Tables<'lineas_curriculares_sugeridas'>
}

export async function lineas_sugeridas_archive(
  id: string,
): Promise<{ id: string }> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  const { error } = await supabase
    .from('lineas_curriculares_sugeridas')
    .update({
      activa: false,
      actualizado_en: new Date().toISOString(),
      actualizado_por: userId,
    })
    .eq('id', id)

  throwIfError(error)
  return { id }
}

export async function carreras_list(params?: {
  facultadId?: string | null
}): Promise<Array<Tables<'carreras'>>> {
  const supabase = supabaseBrowser()

  let q = supabase
    .from('carreras')
    .select(
      'id,facultad_id,nombre,nombre_corto,clave_sep,activa,nivel,tipo_ciclo_default,ciclos_default,semanas_por_ciclo_default,creado_en,creado_por,actualizado_en,actualizado_por, facultades(id,nombre,nombre_corto,prefijo,color,icono)',
    )
    .order('nombre', { ascending: true })

  if (params?.facultadId) q = q.eq('facultad_id', params.facultadId)

  const { data, error } = await q
  throwIfError(error)
  return data as Array<Tables<'carreras'>>
}

/**
 * Estructura de ciclos que la carrera propone a sus planes nuevos. Es opcional:
 * sin ella el asistente cae a la convención del nivel.
 */
export type DefaultsCiclosCarrera = {
  tipo_ciclo_default?: Tables<'carreras'>['tipo_ciclo_default']
  ciclos_default?: number | null
  semanas_por_ciclo_default?: number | null
}

/**
 * Se exporta para que la actualización optimista escriba en caché exactamente
 * lo que el servidor va a guardar; si sólo lo normalizara el servidor, la
 * carrera se vería un instante con semanas que ya no le corresponden.
 */
export function normalizarDefaultsCiclos(input: DefaultsCiclosCarrera) {
  const tipo = input.tipo_ciclo_default ?? null
  return {
    tipo_ciclo_default: tipo,
    ciclos_default: input.ciclos_default ?? null,
    // La periodicidad no determina el calendario; la carrera conserva su
    // duración real para proponerla a cada plan nuevo.
    semanas_por_ciclo_default: input.semanas_por_ciclo_default ?? null,
  }
}

const CARRERA_SELECT =
  'id,facultad_id,nombre,nombre_corto,clave_sep,activa,nivel,tipo_ciclo_default,ciclos_default,semanas_por_ciclo_default,creado_en,actualizado_en,creado_por,actualizado_por'

export async function carreras_create(
  input: {
    facultad_id: string
    nombre: string
    nombre_corto?: string | null
    clave_sep?: string | null
    nivel?: Tables<'carreras'>['nivel']
  } & DefaultsCiclosCarrera,
): Promise<Tables<'carreras'>> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  const { data, error } = await supabase
    .from('carreras')
    .insert({
      facultad_id: input.facultad_id,
      nombre: input.nombre.trim(),
      nombre_corto: input.nombre_corto?.trim() || null,
      clave_sep: input.clave_sep?.trim() || null,
      nivel: input.nivel ?? 'Otro',
      ...normalizarDefaultsCiclos(input),
      activa: true,
      actualizado_en: new Date().toISOString(),
      creado_por: userId,
    })
    .select(CARRERA_SELECT)
    .single()

  throwIfError(error)
  return data as Tables<'carreras'>
}

export async function carreras_update(
  carreraId: string,
  input: {
    facultad_id: string
    nombre: string
    nombre_corto?: string | null
    clave_sep?: string | null
    nivel?: Tables<'carreras'>['nivel']
  } & DefaultsCiclosCarrera,
): Promise<Tables<'carreras'>> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  const { data, error } = await supabase
    .from('carreras')
    .update({
      facultad_id: input.facultad_id,
      nombre: input.nombre.trim(),
      nombre_corto: input.nombre_corto?.trim() || null,
      clave_sep: input.clave_sep?.trim() || null,
      nivel: input.nivel ?? 'Otro',
      ...normalizarDefaultsCiclos(input),
      actualizado_en: new Date().toISOString(),
      actualizado_por: userId,
    })
    .eq('id', carreraId)
    .select(
      `${CARRERA_SELECT}, facultades(id,nombre,nombre_corto,prefijo,color,icono)`,
    )
    .single()

  throwIfError(error)
  return data as unknown as Tables<'carreras'>
}

export async function carreras_archive(
  carreraId: string,
): Promise<{ id: string }> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)
  const { error } = await supabase
    .from('carreras')
    .update({
      activa: false,
      actualizado_en: new Date().toISOString(),
      actualizado_por: userId,
    })
    .eq('id', carreraId)

  throwIfError(error)
  return { id: carreraId }
}

export async function estructuras_plan_list(_params?: {
  nivel?: string | null
}): Promise<Array<Tables<'estructuras_plan'>>> {
  const supabase = supabaseBrowser()

  // Nota: en tu DDL no hay "nivel" en estructuras_plan; si luego lo agregas, filtra aquí.
  const { data, error } = await supabase
    .from('estructuras_plan')
    .select('*')
    .eq('tipo', 'CURRICULAR')
    .order('nombre', { ascending: true })

  throwIfError(error)
  return data ?? []
}

export async function estructuras_asignatura_list(params?: {
  estructuraPlanId?: string | null
}): Promise<Array<Tables<'estructuras_asignatura'>>> {
  const supabase = supabaseBrowser()
  let q = supabase
    .from('estructuras_asignatura')
    .select(
      'id,nombre,tipo,template_id,definicion,estructura_plan_id,creado_en,actualizado_en,creado_por,actualizado_por',
    )
    .order('nombre', { ascending: true })

  if (params?.estructuraPlanId) {
    q = q.eq('estructura_plan_id', params.estructuraPlanId)
  }

  const { data, error } = await q
  throwIfError(error)
  return data ?? []
}

export async function estructuras_plan_create(input: {
  nombre: string
  tipo: Tables<'estructuras_plan'>['tipo']
  template_id?: string | null
  definicion?: object
}): Promise<Tables<'estructuras_plan'>> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)
  const { data, error } = await supabase
    .from('estructuras_plan')
    .insert({
      nombre: input.nombre.trim(),
      tipo: input.tipo,
      template_id: input.template_id ?? null,
      definicion: (input.definicion ?? {}) as Json,
      actualizado_en: new Date().toISOString(),
      creado_por: userId,
    })
    .select(
      'id,nombre,tipo,template_id,excel_template_id,definicion,creado_en,actualizado_en',
    )
    .single()
  throwIfError(error)
  return data as Tables<'estructuras_plan'>
}

export async function estructuras_plan_update(
  id: string,
  input: {
    nombre?: string
    tipo?: Tables<'estructuras_plan'>['tipo']
    template_id?: string | null
    excel_template_id?: string | null
    definicion?: object
    autoridad_normativa?: string | null
    etiqueta_version?: string | null
    aplicable_desde?: string | null
    aplicable_hasta?: string | null
    referencia_normativa?: string | null
    propagationOperations?: EstructuraPropagationOperations
  },
): Promise<Tables<'estructuras_plan'>> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  if (
    input.definicion !== undefined &&
    input.nombre === undefined &&
    input.tipo === undefined &&
    input.template_id === undefined &&
    input.excel_template_id === undefined &&
    input.autoridad_normativa === undefined &&
    input.etiqueta_version === undefined &&
    input.aplicable_desde === undefined &&
    input.aplicable_hasta === undefined &&
    input.referencia_normativa === undefined
  ) {
    const { data, error } = await (supabase.rpc as any)(
      'actualizar_estructura_plan_definicion',
      {
        p_id: id,
        p_definicion: input.definicion as Json,
        p_operaciones: (input.propagationOperations ?? {}) as Json,
      },
    )

    throwIfError(error)
    return data as Tables<'estructuras_plan'>
  }

  const patch: TablesUpdate<'estructuras_plan'> = {
    actualizado_en: new Date().toISOString(),
    actualizado_por: userId,
  }
  if (input.nombre !== undefined) patch['nombre'] = input.nombre.trim()
  if (input.tipo !== undefined) patch['tipo'] = input.tipo
  if (input.template_id !== undefined) patch['template_id'] = input.template_id
  if (input.excel_template_id !== undefined)
    patch['excel_template_id'] = input.excel_template_id
  if (input.definicion !== undefined)
    patch['definicion'] = input.definicion as Json
  if (input.autoridad_normativa !== undefined)
    patch['autoridad_normativa'] = input.autoridad_normativa
  if (input.etiqueta_version !== undefined)
    patch['etiqueta_version'] = input.etiqueta_version
  if (input.aplicable_desde !== undefined)
    patch['aplicable_desde'] = input.aplicable_desde
  if (input.aplicable_hasta !== undefined)
    patch['aplicable_hasta'] = input.aplicable_hasta
  if (input.referencia_normativa !== undefined)
    patch['referencia_normativa'] = input.referencia_normativa

  const { data, error } = await supabase
    .from('estructuras_plan')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  throwIfError(error)
  return data as Tables<'estructuras_plan'>
}

export async function estructuras_asignatura_create(input: {
  nombre: string
  tipo?: Tables<'estructuras_asignatura'>['tipo']
  estructura_plan_id: string
  template_id?: string | null
  definicion?: object
}): Promise<Tables<'estructuras_asignatura'>> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)
  const { data, error } = await supabase
    .from('estructuras_asignatura')
    .insert({
      nombre: input.nombre.trim(),
      tipo: input.tipo ?? null,
      estructura_plan_id: input.estructura_plan_id,
      template_id: input.template_id ?? null,
      definicion: (input.definicion ?? {}) as Json,
      actualizado_en: new Date().toISOString(),
      creado_por: userId,
    })
    .select(
      'id,nombre,tipo,template_id,definicion,estructura_plan_id,creado_en,actualizado_en',
    )
    .single()
  throwIfError(error)
  return data as Tables<'estructuras_asignatura'>
}

export async function estructuras_asignatura_update(
  id: string,
  input: {
    nombre?: string
    tipo?: Tables<'estructuras_asignatura'>['tipo']
    estructura_plan_id?: string
    template_id?: string | null
    definicion?: object
    propagationOperations?: EstructuraPropagationOperations
  },
): Promise<Tables<'estructuras_asignatura'>> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  if (
    input.definicion !== undefined &&
    input.nombre === undefined &&
    input.tipo === undefined &&
    input.estructura_plan_id === undefined &&
    input.template_id === undefined
  ) {
    const { data, error } = await (supabase.rpc as any)(
      'actualizar_estructura_asignatura_definicion',
      {
        p_id: id,
        p_definicion: input.definicion as Json,
        p_operaciones: (input.propagationOperations ?? {}) as Json,
      },
    )

    throwIfError(error)
    return data as Tables<'estructuras_asignatura'>
  }

  const patch: TablesUpdate<'estructuras_asignatura'> = {
    actualizado_en: new Date().toISOString(),
    actualizado_por: userId,
  }
  if (input.nombre !== undefined) patch['nombre'] = input.nombre.trim()
  if (input.tipo !== undefined) patch['tipo'] = input.tipo
  if (input.estructura_plan_id !== undefined)
    patch['estructura_plan_id'] = input.estructura_plan_id
  if (input.template_id !== undefined) patch['template_id'] = input.template_id
  if (input.definicion !== undefined)
    patch['definicion'] = input.definicion as Json

  const { data, error } = await supabase
    .from('estructuras_asignatura')
    .update(patch)
    .eq('id', id)
    .select(
      'id,nombre,tipo,template_id,definicion,estructura_plan_id,creado_en,actualizado_en',
    )
    .single()
  throwIfError(error)
  return data as Tables<'estructuras_asignatura'>
}

export async function estructuras_plan_retire(
  id: string,
): Promise<'ELIMINADO' | 'ARCHIVADO'> {
  const { data, error } = await supabaseBrowser().rpc(
    'retirar_paquete_curricular',
    { p_estructura_id: id },
  )
  throwIfError(error)
  return requireData(data, 'No se pudo retirar el paquete curricular.') as
    | 'ELIMINADO'
    | 'ARCHIVADO'
}

export type AccionRetiroPaquete = 'ELIMINAR' | 'ARCHIVAR' | 'BLOQUEADO'

export async function estructuras_plan_retire_action(
  id: string,
): Promise<AccionRetiroPaquete> {
  const { data, error } = await supabaseBrowser().rpc(
    'evaluar_retiro_paquete_curricular',
    { p_estructura_id: id },
  )
  throwIfError(error)
  return requireData(
    data,
    'No se pudo evaluar el retiro del paquete.',
  ) as AccionRetiroPaquete
}

export async function estructuras_asignatura_delete(id: string): Promise<void> {
  const supabase = supabaseBrowser()
  const { error } = await supabase
    .from('estructuras_asignatura')
    .delete()
    .eq('id', id)
  throwIfError(error)
}

export async function paquetes_curriculares_create(input: {
  nombre: string
  etiquetaVersion: string
  autoridadNormativa?: string
}): Promise<Tables<'estructuras_plan'>> {
  const { data, error } = await supabaseBrowser().rpc(
    'crear_paquete_curricular',
    {
      p_nombre: input.nombre,
      p_etiqueta_version: input.etiquetaVersion,
      p_autoridad_normativa: input.autoridadNormativa ?? undefined,
    },
  )
  throwIfError(error)
  return requireData(data, 'No se pudo crear el paquete curricular.')
}

export async function paquetes_curriculares_create_version(input: {
  estructuraId: string
  etiquetaVersion: string
}): Promise<Tables<'estructuras_plan'>> {
  const { data, error } = await supabaseBrowser().rpc(
    'crear_version_paquete_curricular',
    {
      p_estructura_id: input.estructuraId,
      p_etiqueta_version: input.etiquetaVersion,
    },
  )
  throwIfError(error)
  return requireData(data, 'No se pudo crear la versión del paquete.')
}

export async function paquetes_curriculares_validate(
  estructuraId: string,
): Promise<{ valido: boolean; errores: Array<string> }> {
  const { data, error } = await supabaseBrowser().rpc(
    'validar_paquete_curricular',
    { p_estructura_id: estructuraId },
  )
  throwIfError(error)
  return requireData(data, 'No se pudo validar el paquete.') as {
    valido: boolean
    errores: Array<string>
  }
}

export async function paquetes_curriculares_publish(
  estructuraId: string,
): Promise<Tables<'estructuras_plan'>> {
  const { data, error } = await supabaseBrowser().rpc(
    'publicar_paquete_curricular',
    { p_estructura_id: estructuraId },
  )
  throwIfError(error)
  return requireData(data, 'No se pudo publicar el paquete.')
}

export async function estructura_asignatura_parent_id(
  estructuraAsignaturaId: string,
): Promise<string | null> {
  const { data, error } = await supabaseBrowser()
    .from('estructuras_asignatura')
    .select('estructura_plan_id')
    .eq('id', estructuraAsignaturaId)
    .maybeSingle()
  throwIfError(error)
  return data?.estructura_plan_id ?? null
}

export async function estados_plan_list(): Promise<
  Array<Tables<'estados_plan'>>
> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('estados_plan')
    .select('id,clave,etiqueta,orden,es_final,es_campo_editable,color')
    .order('orden', { ascending: true })

  throwIfError(error)
  return data ?? []
}
