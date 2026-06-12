import { supabaseBrowser } from '../supabase/client'
import { throwIfError, getUserIdOrThrow, requireData } from './_helpers'
import type { Notificacion, UUID } from '../types/domain'

export async function notificaciones_mias_list(): Promise<Notificacion[]> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  const { data, error } = await supabase
    .from('notificaciones')
    .select('id,usuario_id,tipo,payload,leida,creado_en,leida_en')
    .eq('usuario_id', userId as UUID)
    .order('creado_en', { ascending: false })

  throwIfError(error)
  return data ?? []
}

export async function notificaciones_marcar_leida(
  notificacionId: UUID,
): Promise<Notificacion> {
  const supabase = supabaseBrowser()

  const { data, error } = await supabase
    .from('notificaciones')
    .update({ leida: true, leida_en: new Date().toISOString() })
    .eq('id', notificacionId)
    .select('id,usuario_id,tipo,payload,leida,creado_en,leida_en')
    .single()

  throwIfError(error)
  return requireData(data, 'No se pudo marcar notificación.')
}
