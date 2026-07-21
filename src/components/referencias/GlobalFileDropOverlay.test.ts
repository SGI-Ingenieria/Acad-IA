import { describe, expect, test } from 'bun:test'

import {
  crearCoordinadorCargaGlobal,
  normalizarArchivosReferencia,
  obtenerArchivosDelPortapapeles,
  obtenerArchivosParaPegadoGlobal,
} from './GlobalFileDropOverlay'

describe('ingreso de archivos de referencia', () => {
  test('deduplica y limita un lote a cinco archivos', () => {
    const files = Array.from(
      { length: 6 },
      (_, index) =>
        new File([String(index)], `archivo-${index}.txt`, {
          type: 'text/plain',
          lastModified: index,
        }),
    )

    expect(
      normalizarArchivosReferencia([files[0], files[0], ...files]),
    ).toEqual(files.slice(0, 5))
  })

  test('convierte una captura pegada en un archivo con nombre descriptivo', () => {
    const image = new File(['png'], 'image.png', {
      type: 'image/png',
      lastModified: 10,
    })
    const clipboard = {
      files: [image],
      items: [],
    } as unknown as Pick<DataTransfer, 'files' | 'items'>

    const [result] = obtenerArchivosDelPortapapeles(clipboard)

    expect(result.name).toStartWith('imagen-pegada-')
    expect(result.name).toEndWith('.png')
    expect(result.type).toBe('image/png')
  })

  test('no inventa archivos cuando el portapapeles sólo contiene texto', () => {
    const clipboard = {
      files: [],
      items: [{ kind: 'string', getAsFile: () => null }],
    } as unknown as Pick<DataTransfer, 'files' | 'items'>

    expect(obtenerArchivosDelPortapapeles(clipboard)).toEqual([])
  })

  test('el pegado global no duplica un archivo ya tomado por el compositor', () => {
    const image = new File(['png'], 'captura.png', { type: 'image/png' })
    const clipboard = {
      files: [image],
      items: [],
    } as unknown as Pick<DataTransfer, 'files' | 'items'>

    expect(obtenerArchivosParaPegadoGlobal(true, true, clipboard)).toEqual([])
    expect(obtenerArchivosParaPegadoGlobal(true, false, clipboard)).toEqual([
      image,
    ])
  })

  test('entrega un gesto global sólo a la superficie de IA activa', () => {
    const coordinador = crearCoordinadorCargaGlobal()
    const archivo = new File(['contenido'], 'referencia.txt', {
      type: 'text/plain',
    })
    const entregasA: Array<Array<File>> = []
    const entregasB: Array<Array<File>> = []
    const idA = Symbol('a')
    const idB = Symbol('b')
    const targetA = {} as EventTarget
    const targetB = {} as EventTarget

    coordinador.registrar({
      id: idA,
      aceptaPegado: () => true,
      contieneObjetivo: (target) => target === targetA,
      onFiles: (files) => {
        entregasA.push(files)
      },
      setVisible: () => undefined,
    })
    coordinador.registrar({
      id: idB,
      aceptaPegado: () => true,
      contieneObjetivo: (target) => target === targetB,
      onFiles: (files) => {
        entregasB.push(files)
      },
      setVisible: () => undefined,
    })

    coordinador.resolverParaObjetivo(targetA)
    expect(coordinador.entregar([archivo])).toBe(true)
    expect(entregasA).toEqual([[archivo]])
    expect(entregasB).toEqual([])

    coordinador.resolverParaObjetivo(targetB)
    coordinador.entregar([archivo])
    expect(entregasA).toHaveLength(1)
    expect(entregasB).toEqual([[archivo]])
  })
})
