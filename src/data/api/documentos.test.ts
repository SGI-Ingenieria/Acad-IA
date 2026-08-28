import { describe, expect, test } from 'bun:test'

import {
  construirEndpointTus,
  esperarMaterializacionCarga,
  estimarProgresoCarga,
  resolverUrlFirmadaDocumento,
  validarDocumentoAntesDeSubir,
} from './documentos.api'

describe('construirEndpointTus', () => {
  test('usa la URL pública del navegador y nunca el hostname interno de la Edge Function', () => {
    expect(construirEndpointTus('http://localhost:3000/')).toBe(
      'http://localhost:3000/storage/v1/upload/resumable',
    )
  })

  test('conserva un dominio personalizado sin barras duplicadas', () => {
    expect(construirEndpointTus('https://academia.example.edu///')).toBe(
      'https://academia.example.edu/storage/v1/upload/resumable',
    )
  })

  test('usa el hostname directo de Storage en proyectos alojados', () => {
    expect(construirEndpointTus('https://acad-ia.supabase.co')).toBe(
      'https://acad-ia.storage.supabase.co/storage/v1/upload/resumable',
    )
  })
})

describe('estimarProgresoCarga', () => {
  test('calcula porcentaje, velocidad suavizada y tiempo restante con bytes reales', () => {
    const first = estimarProgresoCarga(
      { bytesUploaded: 0, timestampMs: 0, bytesPerSecond: null },
      2_000_000,
      10_000_000,
      1_000,
    )

    expect(first.progress.percentage).toBe(20)
    expect(first.progress.bytesPerSecond).toBe(2_000_000)
    expect(first.progress.estimatedSecondsRemaining).toBe(4)

    const second = estimarProgresoCarga(
      first.state,
      5_000_000,
      10_000_000,
      2_000,
    )
    expect(second.progress.percentage).toBe(50)
    expect(second.progress.bytesPerSecond).toBeGreaterThan(2_000_000)
    expect(second.progress.estimatedSecondsRemaining).toBe(3)
  })

  test('termina en cien por ciento y cero segundos restantes', () => {
    const result = estimarProgresoCarga(
      { bytesUploaded: 8, timestampMs: 0, bytesPerSecond: 4 },
      10,
      10,
      1_000,
    )
    expect(result.progress).toMatchObject({
      percentage: 100,
      estimatedSecondsRemaining: 0,
    })
  })
})

describe('validarDocumentoAntesDeSubir', () => {
  test('rechaza formato y tamaño antes de abrir una sesión de red', () => {
    expect(() =>
      validarDocumentoAntesDeSubir(
        new File(['contenido'], 'referencia.exe', {
          type: 'application/octet-stream',
        }),
      ),
    ).toThrow('El formato del archivo no está permitido.')

    const oversized = new File(['x'], 'referencia.pdf', {
      type: 'application/pdf',
    })
    Object.defineProperty(oversized, 'size', { value: 21 * 1024 * 1024 })
    expect(() => validarDocumentoAntesDeSubir(oversized)).toThrow(
      'El archivo debe pesar como máximo 20 MiB.',
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
