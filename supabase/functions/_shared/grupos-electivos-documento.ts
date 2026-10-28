import type { Tables } from './database.types.ts'

type FilaCurricular = Pick<
  Tables<'asignaturas'>,
  | 'id'
  | 'codigo'
  | 'nombre'
  | 'tipo'
  | 'datos'
  | 'numero_ciclo'
  | 'linea_plan_id'
  | 'creditos'
  | 'horas_academicas'
  | 'horas_independientes'
  | 'prerrequisito_asignatura_id'
  | 'grupo_electivo_id'
> & { linea: { nombre: string } | null }

/** Cada grupo ocupa una fila; todas las alternativas siguen identificadas en ella. */
export function filasCurricularesConElectivas(
  asignaturas: FilaCurricular[],
  grupos: Tables<'grupos_electivos_plan'>[],
  lineas: Pick<Tables<'lineas_plan'>, 'id' | 'nombre'>[],
): FilaCurricular[] {
  return [
    ...asignaturas.filter((a) => !a.grupo_electivo_id),
    ...grupos.map((g, index): FilaCurricular => {
      const alternativas = asignaturas.filter(
        (a) => a.grupo_electivo_id === g.id,
      )
      const carga = alternativas[0]
      return {
        id: g.id,
        codigo: `ELECTIVA-${index + 1}`,
        nombre:
          g.nombre +
          (alternativas.length
            ? '\nAlternativas: ' +
              alternativas
                .map(
                  (a) =>
                    `${a.codigo ?? ''} ${a.nombre} (${a.horas_academicas ?? 0} HD + ${a.horas_independientes ?? 0} HI)`,
                )
                .join(' | ')
            : ' · Pendiente'),
        tipo: 'OPTATIVA',
        datos: {},
        numero_ciclo: g.numero_ciclo,
        linea_plan_id: g.linea_plan_id,
        creditos: carga?.creditos ?? 0,
        horas_academicas: carga?.horas_academicas ?? 0,
        horas_independientes: carga?.horas_independientes ?? 0,
        prerrequisito_asignatura_id: g.prerrequisito_grupo_id,
        grupo_electivo_id: g.id,
        linea: lineas.find((l) => l.id === g.linea_plan_id) ?? null,
      }
    }),
  ].sort((a, b) => (a.numero_ciclo ?? 0) - (b.numero_ciclo ?? 0))
}
