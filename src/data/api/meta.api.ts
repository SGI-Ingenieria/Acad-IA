import { supabaseBrowser } from '../supabase/client'

import { throwIfError } from './_helpers'

import type { Tables } from '@/types/supabase'

export async function facultades_list(): Promise<Array<Tables<'facultades'>>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('facultades')
    .select(
      'id,nombre,nombre_corto,color,icono,activa,creado_en,actualizado_en',
    )
    .order('nombre', { ascending: true })

  throwIfError(error)
  return data ?? []
}

export async function facultades_create(input: {
  nombre: string
  nombre_corto?: string | null
  color?: string | null
  icono?: string | null
}): Promise<Tables<'facultades'>> {
  const supabase = supabaseBrowser()

  const { data, error } = await supabase
    .from('facultades')
    .insert({
      nombre: input.nombre.trim(),
      nombre_corto: input.nombre_corto?.trim() || null,
      color: input.color?.trim() || null,
      icono: input.icono?.trim() || null,
      activa: true,
      actualizado_en: new Date().toISOString(),
    })
    .select(
      'id,nombre,nombre_corto,color,icono,activa,creado_en,actualizado_en',
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
    color?: string | null
    icono?: string | null
  },
): Promise<Tables<'facultades'>> {
  const supabase = supabaseBrowser()

  const { data, error } = await supabase
    .from('facultades')
    .update({
      nombre: input.nombre.trim(),
      nombre_corto: input.nombre_corto?.trim() || null,
      color: input.color?.trim() || null,
      icono: input.icono?.trim() || null,
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', facultadId)
    .select(
      'id,nombre,nombre_corto,color,icono,activa,creado_en,actualizado_en',
    )
    .single()

  throwIfError(error)
  return data as Tables<'facultades'>
}

export async function facultades_archive(facultadId: string): Promise<{
  id: string
}> {
  const supabase = supabaseBrowser()

  const now = new Date().toISOString()

  const { error: facultadError } = await supabase
    .from('facultades')
    .update({ activa: false, actualizado_en: now })
    .eq('id', facultadId)

  throwIfError(facultadError)

  const { error: carrerasError } = await supabase
    .from('carreras')
    .update({ activa: false, actualizado_en: now })
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
      'id,facultad_id,nombre,nombre_corto,clave_sep,activa,nivel,creado_en,actualizado_en, facultades(id,nombre,nombre_corto,color,icono)',
    )
    .order('nombre', { ascending: true })

  if (params?.facultadId) q = q.eq('facultad_id', params.facultadId)

  const { data, error } = await q
  throwIfError(error)
  return data ?? []
}

export async function carreras_create(input: {
  facultad_id: string
  nombre: string
  nombre_corto?: string | null
  clave_sep?: string | null
  nivel?: Tables<'carreras'>['nivel']
}): Promise<Tables<'carreras'>> {
  const supabase = supabaseBrowser()

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
    })
    .select(
      'id,facultad_id,nombre,nombre_corto,clave_sep,activa,nivel,creado_en,actualizado_en, facultades(id,nombre,nombre_corto,color,icono)',
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

  const { data, error } = await supabase
    .from('carreras')
    .update({
      facultad_id: input.facultad_id,
      nombre: input.nombre.trim(),
      nombre_corto: input.nombre_corto?.trim() || null,
      clave_sep: input.clave_sep?.trim() || null,
      nivel: input.nivel ?? 'Otro',
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', carreraId)
    .select(
      'id,facultad_id,nombre,nombre_corto,clave_sep,activa,nivel,creado_en,actualizado_en, facultades(id,nombre,nombre_corto,color,icono)',
    )
    .single()

  throwIfError(error)
  return data as Tables<'carreras'>
}

export async function carreras_archive(
  carreraId: string,
): Promise<{ id: string }> {
  const supabase = supabaseBrowser()
  const { error } = await supabase
    .from('carreras')
    .update({ activa: false, actualizado_en: new Date().toISOString() })
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
    .select('id,nombre,tipo,template_id,definicion,creado_en,actualizado_en')
    .order('nombre', { ascending: true })

  throwIfError(error)
  return data ?? []
}

export async function estructuras_asignatura_list(): Promise<
  Array<Tables<'estructuras_asignatura'>>
> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('estructuras_asignatura')
    .select('id,nombre,tipo,template_id,definicion,creado_en,actualizado_en')
    .order('nombre', { ascending: true })

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
  const { data, error } = await supabase
    .from('estructuras_plan')
    .insert({
      nombre: input.nombre.trim(),
      tipo: input.tipo,
      template_id: input.template_id ?? null,
      definicion: input.definicion ?? {},
      actualizado_en: new Date().toISOString(),
    })
    .select('id,nombre,tipo,template_id,definicion,creado_en,actualizado_en')
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
    definicion?: object
  },
): Promise<Tables<'estructuras_plan'>> {
  const supabase = supabaseBrowser()
  const patch: Record<string, unknown> = {
    actualizado_en: new Date().toISOString(),
  }
  if (input.nombre !== undefined) patch['nombre'] = input.nombre.trim()
  if (input.tipo !== undefined) patch['tipo'] = input.tipo
  if (input.template_id !== undefined) patch['template_id'] = input.template_id
  if (input.definicion !== undefined) patch['definicion'] = input.definicion

  const { data, error } = await supabase
    .from('estructuras_plan')
    .update(patch)
    .eq('id', id)
    .select('id,nombre,tipo,template_id,definicion,creado_en,actualizado_en')
    .single()
  throwIfError(error)
  return data as Tables<'estructuras_plan'>
}

export async function estructuras_asignatura_create(input: {
  nombre: string
  tipo?: Tables<'estructuras_asignatura'>['tipo']
  template_id?: string | null
  definicion?: object
}): Promise<Tables<'estructuras_asignatura'>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('estructuras_asignatura')
    .insert({
      nombre: input.nombre.trim(),
      tipo: input.tipo ?? null,
      template_id: input.template_id ?? null,
      definicion: input.definicion ?? {},
      actualizado_en: new Date().toISOString(),
    })
    .select('id,nombre,tipo,template_id,definicion,creado_en,actualizado_en')
    .single()
  throwIfError(error)
  return data as Tables<'estructuras_asignatura'>
}

export async function estructuras_asignatura_update(
  id: string,
  input: {
    nombre?: string
    tipo?: Tables<'estructuras_asignatura'>['tipo']
    template_id?: string | null
    definicion?: object
  },
): Promise<Tables<'estructuras_asignatura'>> {
  const supabase = supabaseBrowser()
  const patch: Record<string, unknown> = {
    actualizado_en: new Date().toISOString(),
  }
  if (input.nombre !== undefined) patch['nombre'] = input.nombre.trim()
  if (input.tipo !== undefined) patch['tipo'] = input.tipo
  if (input.template_id !== undefined) patch['template_id'] = input.template_id
  if (input.definicion !== undefined) patch['definicion'] = input.definicion

  const { data, error } = await supabase
    .from('estructuras_asignatura')
    .update(patch)
    .eq('id', id)
    .select('id,nombre,tipo,template_id,definicion,creado_en,actualizado_en')
    .single()
  throwIfError(error)
  return data as Tables<'estructuras_asignatura'>
}

export async function estructuras_plan_delete(id: string): Promise<void> {
  const supabase = supabaseBrowser()
  const { error } = await supabase.from('estructuras_plan').delete().eq('id', id)
  throwIfError(error)
}

export async function estructuras_asignatura_delete(id: string): Promise<void> {
  const supabase = supabaseBrowser()
  const { error } = await supabase.from('estructuras_asignatura').delete().eq('id', id)
  throwIfError(error)
}

export async function estados_plan_list(): Promise<
  Array<Tables<'estados_plan'>>
> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('estados_plan')
    .select('id,clave,etiqueta,orden,es_final')
    .order('orden', { ascending: true })

  throwIfError(error)
  return data ?? []
}
