import type {
  ContextoAreaComun,
  EspacioAreaComun,
} from '@/data/types/areaComun'

/** Incluye todas las distribuciones del catálogo, incluso alternativas no seleccionadas. */
export function espaciosSeriacionAreaComun(
  contexto: ContextoAreaComun | undefined,
): Array<EspacioAreaComun> {
  if (!contexto?.borrador && contexto?.distribucion)
    return contexto.distribucion.espacios
  return (
    contexto?.borrador ??
    contexto?.contenido?.distribuciones ??
    []
  ).flatMap((d) => d.espacios)
}

export function esAlternativaElectiva(
  espacios: Array<EspacioAreaComun>,
  id: string,
  origenId?: string | null,
): boolean {
  return espacios.some((e) => e.opciones?.includes(origenId ?? id))
}

/** Una arista por dependencia de grupo, independiente del número de alternativas. */
export function aristasSeriacionGrupos(espacios: Array<EspacioAreaComun>) {
  return espacios
    .filter((e) => e.opciones && e.prerrequisito_grupo_clave)
    .map((e) => ({
      source: 'grupo-' + e.prerrequisito_grupo_clave,
      target: 'grupo-' + e.clave,
    }))
}
