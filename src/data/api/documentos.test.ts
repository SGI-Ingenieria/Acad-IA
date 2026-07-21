import { describe, expect, test } from 'bun:test'

import {
  construirEndpointTus,
  esperarMaterializacionCarga,
  resolverUrlFirmadaDocumento,
} from './documentos.api'

describe('construirEndpointTus', () => {
  test('usa la URL pública del navegador y nunca el hostname interno de la Edge Function', () => {
    expect(construirEndpointTus('http://localhost:3000/')).toBe(
      'http://localhost:3000/storage/v1/upload/resumable',
    )
  })

  test('conserva el dominio alojado sin barras duplicadas', () => {
    expect(construirEndpointTus('https://academia.example.edu///')).toBe(
      'https://academia.example.edu/storage/v1/upload/resumable',
    )
  })
})

describe('resolverUrlFirmadaDocumento', () => {
  test('sustituye el hostname interno de Docker por el origen público', () => {
    expect(
      resolverUrlFirmadaDocumento(
        'http://kong:8000/storage/v1/object/sign/documentos-academicos/a.pdf?token=abc',
        'http://127.0.0.1:54321',
      ),
    ).toBe(
      'http://127.0.0.1:54321/storage/v1/object/sign/documentos-academicos/a.pdf?token=abc',
    )
  })

  test('acepta una ruta firmada relativa sin cambiar su firma', () => {
    expect(
      resolverUrlFirmadaDocumento(
        '/storage/v1/object/sign/documentos-academicos/a.pdf?token=abc',
        'https://supabase.example.edu',
      ),
    ).toBe(
      'https://supabase.example.edu/storage/v1/object/sign/documentos-academicos/a.pdf?token=abc',
    )
  })
})

describe('esperarMaterializacionCarga', () => {
  test('mantiene la misma sesión más allá de treinta ciclos hasta recibir fileId', async () => {
    let reads = 0
    const result = await esperarMaterializacionCarga({
      read: async () => {
        reads += 1
        return {
          id: 'sesion-durable',
          status: reads > 35 ? 'extracting' : 'hashing',
          fileId: reads > 35 ? 'archivo-materializado' : null,
          errorCode: null,
        }
      },
      wait: async () => undefined,
    })

    expect(reads).toBe(36)
    expect(result).toEqual({
      id: 'sesion-durable',
      status: 'extracting',
      fileId: 'archivo-materializado',
      errorCode: null,
    })
  })

  test('sólo rechaza cuando la sesión alcanza un estado terminal', async () => {
    await expect(
      esperarMaterializacionCarga({
        read: async () => ({
          id: 'sesion-fallida',
          status: 'failed',
          fileId: null,
          errorCode: 'UPLOAD_SIZE_MISMATCH',
        }),
        wait: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_SIZE_MISMATCH' })
  })
})
