import { describe, expect, test } from 'bun:test'

import { resolverArchivosConversacionAside } from './ChatFilesAside'

describe('archivos del chat', () => {
  test('une históricos y staged sin permitir retirar una referencia usada', () => {
    const result = resolverArchivosConversacionAside(
      ['staged', 'activo'],
      [
        {
          fileId: 'historico',
          addedAt: '2026-01-01T00:00:00Z',
          active: false,
          used: true,
          firstUsedAt: '2026-01-01T00:01:00Z',
          canRemove: false,
        },
        {
          fileId: 'activo',
          addedAt: '2026-01-01T00:00:00Z',
          active: true,
          used: false,
          firstUsedAt: null,
          canRemove: true,
        },
      ],
    )

    expect(result.conversationFileIds).toEqual([
      'historico',
      'activo',
      'staged',
    ])
    expect(result.removableFileIds).toEqual(['activo', 'staged'])
  })
})
