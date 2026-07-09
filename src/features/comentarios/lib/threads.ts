import type { ComentarioPlan } from '@/data/types/domain'

/** ¿Es un comentario raíz? (sin padre, o con el padre fuera del conjunto). */
export function isRootComment(
  comment: ComentarioPlan,
  byId: Map<string, ComentarioPlan>,
): boolean {
  return !comment.comentario_padre_id || !byId.has(comment.comentario_padre_id)
}

/** Id de la raíz del hilo al que pertenece el comentario (a prueba de ciclos). */
export function rootCommentIdOf(
  comment: ComentarioPlan,
  byId: Map<string, ComentarioPlan>,
): string {
  let current = comment
  const seen = new Set<string>()
  while (
    current.comentario_padre_id &&
    byId.has(current.comentario_padre_id) &&
    !seen.has(current.id)
  ) {
    seen.add(current.id)
    current = byId.get(current.comentario_padre_id)!
  }
  return current.id
}

/** Ids de todos los comentarios del hilo cuya raíz es rootId (incluida la raíz). */
export function threadMemberIds(
  comentarios: Array<ComentarioPlan>,
  rootId: string,
): Array<string> {
  const byId = new Map(comentarios.map((c) => [c.id, c]))
  return comentarios
    .filter((c) => rootCommentIdOf(c, byId) === rootId)
    .map((c) => c.id)
}
