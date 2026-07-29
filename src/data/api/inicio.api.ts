import { throwIfError } from './_helpers'

import type { PostgrestError } from '@supabase/supabase-js'

import { supabaseBrowser } from '@/data/supabase/client'

export type ContextoMesaTrabajo = {
  rolClave: string
  facultadId?: string | null
  carreraId?: string | null
}

export type AccionMesaTrabajo = {
  id: string
  tipo: 'TAREA_REVISION'
  planId: string
  titulo: string
  detalle: string | null
  fechaLimite: string | null
}

export type PlanRecienteMesa = {
  id: string
  nombre_display: string
  actualizado_en: string
  fase_diseno: 'FUNDAMENTOS' | 'BLOQUES' | 'MAPA'
  fecha_inicio_imparticion: string | null
  carrera_id: string
  carrera_nombre: string
  nivel: string | null
  facultad_id: string
  facultad_nombre: string
  estado_clave: string | null
  estado_etiqueta: string | null
  comentarios_pendientes: number
  vigencia_fin: string | null
}

export type FacultadMesa = {
  id: string
  nombre: string
  planes: number
  comentariosPendientes: number
}

export type AvisoInstitucional = {
  id: string
  titulo: string
  cuerpo: string
  accionEtiqueta: string | null
  accionRuta: string | null
}

export type MesaTrabajoInicio = {
  contexto: {
    rolClave: string | null
    facultadId: string | null
    carreraId: string | null
  }
  resumen: {
    planes: number
    tareasPendientes: number
    comentariosPendientes: number
    vigenciasProximas: number
  }
  requiereAtencion: Array<AccionMesaTrabajo>
  planesRecientes: Array<PlanRecienteMesa>
  facultades: Array<FacultadMesa>
  avisos: Array<AvisoInstitucional>
  saludOperativa: {
    estructurasSinVigencia: number
    estructurasSinPlantilla: number
  } | null
}

type RpcResult = PromiseLike<{
  data: unknown
  error: PostgrestError | null
}>

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => RpcResult
}

export async function inicio_mesa_trabajo(
  contexto: ContextoMesaTrabajo,
): Promise<MesaTrabajoInicio> {
  // Esta RPC se incorpora en la misma migración que la mesa. El pequeño
  // adaptador desaparece al regenerar los tipos locales de Supabase.
  // `rpc` usa el cliente como receptor para acceder a PostgREST. Mantener la
  // llamada como método evita perder `this` mientras se regeneran los tipos.
  const supabase = supabaseBrowser() as unknown as RpcClient
  const { data, error } = await supabase.rpc('inicio_mesa_trabajo', {
    p_rol_clave: contexto.rolClave,
    p_facultad_id: contexto.facultadId ?? null,
    p_carrera_id: contexto.carreraId ?? null,
  })
  throwIfError(error)
  return data as MesaTrabajoInicio
}
