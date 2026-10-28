import {
  supabaseBrowser,
  supabaseBrowserParaEscritura,
} from '../supabase/client'

import { requireData, throwIfError } from './_helpers'

import type { Json, Tables } from '@/types/supabase'

export const EDGE = {} as const
export type GrupoElectivoPlan = Tables<'grupos_electivos_plan'>
export type OperacionGrupoElectivo = {
  planId: string
  grupoId: string
  operacion:
    'crear' | 'editar' | 'mover' | 'incorporar' | 'retirar' | 'eliminar'
  datos: {
    revision?: number
    nombre?: string
    numero_ciclo?: number
    linea_plan_id?: string
    prerrequisito_grupo_id?: string | null
    asignatura_id?: string
    grupo_origen_esperado?: string | null
    relaciones_esperadas?: Array<{
      id: string
      prerrequisito_asignatura_id: string | null
    }>
    confirmar_retiro_relaciones?: boolean
  }
  adminOverrideReason?: string | null
}

export async function gruposElectivosListar(
  planId: string,
): Promise<Array<GrupoElectivoPlan>> {
  const { data, error } = await supabaseBrowser()
    .from('grupos_electivos_plan')
    .select('*')
    .eq('plan_estudio_id', planId)
    .order('orden')
    .order('id')
  throwIfError(error)
  return data ?? []
}

export async function gruposElectivosGestionar(
  input: OperacionGrupoElectivo,
): Promise<string> {
  const { data, error } = await supabaseBrowserParaEscritura(
    input.adminOverrideReason,
  ).rpc('gestionar_grupo_electivo_plan', {
    p_plan_id: input.planId,
    p_operacion: input.operacion,
    p_grupo_id: input.grupoId,
    p_datos: input.datos as Json,
  })
  throwIfError(error)
  return requireData(data)
}
