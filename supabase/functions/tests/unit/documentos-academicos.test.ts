import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from 'jsr:@std/assert@1'

import {
  MAX_FILE_BYTES,
  canonicalContentPath,
  detectDocument,
  documentExtractionModel,
  sha256Hex,
  validateUploadDeclaration,
} from '../../_shared/documentos-academicos.ts'
import {
  DOCUMENT_REFERENCE_VERSION_SELECT,
  documentFileIds,
  resolveDocumentReferences,
} from '../../_shared/documentos-referencias.ts'
import { documentWorkerRequest } from '../../_shared/documentos-worker.ts'
import {
  openAIFileData,
  storageOpenAIInputFile,
} from '../../_shared/openai-file-input.ts'

Deno.test('reconoce firmas permitidas y rechaza un ZIP no OOXML', () => {
  assertEquals(
    detectDocument(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), 'plan.pdf'),
    { mimeType: 'application/pdf', extension: 'pdf', isOoxml: false },
  )
  assertEquals(
    detectDocument(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 'plan.docx'),
    {
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
      isOoxml: true,
    },
  )
  assertRejects(async () =>
    detectDocument(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 'archivo.zip'),
  )
})

Deno.test(
  'el hash autoritativo se calcula sobre los bytes del Edge worker',
  async () => {
    assertEquals(
      await sha256Hex(new TextEncoder().encode('Acad-IA').buffer),
      'f96793040b6b8f38f92ccd597e3efa2ba53f99b6b73b827c0ccc2576e9ac2d2c',
    )
  },
)

Deno.test('la carga limita tamaño, MIME y formatos peligrosos', () => {
  validateUploadDeclaration({
    filename: 'programa.pdf',
    size: MAX_FILE_BYTES,
    mimeType: 'application/pdf',
  })
  assertRejects(async () =>
    validateUploadDeclaration({
      filename: 'macro.docm',
      size: 12,
      mimeType: 'application/pdf',
    }),
  )
  assertRejects(async () =>
    validateUploadDeclaration({
      filename: 'grande.pdf',
      size: MAX_FILE_BYTES + 1,
      mimeType: 'application/pdf',
    }),
  )
})

Deno.test(
  'la extracción rutinaria usa el modelo económico salvo override',
  () => {
    assertEquals(documentExtractionModel(null), 'gpt-5.6-luna')
    assertEquals(documentExtractionModel(' modelo-interno '), 'modelo-interno')
  },
)

Deno.test(
  'la ruta física no revela el nombre original y se particiona por hash',
  () => {
    assertEquals(
      canonicalContentPath(
        '11111111-1111-1111-1111-111111111111',
        'ab'.padEnd(64, '0'),
      ),
      'content/11111111-1111-1111-1111-111111111111/ab/ab00000000000000000000000000000000000000000000000000000000000000',
    )
  },
)

Deno.test(
  'las referencias documentales desambiguan sus relaciones de PostgREST',
  () => {
    assertStringIncludes(
      DOCUMENT_REFERENCE_VERSION_SELECT,
      'files!file_versions_file_id_fkey',
    )
    assertStringIncludes(
      DOCUMENT_REFERENCE_VERSION_SELECT,
      'file_blobs!file_versions_blob_id_fkey',
    )
    assertStringIncludes(DOCUMENT_REFERENCE_VERSION_SELECT, 'detected_mime')
    assertEquals(
      documentFileIds([
        '11111111-1111-4111-8111-111111111111',
        'no-es-uuid',
        '11111111-1111-4111-8111-111111111111',
      ]),
      ['11111111-1111-4111-8111-111111111111'],
    )
  },
)

Deno.test(
  'los archivos privados se envían a OpenAI como datos y no como URL interna',
  () => {
    assertEquals(
      openAIFileData(new TextEncoder().encode('Acad-IA'), 'text/plain'),
      'data:text/plain;base64,QWNhZC1JQQ==',
    )
    assertRejects(async () =>
      openAIFileData(new Uint8Array(MAX_FILE_BYTES + 1), 'application/pdf'),
    )
  },
)

Deno.test(
  'las imágenes privadas usan input_image y no input_file',
  async () => {
    const supabase = {
      storage: {
        from: () => ({
          download: () =>
            Promise.resolve({
              data: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], {
                type: 'image/png',
              }),
              error: null,
            }),
        }),
      },
    } as unknown as Parameters<typeof storageOpenAIInputFile>[0]['supabase']

    const input = await storageOpenAIInputFile({
      supabase,
      bucket: 'documentos-academicos',
      path: 'content/test.png',
      filename: 'evidencia.png',
      mimeType: 'image/png',
      expectedSize: 4,
    })

    assertEquals(input.type, 'input_image')
    if (input.type !== 'input_image') throw new Error('Se esperaba una imagen')
    assertStringIncludes(input.image_url, 'data:image/png;base64,')
    assertEquals(Object.hasOwn(input, 'file_data'), false)
  },
)

Deno.test(
  'el worker documental puede continuar drenando por la red interna',
  () => {
    const request = documentWorkerRequest({
      supabaseUrl: 'http://kong:8000/',
      serviceRoleKey: 'service-role-de-prueba',
      source: 'self-drain',
    })

    assertEquals(request.url, 'http://kong:8000/functions/v1/process-file-jobs')
    assertEquals(request.init.method, 'POST')
    assertEquals(
      (request.init.headers as Record<string, string>).Authorization,
      'Bearer service-role-de-prueba',
    )
    assertEquals(request.init.body, JSON.stringify({ source: 'self-drain' }))
  },
)

function documentReferenceClient(
  versions: Array<Record<string, unknown>>,
  bytes = 'Acad-IA',
): Parameters<typeof resolveDocumentReferences>[0]['supabase'] {
  return {
    rpc: () => Promise.resolve({ data: true, error: null }),
    from: () => ({
      select: () => ({
        in: () => Promise.resolve({ data: versions, error: null }),
      }),
      // La resolución alimenta "Recientes" (files.last_used_at).
      update: () => ({
        in: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
    storage: {
      from: () => ({
        download: () =>
          Promise.resolve({
            data: new Blob([bytes], { type: 'text/plain' }),
            error: null,
          }),
      }),
    },
  } as unknown as Parameters<typeof resolveDocumentReferences>[0]['supabase']
}

Deno.test(
  'una versión materializada se usa directa aunque siga procesándose',
  async () => {
    const fileId = '11111111-1111-4111-8111-111111111111'
    const versionId = '22222222-2222-4222-8222-222222222222'
    const resolution = await resolveDocumentReferences({
      supabase: documentReferenceClient([
        {
          id: versionId,
          file_id: fileId,
          original_filename: 'plan.txt',
          files: {
            display_name: 'Plan',
            status: 'processing',
            current_version_id: versionId,
          },
          file_blobs: {
            storage_bucket: 'documentos-academicos',
            storage_path: 'content/test',
            size_bytes: 7,
            detected_mime: 'text/plain',
          },
        },
      ]),
      userId: '33333333-3333-4333-8333-333333333333',
      fileIds: [fileId],
      query: 'Genera una sugerencia',
    })

    assertEquals(resolution.mode, 'direct')
    const inputFile = resolution.inputFiles[0]
    assertEquals(inputFile.type, 'input_file')
    if (inputFile.type !== 'input_file') {
      throw new Error('Se esperaba un documento directo')
    }
    assertStringIncludes(inputFile.file_data, 'base64,')
    assertEquals(Object.hasOwn(inputFile, 'file_url'), false)
  },
)

Deno.test('una referencia aún no materializada nunca se ignora', async () => {
  const error = await assertRejects(() =>
    resolveDocumentReferences({
      supabase: documentReferenceClient([]),
      userId: '33333333-3333-4333-8333-333333333333',
      fileIds: ['11111111-1111-4111-8111-111111111111'],
      query: 'Genera una sugerencia',
    }),
  )
  assertEquals(
    (error as Error & { code?: string }).code,
    'DOCUMENT_STILL_PROCESSING',
  )
})

// La extracción propia (parseExtractedDocument) fue retirada junto con el
// pipeline de chunking: el retrieval usa vector stores de OpenAI.
