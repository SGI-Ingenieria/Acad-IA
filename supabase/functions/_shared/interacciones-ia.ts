import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from './database.types.ts'

type Tipo = Database['public']['Enums']['tipo_interaccion_ia']

export type RegistrarInteraccionInput = {
  usuarioId: string
  tipo: Tipo
  planEstudioId?: string | null
  asignaturaId?: string | null
  conversacionId?: string | null
  modelo?: string | null
  openaiFileIds?: Array<string>
  vectorStoreIds?: Array<string>
}

/**
 * Registra una interacción IA para alimentar la página de Recientes.
 * Es best-effort: si falla, se loguea y se ignora (no rompe el flujo principal).
 */
export async function registrarInteraccionIA(
  supabase: SupabaseClient<Database>,
  input: RegistrarInteraccionInput,
): Promise<void> {
  try {
    const openaiFileIds = (input.openaiFileIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    )
    const vectorStoreIds = (input.vectorStoreIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    )

    let rutasStorage: Array<string> = []
    if (openaiFileIds.length > 0) {
      const { data: archivos } = await supabase
        .from('archivos')
        .select('path,openai_file_id')
        .in('openai_file_id', openaiFileIds)
      rutasStorage = (archivos ?? [])
        .map((a) => (a.path ? String(a.path) : ''))
        .filter(Boolean)
    }

    const { error } = await supabase.from('interacciones_ia').insert({
      usuario_id: input.usuarioId,
      tipo: input.tipo,
      plan_estudio_id: input.planEstudioId ?? null,
      asignatura_id: input.asignaturaId ?? null,
      conversacion_id: input.conversacionId ?? null,
      modelo: input.modelo ?? null,
      aceptada: true,
      ids_archivos: openaiFileIds,
      ids_vector_store: vectorStoreIds,
      rutas_storage: rutasStorage,
    })

    if (error) {
      console.warn('[registrarInteraccionIA] insert failed', error.message)
    }
  } catch (e) {
    console.warn(
      '[registrarInteraccionIA] unexpected error',
      e instanceof Error ? e.message : e,
    )
  }
}
