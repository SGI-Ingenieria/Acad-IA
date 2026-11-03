/** Una sola alternativa representa la carga curricular de cada bloque. */
export function alternativasSinDuplicarCarga<
  T extends { id: string; grupo_electivo_id?: string | null },
>(
  asignaturas: Array<T>,
  grupoDe: (asignatura: T) => string | null | undefined = (a) =>
    a.grupo_electivo_id,
): Array<T> {
  const vistos = new Set<string>()
  return asignaturas.filter((a) => {
    const grupo = grupoDe(a)
    if (!grupo) return true
    if (vistos.has(grupo)) return false
    vistos.add(grupo)
    return true
  })
}
