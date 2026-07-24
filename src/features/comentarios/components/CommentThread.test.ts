import { describe, expect, test } from 'bun:test'

import { buildCommentPhaseGroups } from './CommentThread'

import type { ComentarioPlan, EstadoPlanRow } from '@/data/types/domain'

function comment(
  id: string,
  estadoId: string | null,
  parentId: string | null = null,
): ComentarioPlan {
  return {
    id,
    estado_id: estadoId,
    comentario_padre_id: parentId,
    creado_en: '2026-07-23T12:00:00.000Z',
    autor: { id: `autor-${id}`, nombre_completo: `Autor ${id}` },
  } as ComentarioPlan
}

function phase(id: string, etiqueta: string, orden: number): EstadoPlanRow {
  return { id, etiqueta, orden } as EstadoPlanRow
}

describe('agrupamiento académico de comentarios', () => {
  const phases = new Map<string, EstadoPlanRow>([
    ['fase-1', phase('fase-1', 'Borrador', 1)],
    ['fase-2', phase('fase-2', 'Revisión', 2)],
  ])

  test('ordena por fase y conserva respuestas posteriores dentro del hilo raíz', () => {
    const groups = buildCommentPhaseGroups(
      [
        comment('raiz-revision', 'fase-2'),
        comment('raiz-borrador', 'fase-1'),
        comment('respuesta-posterior', 'fase-2', 'raiz-borrador'),
      ],
      phases,
      null,
    )

    expect(groups.map((group) => group.phaseLabel)).toEqual([
      'Borrador',
      'Revisión',
    ])
    expect(groups[0]?.commentCount).toBe(2)
    expect(groups[0]?.threads[0]?.replies[0]?.comment.id).toBe(
      'respuesta-posterior',
    )
  })

  test('filtra por la fase raíz y conserva un grupo explícito para fase desconocida', () => {
    const filtered = buildCommentPhaseGroups(
      [comment('borrador', 'fase-1'), comment('sin-fase', null)],
      phases,
      'fase-1',
    )
    const allGroups = buildCommentPhaseGroups(
      [comment('borrador', 'fase-1'), comment('sin-fase', null)],
      phases,
      null,
    )

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.phaseLabel).toBe('Borrador')
    expect(allGroups[1]?.phaseLabel).toBe('Sin fase registrada')
  })
})
