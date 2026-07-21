import { describe, expect, test } from 'bun:test'

import { obtenerArchivosSueltos, ordenarColecciones } from './ReferenceLibrary'

import type {
  DocumentoArchivo,
  DocumentoColeccion,
} from '@/data/api/documentos.api'

const file = (id: string): DocumentoArchivo => ({
  id,
  display_name: `${id}.pdf`,
  description: null,
  status: 'ready',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  current_version_id: id,
})

const collection = (
  id: string,
  name: string,
  fileIds: Array<string>,
  updatedAt: string,
): DocumentoColeccion => ({
  id,
  name,
  description: null,
  kind: 'collection',
  status: 'active',
  created_by: 'user',
  created_at: updatedAt,
  updated_at: updatedAt,
  canManage: true,
  fileIds,
})

describe('proyección del explorador de referencias', () => {
  test('muestra como sueltos sólo los archivos fuera de cualquier carpeta', () => {
    const files = [file('personal'), file('curricular'), file('suelto')]
    const collections = [
      collection('c1', 'Personal', ['personal'], '2026-01-01T00:00:00Z'),
      {
        ...collection(
          'c2',
          'Curricular',
          ['curricular'],
          '2026-01-02T00:00:00Z',
        ),
        kind: 'curriculum_repository' as const,
      },
    ]

    expect(
      obtenerArchivosSueltos(files, collections).map((item) => item.id),
    ).toEqual(['suelto'])
  })

  test('aplica el orden seleccionado también a las carpetas', () => {
    const collections = [
      collection('a', 'Álgebra', [], '2026-01-01T00:00:00Z'),
      collection('z', 'Zoología', [], '2026-02-01T00:00:00Z'),
    ]

    expect(ordenarColecciones(collections, 'name_desc')[0].id).toBe('z')
    expect(ordenarColecciones(collections, 'updated_desc')[0].id).toBe('z')
  })
})
