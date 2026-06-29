import { supabaseBrowser } from '../supabase/client'

import { getUserIdOrThrow, throwIfError } from './_helpers'

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

export async function carreras_list(params?: {
  facultadId?: string | null
}): Promise<Array<Tables<'carreras'>>> {
  const supabase = supabaseBrowser()

  let q = supabase
    .from('carreras')
    .select(
      'id,facultad_id,nombre,nombre_corto,clave_sep,activa,nivel,creado_en,creado_por,actualizado_en,actualizado_por, facultades(id,nombre,nombre_corto,prefijo,color,icono)',
    )
    .order('nombre', { ascending: true })

  if (params?.facultadId) q = q.eq('facultad_id', params.facultadId)

  const { data, error } = await q
  throwIfError(error)
  return data as Array<Tables<'carreras'>>
}

export async function carreras_create(input: {
  facultad_id: string
  nombre: string
  nombre_corto?: string | null
  clave_sep?: string | null
  nivel?: Tables<'carreras'>['nivel']
}): Promise<Tables<'carreras'>> {
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
      activa: true,
      actualizado_en: new Date().toISOString(),
      creado_por: userId,
    })
    .select(
      'id,facultad_id,nombre,nombre_corto,clave_sep,activa,nivel,creado_en,actualizado_en,creado_por,actualizado_por',
    )
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
  },
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
      actualizado_en: new Date().toISOString(),
      actualizado_por: userId,
    })
    .eq('id', carreraId)
    .select(
      'id,facultad_id,nombre,nombre_corto,clave_sep,activa,nivel,creado_en,actualizado_en, facultades(id,nombre,nombre_corto,prefijo,color,icono)',
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
    .select(
      'id,nombre,tipo,template_id,excel_template_id,definicion,creado_en,creado_por,actualizado_en,actualizado_por',
    )
    .order('nombre', { ascending: true })

  throwIfError(error)
  return data ?? []
}

export async function estructuras_asignatura_list(params?: {
  estructuraPlanId?: string | null
}): Promise<
  Array<Tables<'estructuras_asignatura'>>
> {
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
    input.excel_template_id === undefined
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

  const { data, error } = await supabase
    .from('estructuras_plan')
    .update(patch)
    .eq('id', id)
    .select(
      'id,nombre,tipo,template_id,excel_template_id,definicion,creado_en,actualizado_en',
    )
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

export async function estructuras_plan_delete(id: string): Promise<void> {
  const supabase = supabaseBrowser()
  const { error } = await supabase
    .from('estructuras_plan')
    .delete()
    .eq('id', id)
  throwIfError(error)
}

export async function estructuras_asignatura_delete(id: string): Promise<void> {
  const supabase = supabaseBrowser()
  const { error } = await supabase
    .from('estructuras_asignatura')
    .delete()
    .eq('id', id)
  throwIfError(error)
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
