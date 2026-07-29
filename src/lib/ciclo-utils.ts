import type { TipoCiclo } from '@/data/types/domain'

/**
 * Nombre singular del tipo de ciclo de un plan, p. ej. "Semestre".
 * Cuando el tipo es "Otro" (o no está definido) se usa el término genérico "Ciclo".
 */
export function nombreTipoCiclo(
  tipoCiclo: TipoCiclo | null | undefined,
): string {
  if (!tipoCiclo || tipoCiclo === 'Otro') return 'Ciclo'
  return tipoCiclo
}

/**
 * Etiqueta de un ciclo concreto según el tipo del plan, p. ej. "Semestre 1"
 * o "Ciclo 3" (cuando el tipo es "Otro").
 */
export function formatCiclo(
  tipoCiclo: TipoCiclo | null | undefined,
  numeroCiclo: number | null | undefined,
): string {
  return `${nombreTipoCiclo(tipoCiclo)} ${numeroCiclo}`
}

/**
 * Los ciclos contados en palabras, p. ej. "semestres", "cuatrimestre" o
 * "ciclos". «Otro» se dice "ciclo": su nombre interno no significa nada para
 * quien lee, y "5 otros" no es español.
 */
export function pluralizarTipoCiclo(
  tipoCiclo: TipoCiclo | '' | null | undefined,
  cantidad: number | null | undefined,
): string {
  const normalizado = (tipoCiclo ?? '').trim().toLocaleLowerCase('es-MX')
  const singular =
    normalizado === 'otro' || !normalizado ? 'ciclo' : normalizado
  return cantidad === 1 ? singular : `${singular}s`
}

/**
 * Etiqueta para una asignatura sin ciclo asignado, p. ej. "Sin semestre asignado".
 */
export function sinCicloLabel(tipoCiclo: TipoCiclo | null | undefined): string {
  return `Sin ${nombreTipoCiclo(tipoCiclo).toLowerCase()} asignado`
}

/**
 * Un ciclo de tipo «Otro» no dice cuánto dura: «Semestre» o «Cuatrimestre»
 * traen su duración en el nombre, pero un ciclo con nombre propio hay que
 * medirlo. Sin esa medida no se puede calcular la carga horaria del plan ni
 * compararlo con otro, así que se pide donde se define la estructura.
 */
export function requiereSemanasPorCiclo(
  tipoCiclo: TipoCiclo | '' | null | undefined,
): boolean {
  return tipoCiclo === 'Otro'
}

/**
 * Convención institucional por nivel. Es el último recurso: sólo se aplica a
 * las carreras que todavía no declaran su propia estructura, y por eso el
 * asistente distingue visiblemente una cosa de la otra.
 */
const CONVENCION_POR_NIVEL: Partial<
  Record<string, { tipoCiclo: TipoCiclo; numCiclos: number }>
> = {
  Licenciatura: { tipoCiclo: 'Semestre', numCiclos: 9 },
  Maestría: { tipoCiclo: 'Cuatrimestre', numCiclos: 6 },
  Especialidad: { tipoCiclo: 'Cuatrimestre', numCiclos: 6 },
  Doctorado: { tipoCiclo: 'Semestre', numCiclos: 8 },
}

/** Lo que una carrera necesita declarar para proponer una estructura de ciclos. */
export type CarreraConDefaults = {
  nivel?: string | null
  tipo_ciclo_default?: TipoCiclo | null
  ciclos_default?: number | null
  semanas_por_ciclo_default?: number | null
}

export type EstructuraCiclosPropuesta = {
  tipoCiclo: TipoCiclo | null
  numCiclos: number | null
  semanasPorCiclo: number | null
  /**
   * De dónde sale la propuesta. Se expone porque no es lo mismo un número que
   * la carrera declara —revisado por alguien— que uno deducido del nivel, y
   * quien crea el plan merece saber cuál de los dos está aceptando.
   */
  origen: 'carrera' | 'nivel' | 'ninguno'
}

/**
 * Convierte una propuesta —que puede estar incompleta porque el catálogo aún
 * no declara ciclos— en valores inmediatamente editables y siempre válidos.
 */
export function completarEstructuraCiclos(
  propuesta: EstructuraCiclosPropuesta,
): {
  tipoCiclo: TipoCiclo
  numCiclos: number
  semanasPorCiclo: number | null
} {
  const tipoCiclo = propuesta.tipoCiclo ?? 'Otro'
  return {
    tipoCiclo,
    numCiclos: Math.max(1, propuesta.numCiclos ?? 1),
    semanasPorCiclo:
      tipoCiclo === 'Otro' ? Math.max(1, propuesta.semanasPorCiclo ?? 1) : null,
  }
}

/**
 * Estructura de ciclos que el asistente propone para una carrera.
 *
 * La carrera manda: si declara tipo y número, se usan tal cual. Sólo cuando no
 * los declara se cae a la convención del nivel, que es una aproximación y no
 * una regla —hay licenciaturas de ocho semestres y de diez—.
 */
export function proponerEstructuraCiclos(
  carrera: CarreraConDefaults | null | undefined,
): EstructuraCiclosPropuesta {
  const tipoCarrera = carrera?.tipo_ciclo_default ?? null
  const ciclosCarrera = carrera?.ciclos_default ?? null
  const semanasCarrera = carrera?.semanas_por_ciclo_default ?? null

  if (tipoCarrera && ciclosCarrera) {
    return {
      tipoCiclo: tipoCarrera,
      numCiclos: ciclosCarrera,
      semanasPorCiclo: requiereSemanasPorCiclo(tipoCarrera)
        ? semanasCarrera
        : null,
      origen: 'carrera',
    }
  }

  const convencion = CONVENCION_POR_NIVEL[(carrera?.nivel ?? '').trim()]
  if (!convencion) {
    return {
      tipoCiclo: tipoCarrera,
      numCiclos: ciclosCarrera,
      semanasPorCiclo: semanasCarrera,
      origen: tipoCarrera || ciclosCarrera ? 'carrera' : 'ninguno',
    }
  }

  // Mezcla: la carrera puede declarar sólo una de las dos cosas y la otra
  // seguir viniendo de la convención. El origen se marca como «carrera» en
  // cuanto algo suyo interviene, porque ya no es una propuesta genérica.
  return {
    tipoCiclo: tipoCarrera ?? convencion.tipoCiclo,
    numCiclos: ciclosCarrera ?? convencion.numCiclos,
    semanasPorCiclo: requiereSemanasPorCiclo(
      tipoCarrera ?? convencion.tipoCiclo,
    )
      ? semanasCarrera
      : null,
    origen: tipoCarrera || ciclosCarrera ? 'carrera' : 'nivel',
  }
}

/**
 * Duración total del plan expresada en semanas, cuando se conoce.
 *
 * Sólo hay respuesta con ciclos de tipo «Otro», que son los que traen su
 * duración declarada. Para un semestre o un cuatrimestre la duración depende
 * del calendario de cada facultad y no está registrada, así que se prefiere no
 * responder a inventar un número.
 */
export function semanasTotalesPlan(
  numCiclos: number | null | undefined,
  semanasPorCiclo: number | null | undefined,
): number | null {
  if (!numCiclos || !semanasPorCiclo) return null
  return numCiclos * semanasPorCiclo
}
