import { describe, expect, test } from 'bun:test'

import { normalizeAIGenerationReferences } from './aiGenerationReferences'
import { buildAIGeneratePlanFormData } from './plans.api'
import {
  buildAIGenerateSubjectBody,
  buildGenerateSubjectSuggestionsBody,
} from './subjects.api'

const FILE_ID = '11111111-1111-4111-8111-111111111111'
const COLLECTION_ID = '22222222-2222-4222-8222-222222222222'

describe('contrato de referencias para generaciones IA', () => {
  test('normaliza únicamente UUID documentales de Acad-IA', () => {
    expect(
      normalizeAIGenerationReferences({
        fileIds: [FILE_ID, FILE_ID],
        collectionIds: [COLLECTION_ID],
      }),
    ).toEqual({
      fileIds: [FILE_ID],
      collectionIds: [COLLECTION_ID],
    })
  })

  test('rechaza IDs arbitrarios de OpenAI Files y Vector Stores', () => {
    expect(() =>
      normalizeAIGenerationReferences({ fileIds: ['file-heredado'] }),
    ).toThrow('referencias de IA')
    expect(() =>
      normalizeAIGenerationReferences({ collectionIds: ['vs_heredado'] }),
    ).toThrow('referencias de IA')
  })

  test('el plan omite propiedades legacy aunque un consumidor sin tipos las inyecte', () => {
    const body = buildAIGeneratePlanFormData({
      datosBasicos: {
        estructuraPlanId: '33333333-3333-4333-8333-333333333333',
      },
      iaConfig: {
        descripcionEnfoqueAcademico: 'Enfoque curricular',
        references: { fileIds: [FILE_ID], collectionIds: [COLLECTION_ID] },
        archivosReferencia: ['file-heredado'],
        repositoriosIds: ['vs_heredado'],
      } as never,
    })
    const iaConfig = JSON.parse(String(body.get('iaConfig'))) as Record<
      string,
      unknown
    >

    expect(iaConfig.references).toEqual({
      fileIds: [FILE_ID],
      collectionIds: [COLLECTION_ID],
    })
    expect(iaConfig).not.toHaveProperty('archivosReferencia')
    expect(iaConfig).not.toHaveProperty('repositoriosIds')
  })

  test('asignatura y sugerencias construyen sólo el contrato documental nuevo', () => {
    const subject = buildAIGenerateSubjectBody({
      datosUpdate: {
        plan_estudio_id: '44444444-4444-4444-8444-444444444444',
      },
      iaConfig: {
        references: { fileIds: [FILE_ID], collectionIds: [COLLECTION_ID] },
        archivosReferencia: ['file-heredado'],
        repositoriosIds: ['vs_heredado'],
      } as never,
    })
    const suggestions = buildGenerateSubjectSuggestionsBody({
      plan_estudio_id: '44444444-4444-4444-8444-444444444444',
      cantidad_de_sugerencias: 3,
      sugerencias_conservadas: [],
      references: { fileIds: [FILE_ID], collectionIds: [COLLECTION_ID] },
      archivos_referencia: ['file-heredado'],
    } as never)

    expect(subject.iaConfig?.references).toEqual({
      fileIds: [FILE_ID],
      collectionIds: [COLLECTION_ID],
    })
    expect(subject.iaConfig).not.toHaveProperty('archivosReferencia')
    expect(subject.iaConfig).not.toHaveProperty('repositoriosIds')
    expect(suggestions.references).toEqual({
      fileIds: [FILE_ID],
      collectionIds: [COLLECTION_ID],
    })
    expect(suggestions).not.toHaveProperty('archivos_referencia')
  })
})
