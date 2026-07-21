import { describe, expect, test } from 'bun:test'

import {
  claveCargaReferencia,
  contarCargasSinResolver,
  reconciliarCargasPendientes,
  reservarArchivosReferencia,
} from './AIRequestComposer'

const documentFile = (name: string, lastModified: number) =>
  new File([name], name, { type: 'text/plain', lastModified })

describe('reservas optimistas del compositor IA', () => {
  test('respeta el máximo aun cuando llegan dos lotes consecutivos', () => {
    const a = documentFile('a.txt', 1)
    const b = documentFile('b.txt', 2)
    const c = documentFile('c.txt', 3)
    const reserved = new Set<string>()

    const first = reservarArchivosReferencia([a, b], 3, reserved)
    first.forEach((file) => reserved.add(claveCargaReferencia(file)))
    const second = reservarArchivosReferencia([b, c], 5, reserved)

    expect(first).toEqual([a, b])
    expect(second).toEqual([])
  })

  test('omite un archivo que ya tiene una reserva en vuelo', () => {
    const repeated = documentFile('misma.txt', 1)
    const fresh = documentFile('nueva.txt', 2)
    const reserved = new Set([claveCargaReferencia(repeated)])

    expect(reservarArchivosReferencia([repeated, fresh], 1, reserved)).toEqual([
      fresh,
    ])
  })

  test('mantiene el chip hasta que la referencia está lista y expone el fallo', () => {
    const file = documentFile('programa.pdf', 3)
    const pending = [
      {
        id: 'pending:programa',
        file,
        fileId: 'file-1',
        status: 'resolving' as const,
      },
    ]

    expect(
      reconciliarCargasPendientes(pending, [
        { id: 'file-1', status: 'processing' },
      ]),
    ).toEqual(pending)
    expect(
      reconciliarCargasPendientes(pending, [{ id: 'file-1', status: 'ready' }]),
    ).toEqual([])
    expect(
      reconciliarCargasPendientes(pending, [
        { id: 'file-1', status: 'failed' },
      ])[0],
    ).toMatchObject({ status: 'failed', failureKind: 'processing' })
  })

  test('bloquea el envío sólo hasta que cada carga tiene un fileId durable', () => {
    expect(
      contarCargasSinResolver([
        { fileId: undefined },
        { fileId: 'archivo-ya-materializado' },
      ]),
    ).toBe(1)
    expect(
      contarCargasSinResolver([{ fileId: 'archivo-ya-materializado' }]),
    ).toBe(0)
  })
})
