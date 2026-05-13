import { supabaseBrowser } from '../supabase/client'

import { throwIfError } from './_helpers'

import type { Tables } from '@/types/supabase'

export async function facultades_list(): Promise<Array<Tables<'facultades'>>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('facultades')
    .select('id,nombre,nombre_corto,color,icono,creado_en,actualizado_en')
    .order('nombre', { ascending: true })

  throwIfError(error)
  return data ?? []
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

export async function estructuras_plan_list(params?: {
  nivel?: string | null
}): Promise<Array<Tables<'estructuras_plan'>>> {
  const supabase = supabaseBrowser()

  // Nota: en tu DDL no hay "nivel" en estructuras_plan; si luego lo agregas, filtra aquí.
  const { data, error } = await supabase
    .from('estructuras_plan')
    .select('id,nombre,tipo,version,definicion')
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
    .select('id,nombre,version,definicion')
    .order('nombre', { ascending: true })

  throwIfError(error)
  return data ?? []
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
