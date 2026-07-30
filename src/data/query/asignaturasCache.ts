import type { Asignatura } from '../types/domain'

/**
 * Sustituye la fila optimista de una generación por la fila persistida.
 *
 * Realtime puede entregar el INSERT del servidor antes de que termine la
 * mutación. Aunque normalmente ese eco se omite mientras la generación está en
 * vuelo, esta reconciliación elimina tanto el id temporal como cualquier copia
 * anticipada del id real para mantener una sola identidad en la lista.
 */
export function reconciliarAsignaturaGenerada(
  filas: Array<Asignatura>,
  tempId: string,
  asignatura: Asignatura,
): Array<Asignatura> {
  const idsReconciliados = new Set([tempId, asignatura.id])
  const indice = filas.findIndex((fila) => idsReconciliados.has(fila.id))

  if (indice === -1) return [...filas, asignatura]

  const reconciliadas = filas.filter((fila) => !idsReconciliados.has(fila.id))
  reconciliadas.splice(Math.min(indice, reconciliadas.length), 0, asignatura)
  return reconciliadas
}
