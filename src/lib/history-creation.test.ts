import { describe, expect, test } from 'bun:test'

import {
  isHistoryCreationEvent,
  normalizeHistoryCreation,
} from './history-creation'

const createdAt = new Date('2026-08-04T17:02:00.000Z')
const fileId = '11111111-1111-4111-8111-111111111111'
const collectionId = '22222222-2222-4222-8222-222222222222'

describe('normalizeHistoryCreation', () => {
  test('sólo CREACION activa la tarjeta especializada', () => {
    expect(isHistoryCreationEvent('CREACION')).toBe(true)
    expect(isHistoryCreationEvent('ACTUALIZACION')).toBe(false)
    expect(isHistoryCreationEvent(null)).toBe(false)
  })

  test('presenta una creación de plan por IA sin campos técnicos', () => {
    const summary = normalizeHistoryCreation({
      entity: 'plan',
      createdAt,
      createdBy: 'Alejandro Rosales',
      rawValue: {
        id: 'technical-id',
        nombre: 'Licenciatura en Teología',
        nombre_display: 'Licenciatura en Teología – Plan Diciembre 2026',
        tipo_origen: 'IA',
        meta_origen: {
          iaConfig: {
            descripcionEnfoqueAcademico: 'Formación humanista',
            instruccionesAdicionalesIA: 'Priorizar investigación aplicada',
          },
          referencias: { fileIds: [fileId], collectionIds: [collectionId] },
        },
      },
    })

    expect(summary.name).toBe('Licenciatura en Teología – Plan Diciembre 2026')
    expect(summary.origin).toBe('IA')
    expect(summary.instructions).toEqual([
      { label: 'Enfoque académico', value: 'Formación humanista' },
      {
        label: 'Instrucciones adicionales',
        value: 'Priorizar investigación aplicada',
      },
    ])
    expect(summary.references).toEqual({
      fileIds: [fileId],
      collectionIds: [collectionId],
    })
    expect(summary).not.toHaveProperty('id')
  })

  test('acepta metadatos heredados y deduplica referencias', () => {
    const summary = normalizeHistoryCreation({
      entity: 'plan',
      createdAt,
      createdBy: 'Sistema IA',
      rawValue: {
        nombre_propuesto: 'Plan heredado',
        tipo_origen: 'GENERADO_IA',
        meta_origen: {
          iaConfig: {
            descripcionEnfoque: 'Enfoque legado',
            notasAdicionales: 'Notas legadas',
          },
          referencias: {
            fileId,
            archivosReferenciaIds: [fileId, 'invalido'],
          },
        },
      },
    })

    expect(summary.name).toBe('Plan heredado')
    expect(summary.references.fileIds).toEqual([fileId])
    expect(summary.instructions).toHaveLength(2)
  })

  test('omite secciones opcionales en una creación manual', () => {
    const summary = normalizeHistoryCreation({
      entity: 'plan',
      createdAt,
      createdBy: 'Usuario Staff',
      rawValue: { nombre: 'Plan manual', tipo_origen: 'MANUAL' },
    })

    expect(summary.origin).toBe('Manual')
    expect(summary.instructions).toEqual([])
    expect(summary.references).toEqual({ fileIds: [], collectionIds: [] })
  })

  test('presenta asignatura, código, plan y referencias anidadas', () => {
    const summary = normalizeHistoryCreation({
      entity: 'asignatura',
      createdAt,
      createdBy: 'Sistema IA',
      planName: 'Plan de Derecho 2026',
      rawValue: {
        nombre: 'Derecho constitucional',
        codigo: 'DER-101',
        tipo_origen: 'IA',
        meta_origen: {
          iaConfig: {
            references: { fileIds: [fileId], collectionIds: [collectionId] },
          },
        },
      },
    })

    expect(summary.name).toBe('Derecho constitucional')
    expect(summary.code).toBe('DER-101')
    expect(summary.planName).toBe('Plan de Derecho 2026')
    expect(summary.references.collectionIds).toEqual([collectionId])
  })

  test('tolera valores ausentes o malformados', () => {
    const summary = normalizeHistoryCreation({
      entity: 'asignatura',
      createdAt,
      createdBy: 'Sistema',
      rawValue: ['valor', 'incorrecto'],
    })

    expect(summary.name).toBe('Asignatura')
    expect(summary.origin).toBeUndefined()
    expect(summary.instructions).toEqual([])
  })
})
