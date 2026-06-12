import { supabaseBrowser } from '../supabase/client'
import { throwIfError, getUserIdOrThrow, requireData } from './_helpers'
import type { TareaRevision, UUID } from '../types/domain'

export async function tareas_mias_list(): Promise<TareaRevision[]> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  const { data, error } = await supabase
    .from('tareas_revision')
    .select(
      'id,plan_estudio_id,asignado_a,rol_id,estado_id,estatus,fecha_limite,creado_en,completado_en',
    )
    .eq('asignado_a', userId as UUID)
    .order('creado_en', { ascending: false })

  throwIfError(error)
  return data ?? []
}

export async function tareas_marcar_completada(
  tareaId: UUID,
): Promise<TareaRevision> {
  const supabase = supabaseBrowser()

  const { data, error } = await supabase
    .from('tareas_revision')
    .update({ estatus: 'COMPLETADA', completado_en: new Date().toISOString() })
    .eq('id', tareaId)
    .select(
      'id,plan_estudio_id,asignado_a,rol_id,estado_id,estatus,fecha_limite,creado_en,completado_en',
    )
    .single()

  throwIfError(error)
  return requireData(data, 'No se pudo marcar tarea.')
}
