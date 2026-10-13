import { supabaseBrowser } from '../supabase/client'
import {
  configuracionAreaComunSchema,
  contextoAreaComunSchema,
} from '../types/areaComun'

import { ApiError, requireData, throwIfError } from './_helpers'

import type {
  ContextoAreaComun,
  DistribucionAreaComun,
} from '../types/areaComun'
import type { Json } from '@/types/supabase'

export const EDGE = {} as const

export async function areaComunContexto(
  planId: string,
): Promise<ContextoAreaComun> {
  const { data, error } = await supabaseBrowser().rpc('area_comun_contexto', {
    p_plan_id: planId,
  })
  throwIfError(error)
  const parsed = contextoAreaComunSchema.safeParse(requireData(data))
  if (!parsed.success)
    throw new ApiError(
      'La configuración de Área común no es válida.',
      'AREA_COMUN_CONTRATO',
      parsed.error,
    )
  return parsed.data
}

export async function areaComunIndicadores(asignaturaIds: Array<string>) {
  if (asignaturaIds.length === 0)
    return { bibliografia: new Set<string>(), responsables: new Set<string>() }

  const supabase = supabaseBrowser()
  const [bibliografia, responsables] = await Promise.all([
    supabase
      .from('bibliografia_asignatura')
      .select('asignatura_id')
      .in('asignatura_id', asignaturaIds),
    supabase
      .from('responsables_asignatura')
      .select('asignatura_id')
      .in('asignatura_id', asignaturaIds),
  ])
  throwIfError(bibliografia.error)
  throwIfError(responsables.error)
  return {
    bibliografia: new Set(
      (bibliografia.data ?? []).map((r) => r.asignatura_id),
    ),
    responsables: new Set(
      (responsables.data ?? []).map((r) => r.asignatura_id),
    ),
  }
}

export async function areaComunGuardarConfiguracion(input: {
  planId: string
  revision: number
  distribuciones: Array<DistribucionAreaComun>
}) {
  const parsed = configuracionAreaComunSchema.safeParse(input.distribuciones)
  if (!parsed.success)
    throw new ApiError(
      parsed.error.issues[0]?.message ?? 'Configuración inválida.',
      'AREA_COMUN_VALIDACION',
    )
  const { data, error } = await supabaseBrowser().rpc(
    'area_comun_guardar_configuracion',
    {
      p_plan_id: input.planId,
      p_revision: input.revision,
      p_distribuciones: parsed.data as Json,
    },
  )
  throwIfError(error)
  return requireData(data)
}

export async function areaComunPublicar(input: {
  planId: string
  revision: number
}) {
  const { data, error } = await supabaseBrowser().rpc('area_comun_publicar', {
    p_plan_id: input.planId,
    p_revision: input.revision,
  })
  throwIfError(error)
  return requireData(data)
}

export async function areaComunIncorporar(input: {
  planId: string
  electivas: Record<string, string>
  publicacionId: string
}) {
  const { data, error } = await supabaseBrowser().rpc('area_comun_incorporar', {
    p_plan_id: input.planId,
    p_electivas: input.electivas,
    p_publicacion_id: input.publicacionId,
  })
  throwIfError(error)
  return requireData(data)
}

export async function areaComunRetirar(planId: string) {
  const { error } = await supabaseBrowser().rpc('area_comun_retirar', {
    p_plan_id: planId,
  })
  throwIfError(error)
}
