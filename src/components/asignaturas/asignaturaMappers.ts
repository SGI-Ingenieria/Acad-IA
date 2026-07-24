import type { Asignatura } from '@/types/plan'
import type { Tables } from '@/types/supabase'

export const mapAsignaturaRow = (asig: Tables<'asignaturas'>): Asignatura => ({
  id: asig.id,
  clave: asig.codigo ?? '',
  nombre: asig.nombre,
  creditos: asig.creditos ?? 0,
  ciclo: asig.numero_ciclo ?? null,
  lineaCurricularId: asig.linea_plan_id ?? null,
  tipo: asig.tipo,
  estado: asig.estado,
  hd: asig.horas_academicas ?? 0,
  hi: asig.horas_independientes ?? 0,
  prerrequisito_asignatura_id: asig.prerrequisito_asignatura_id ?? null,
  actualizadoEn: asig.actualizado_en,
})

export const mapAsignaturas = (
  asigApi: Array<Tables<'asignaturas'>> = [],
): Array<Asignatura> => {
  return asigApi.map(mapAsignaturaRow)
}
