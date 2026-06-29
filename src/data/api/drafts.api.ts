import { supabaseBrowser } from '../supabase/client'

import { getUserIdOrThrow, requireData, throwIfError } from './_helpers'

import type { Tables } from '@/types/supabase'

export type DraftEntity = 'plan' | 'asignatura'
export type BorradorCampo = Tables<'borradores_campo'>

export type BorradorCampoUpsertInput = {
  entidad: DraftEntity
  entidadId: string
  clave: string
  contenidoHtml: string
}

const SELECT_FIELDS =
  'id,entidad,entidad_id,plan_id,clave,contenido_html,creado_por,actualizado_por,creado_en,actualizado_en'

export async function borradores_list_for_entity(
  entidad: DraftEntity,
  entidadId: string,
): Promise<Array<BorradorCampo>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('borradores_campo')
    .select(SELECT_FIELDS)
    .eq('entidad', entidad)
    .eq('entidad_id', entidadId)
    .order('actualizado_en', { ascending: false })

  throwIfError(error)
  return data ?? []
}

export async function borradores_upsert(
  input: BorradorCampoUpsertInput,
): Promise<BorradorCampo> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('borradores_campo')
    .upsert(
      {
        entidad: input.entidad,
        entidad_id: input.entidadId,
        clave: input.clave,
        contenido_html: input.contenidoHtml,
        plan_id: input.entidadId,
        actualizado_por: userId,
        actualizado_en: now,
        creado_por: userId,
      },
      { onConflict: 'entidad,entidad_id,clave' },
    )
    .select(SELECT_FIELDS)
    .single()

  throwIfError(error)
  return requireData(data, 'No se pudo guardar el borrador.')
}

export async function borradores_delete(
  entidad: DraftEntity,
  entidadId: string,
  clave: string,
): Promise<{ entidad: DraftEntity; entidadId: string; clave: string }> {
  const supabase = supabaseBrowser()
  const { error } = await supabase
    .from('borradores_campo')
    .delete()
    .eq('entidad', entidad)
    .eq('entidad_id', entidadId)
    .eq('clave', clave)

  throwIfError(error)
  return { entidad, entidadId, clave }
}
