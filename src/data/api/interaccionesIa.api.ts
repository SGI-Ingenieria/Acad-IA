import { supabaseBrowser } from '../supabase/client'

export type TipoInteraccionIa = 'GENERAR' | 'MEJORAR_SECCION' | 'CHAT' | 'OTRA'

export type InteraccionRecienteArchivo = {
  id: string
  openai_file_id: string
  path: string
  size: number | null
}

export type InteraccionRecienteRepositorio = {
  id: string
  nombre: string
  openai_vector_store_id: string
}

export type InteraccionReciente = {
  id: string
  tipo: TipoInteraccionIa
  creado_en: string
  conversacion_id: string | null
  plan_estudio: {
    id: string
    nombre: string | null
    nombre_propuesto: string | null
    nombre_display: string | null
  } | null
  asignatura: {
    id: string
    nombre: string | null
    plan_estudio_id: string | null
  } | null
  archivos: Array<InteraccionRecienteArchivo>
  repositorios: Array<InteraccionRecienteRepositorio>
}

/**
 * Lista las interacciones IA recientes del usuario actual con los archivos y
 * repositorios resueltos a sus metadatos para la página de Recientes.
 */
export async function listInteraccionesRecientes(
  limit = 12,
): Promise<Array<InteraccionReciente>> {
  const supabase = supabaseBrowser()

  // Sesión local (sin round-trip de red): el id solo filtra la consulta y RLS
  // aplica la seguridad real en el servidor.
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user.id
  if (!userId) return []

  const { data, error } = await supabase
    .from('interacciones_ia')
    .select(
      `id, tipo, creado_en, conversacion_id,
       ids_archivos, ids_vector_store,
       plan_estudio:planes_estudio(id, nombre, nombre_propuesto, nombre_display),
       asignatura:asignaturas(id, nombre, plan_estudio_id)`,
    )
    .eq('usuario_id', userId)
    .order('creado_en', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = data as Array<any>

  const allOpenaiFileIds = Array.from(
    new Set(
      rows.flatMap((r) =>
        Array.isArray(r.ids_archivos)
          ? r.ids_archivos.filter(
              (x: unknown): x is string => typeof x === 'string' && !!x,
            )
          : [],
      ),
    ),
  )

  const allVectorStoreIds = Array.from(
    new Set(
      rows.flatMap((r) =>
        Array.isArray(r.ids_vector_store)
          ? r.ids_vector_store.filter(
              (x: unknown): x is string => typeof x === 'string' && !!x,
            )
          : [],
      ),
    ),
  )

  const archivosByOpenaiId = new Map<string, InteraccionRecienteArchivo>()
  if (allOpenaiFileIds.length > 0) {
    const { data: archivos } = await supabase
      .from('archivos')
      .select('id,openai_file_id,path,size')
      .in('openai_file_id', allOpenaiFileIds)
    for (const a of archivos ?? []) {
      const openaiId = a.openai_file_id ? String(a.openai_file_id) : ''
      if (!openaiId) continue
      archivosByOpenaiId.set(openaiId, {
        id: String(a.id),
        openai_file_id: openaiId,
        path: String(a.path),
        size: typeof a.size === 'number' ? a.size : null,
      })
    }
  }

  const repositoriosByVectorStoreId = new Map<
    string,
    InteraccionRecienteRepositorio
  >()
  if (allVectorStoreIds.length > 0) {
    const { data: repos } = await supabase
      .from('repositorios')
      .select('id,nombre,openai_vector_store_id')
      .in('openai_vector_store_id', allVectorStoreIds)
    for (const r of repos ?? []) {
      const vsId = r.openai_vector_store_id
        ? String(r.openai_vector_store_id)
        : ''
      if (!vsId) continue
      repositoriosByVectorStoreId.set(vsId, {
        id: String(r.id),
        nombre: r.nombre ? String(r.nombre) : 'Repositorio',
        openai_vector_store_id: vsId,
      })
    }
  }

  return rows.map((r) => {
    const fileIds = Array.isArray(r.ids_archivos)
      ? r.ids_archivos.filter(
          (x: unknown): x is string => typeof x === 'string' && !!x,
        )
      : []
    const vsIds = Array.isArray(r.ids_vector_store)
      ? r.ids_vector_store.filter(
          (x: unknown): x is string => typeof x === 'string' && !!x,
        )
      : []

    const plan = Array.isArray(r.plan_estudio)
      ? r.plan_estudio[0]
      : r.plan_estudio
    const asig = Array.isArray(r.asignatura) ? r.asignatura[0] : r.asignatura

    return {
      id: String(r.id),
      tipo: r.tipo as TipoInteraccionIa,
      creado_en: String(r.creado_en),
      conversacion_id: r.conversacion_id ? String(r.conversacion_id) : null,
      plan_estudio: plan
        ? {
            id: String(plan.id),
            nombre: plan.nombre ?? null,
            nombre_propuesto: plan.nombre_propuesto ?? null,
            nombre_display: plan.nombre_display ?? null,
          }
        : null,
      asignatura: asig
        ? {
            id: String(asig.id),
            nombre: asig.nombre ?? null,
            plan_estudio_id: asig.plan_estudio_id
              ? String(asig.plan_estudio_id)
              : null,
          }
        : null,
      archivos: fileIds
        .map((id: string) => archivosByOpenaiId.get(id))
        .filter(
          (
            x: InteraccionRecienteArchivo | undefined,
          ): x is InteraccionRecienteArchivo => Boolean(x),
        ),
      repositorios: vsIds
        .map((id: string) => repositoriosByVectorStoreId.get(id))
        .filter(
          (
            x: InteraccionRecienteRepositorio | undefined,
          ): x is InteraccionRecienteRepositorio => Boolean(x),
        ),
    }
  })
}
