import {
  assertEquals,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'

import {
  azureDocumentLayoutEnabled,
  extractDocumentLayout,
} from '../../_shared/azure-document-layout.ts'

Deno.test(
  'extrae el layout mediante la operación asíncrona de Azure',
  async () => {
    const originalFetch = globalThis.fetch
    const originalEndpoint = Deno.env.get(
      'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT',
    )
    const originalKey = Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_KEY')
    let pollCount = 0

    Deno.env.set(
      'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT',
      'https://example.cognitiveservices.azure.com/',
    )
    Deno.env.set('AZURE_DOCUMENT_INTELLIGENCE_KEY', 'test-key')
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      assertEquals(
        init?.headers instanceof Headers
          ? init.headers.get('Ocp-Apim-Subscription-Key')
          : (init?.headers as Record<string, string>)[
              'Ocp-Apim-Subscription-Key'
            ],
        'test-key',
      )
      if (init?.method === 'POST') {
        assertEquals(
          url.includes('/documentModels/prebuilt-layout:analyze'),
          true,
        )
        assertEquals(url.includes('api-version=2024-11-30'), true)
        assertEquals(url.includes('features=keyValuePairs'), true)
        assertEquals(url.includes('outputContentFormat=markdown'), true)
        return new Response(null, {
          status: 202,
          headers: {
            'Operation-Location': 'https://example.test/operations/1',
          },
        })
      }
      pollCount += 1
      return Response.json({
        status: 'succeeded',
        analyzeResult: {
          content: '# Plan académico\n\n2026',
          pages: [{ pageNumber: 1 }],
          tables: [{}],
          keyValuePairs: [{ key: { content: 'Vigencia' } }],
        },
      })
    }

    try {
      const result = await extractDocumentLayout({
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: 'application/pdf',
        filename: 'plan.pdf',
      })
      assertEquals(result.content, '# Plan académico\n\n2026')
      assertEquals(result.pages, 1)
      assertEquals(result.tables, 1)
      assertEquals(result.keyValuePairs, 1)
      assertEquals(pollCount, 1)
    } finally {
      globalThis.fetch = originalFetch
      if (originalEndpoint) {
        Deno.env.set('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT', originalEndpoint)
      } else Deno.env.delete('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT')
      if (originalKey) {
        Deno.env.set('AZURE_DOCUMENT_INTELLIGENCE_KEY', originalKey)
      } else Deno.env.delete('AZURE_DOCUMENT_INTELLIGENCE_KEY')
    }
  },
)

Deno.test('la bandera permite conservar el extractor actual', () => {
  const original = Deno.env.get('AZURE_DOCUMENT_LAYOUT_ENABLED')
  try {
    Deno.env.delete('AZURE_DOCUMENT_LAYOUT_ENABLED')
    assertEquals(azureDocumentLayoutEnabled(), false)
    Deno.env.set('AZURE_DOCUMENT_LAYOUT_ENABLED', 'true')
    assertEquals(azureDocumentLayoutEnabled(), true)
  } finally {
    if (original) Deno.env.set('AZURE_DOCUMENT_LAYOUT_ENABLED', original)
    else Deno.env.delete('AZURE_DOCUMENT_LAYOUT_ENABLED')
  }
})

Deno.test('rechaza una respuesta sin Operation-Location', async () => {
  const originalFetch = globalThis.fetch
  const originalEndpoint = Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT')
  const originalKey = Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_KEY')
  Deno.env.set('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT', 'https://example.test')
  Deno.env.set('AZURE_DOCUMENT_INTELLIGENCE_KEY', 'test-key')
  globalThis.fetch = async () => new Response('{}', { status: 202 })

  try {
    await assertRejects(
      () =>
        extractDocumentLayout({
          bytes: new Uint8Array([1]),
          mimeType: 'application/pdf',
          filename: 'plan.pdf',
        }),
      Error,
      'Azure no devolvió la operación',
    )
  } finally {
    globalThis.fetch = originalFetch
    if (originalEndpoint) {
      Deno.env.set('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT', originalEndpoint)
    } else Deno.env.delete('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT')
    if (originalKey) {
      Deno.env.set('AZURE_DOCUMENT_INTELLIGENCE_KEY', originalKey)
    } else Deno.env.delete('AZURE_DOCUMENT_INTELLIGENCE_KEY')
  }
})
