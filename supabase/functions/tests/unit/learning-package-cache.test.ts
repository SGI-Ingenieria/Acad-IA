import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1'

import {
  CACHE_BUCKET,
  cachePath,
  checkCache,
  clientSignedUrl,
  computeCacheKey,
  rewriteStorageUrlOrigin,
} from '../../learning-package-export/cache.ts'

Deno.test(
  'computeCacheKey es determinista e invariable al orden de ids',
  async () => {
    const asignaturaId = '11111111-1111-1111-1111-111111111111'
    const ids = [
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
    ]
    const shuffled = [...ids].reverse()

    const keyA = await computeCacheKey(asignaturaId, 'html_bundle', ids)
    const keyB = await computeCacheKey(asignaturaId, 'html_bundle', shuffled)
    assertEquals(keyA, keyB)
    assertEquals(keyA.length > 0, true)
  },
)

Deno.test(
  'computeCacheKey difiere con distinto formato o asignatura',
  async () => {
    const asignaturaA = '11111111-1111-1111-1111-111111111111'
    const asignaturaB = '22222222-2222-2222-2222-222222222222'
    const ids = ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']

    const html = await computeCacheKey(asignaturaA, 'html_bundle', ids)
    const scorm = await computeCacheKey(asignaturaA, 'scorm_1_2', ids)
    const otherAsignatura = await computeCacheKey(
      asignaturaB,
      'html_bundle',
      ids,
    )

    assertNotEquals(html, scorm)
    assertNotEquals(html, otherAsignatura)
  },
)

Deno.test('cachePath agrupa por version, asignatura y formato', async () => {
  const asignaturaId = '11111111-1111-1111-1111-111111111111'
  const ids = ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']
  const key = await computeCacheKey(asignaturaId, 'pptx_bundle', ids)

  assertEquals(
    cachePath('pptx_bundle', asignaturaId, key),
    `cache/v1/${asignaturaId}/pptx_bundle/${key}.pptx`,
  )
})

Deno.test('cachePath usa html para la previsualizacion', async () => {
  const asignaturaId = '11111111-1111-1111-1111-111111111111'
  const ids = ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']
  const key = await computeCacheKey(asignaturaId, 'html_preview', ids)

  assertEquals(
    cachePath('html_preview', asignaturaId, key),
    `cache/v1/${asignaturaId}/html_preview/${key}.html`,
  )
})

Deno.test('checkCache trata cache ausente como miss sin fallar', async () => {
  const asignaturaId = '11111111-1111-1111-1111-111111111111'
  const ids = ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']
  const key = await computeCacheKey(asignaturaId, 'html_preview', ids)
  const expectedPath = cachePath('html_preview', asignaturaId, key)
  const calls: Array<{ bucket: string; directory: string; search?: string }> =
    []
  const supabase = {
    storage: {
      from(bucket: string) {
        return {
          async list(
            directory: string,
            options: { search?: string },
          ): Promise<{ data: Array<unknown>; error: null }> {
            calls.push({ bucket, directory, search: options.search })
            return { data: [], error: null }
          },
        }
      },
    },
  }

  const result = await checkCache(supabase, 'html_preview', asignaturaId, ids)

  assertEquals(result, { hit: false, path: expectedPath })
  assertEquals(calls, [
    {
      bucket: CACHE_BUCKET,
      directory: `cache/v1/${asignaturaId}/html_preview`,
      search: `${key}.html`,
    },
  ])
})

Deno.test('checkCache detecta un objeto existente vigente', async () => {
  const asignaturaId = '11111111-1111-1111-1111-111111111111'
  const ids = ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']
  const key = await computeCacheKey(asignaturaId, 'pptx_bundle', ids)
  const expectedPath = cachePath('pptx_bundle', asignaturaId, key)
  const createdAt = new Date().toISOString()
  const supabase = {
    storage: {
      from(bucket: string) {
        assertEquals(bucket, CACHE_BUCKET)
        return {
          async list(): Promise<{
            data: Array<{ name: string; created_at: string }>
            error: null
          }> {
            return {
              data: [{ name: `${key}.pptx`, created_at: createdAt }],
              error: null,
            }
          },
        }
      },
    },
  }

  const result = await checkCache(supabase, 'pptx_bundle', asignaturaId, ids)

  assertEquals(result, { hit: true, path: expectedPath, createdAt })
})

Deno.test(
  'rewriteStorageUrlOrigin expone URLs firmadas con el origen publico',
  () => {
    const signedUrl =
      'http://localhost:54321/storage/v1/object/sign/learning-packages/cache/v1/a/html_bundle/file.zip?token=abc&download=file.zip'

    assertEquals(
      rewriteStorageUrlOrigin(
        signedUrl,
        'http://localhost:54321',
        'http://127.0.0.1:54321',
      ),
      'http://127.0.0.1:54321/storage/v1/object/sign/learning-packages/cache/v1/a/html_bundle/file.zip?token=abc&download=file.zip',
    )
  },
)

Deno.test(
  'clientSignedUrl usa el origen de la peticion cuando no hay URL publica',
  () => {
    const originalSupabaseUrl = Deno.env.get('SUPABASE_URL')
    const originalPublicUrl = Deno.env.get('SUPABASE_PUBLIC_URL')
    const originalExternalUrl = Deno.env.get('API_EXTERNAL_URL')
    const originalHostPort = Deno.env.get('SUPABASE_INTERNAL_HOST_PORT')
    Deno.env.set('SUPABASE_URL', 'http://internal.supabase.test')
    Deno.env.delete('SUPABASE_PUBLIC_URL')
    Deno.env.delete('API_EXTERNAL_URL')
    Deno.env.delete('SUPABASE_INTERNAL_HOST_PORT')

    try {
      const signedUrl =
        'http://internal.supabase.test/storage/v1/object/sign/learning-packages/cache/v1/a/html_bundle/file.zip?token=abc&download=file.zip'

      assertEquals(
        clientSignedUrl(
          signedUrl,
          'https://project-ref.supabase.co/functions/v1/learning-package-export',
        ),
        'https://project-ref.supabase.co/storage/v1/object/sign/learning-packages/cache/v1/a/html_bundle/file.zip?token=abc&download=file.zip',
      )
    } finally {
      if (originalSupabaseUrl === undefined) {
        Deno.env.delete('SUPABASE_URL')
      } else {
        Deno.env.set('SUPABASE_URL', originalSupabaseUrl)
      }
      if (originalPublicUrl === undefined) {
        Deno.env.delete('SUPABASE_PUBLIC_URL')
      } else {
        Deno.env.set('SUPABASE_PUBLIC_URL', originalPublicUrl)
      }
      if (originalExternalUrl === undefined) {
        Deno.env.delete('API_EXTERNAL_URL')
      } else {
        Deno.env.set('API_EXTERNAL_URL', originalExternalUrl)
      }
      if (originalHostPort === undefined) {
        Deno.env.delete('SUPABASE_INTERNAL_HOST_PORT')
      } else {
        Deno.env.set('SUPABASE_INTERNAL_HOST_PORT', originalHostPort)
      }
    }
  },
)

Deno.test(
  'clientSignedUrl usa el puerto local default cuando Supabase corre en Docker',
  () => {
    const originalSupabaseUrl = Deno.env.get('SUPABASE_URL')
    const originalPublicUrl = Deno.env.get('SUPABASE_PUBLIC_URL')
    const originalExternalUrl = Deno.env.get('API_EXTERNAL_URL')
    const originalHostPort = Deno.env.get('SUPABASE_INTERNAL_HOST_PORT')
    Deno.env.set('SUPABASE_URL', 'http://localhost:54321')
    Deno.env.delete('SUPABASE_PUBLIC_URL')
    Deno.env.delete('API_EXTERNAL_URL')
    Deno.env.delete('SUPABASE_INTERNAL_HOST_PORT')

    try {
      const signedUrl =
        'http://localhost:54321/storage/v1/object/sign/learning-packages/cache/v1/a/html_bundle/file.zip?token=abc&download=file.zip'

      assertEquals(
        clientSignedUrl(
          signedUrl,
          'http://127.0.0.1:8000/functions/v1/learning-package-export',
        ),
        'http://127.0.0.1:54321/storage/v1/object/sign/learning-packages/cache/v1/a/html_bundle/file.zip?token=abc&download=file.zip',
      )
    } finally {
      if (originalSupabaseUrl === undefined) {
        Deno.env.delete('SUPABASE_URL')
      } else {
        Deno.env.set('SUPABASE_URL', originalSupabaseUrl)
      }
      if (originalPublicUrl === undefined) {
        Deno.env.delete('SUPABASE_PUBLIC_URL')
      } else {
        Deno.env.set('SUPABASE_PUBLIC_URL', originalPublicUrl)
      }
      if (originalExternalUrl === undefined) {
        Deno.env.delete('API_EXTERNAL_URL')
      } else {
        Deno.env.set('API_EXTERNAL_URL', originalExternalUrl)
      }
      if (originalHostPort === undefined) {
        Deno.env.delete('SUPABASE_INTERNAL_HOST_PORT')
      } else {
        Deno.env.set('SUPABASE_INTERNAL_HOST_PORT', originalHostPort)
      }
    }
  },
)

Deno.test('clientSignedUrl usa el puerto publico de Supabase local', () => {
  const originalSupabaseUrl = Deno.env.get('SUPABASE_URL')
  const originalPublicUrl = Deno.env.get('SUPABASE_PUBLIC_URL')
  const originalExternalUrl = Deno.env.get('API_EXTERNAL_URL')
  const originalHostPort = Deno.env.get('SUPABASE_INTERNAL_HOST_PORT')
  Deno.env.set('SUPABASE_URL', 'http://localhost:54321')
  Deno.env.delete('SUPABASE_PUBLIC_URL')
  Deno.env.delete('API_EXTERNAL_URL')
  Deno.env.set('SUPABASE_INTERNAL_HOST_PORT', '54321')

  try {
    const signedUrl =
      'http://localhost:54321/storage/v1/object/sign/learning-packages/cache/v1/a/html_bundle/file.zip?token=abc&download=file.zip'

    assertEquals(
      clientSignedUrl(
        signedUrl,
        'http://127.0.0.1:8000/functions/v1/learning-package-export',
      ),
      'http://127.0.0.1:54321/storage/v1/object/sign/learning-packages/cache/v1/a/html_bundle/file.zip?token=abc&download=file.zip',
    )
  } finally {
    if (originalSupabaseUrl === undefined) {
      Deno.env.delete('SUPABASE_URL')
    } else {
      Deno.env.set('SUPABASE_URL', originalSupabaseUrl)
    }
    if (originalPublicUrl === undefined) {
      Deno.env.delete('SUPABASE_PUBLIC_URL')
    } else {
      Deno.env.set('SUPABASE_PUBLIC_URL', originalPublicUrl)
    }
    if (originalExternalUrl === undefined) {
      Deno.env.delete('API_EXTERNAL_URL')
    } else {
      Deno.env.set('API_EXTERNAL_URL', originalExternalUrl)
    }
    if (originalHostPort === undefined) {
      Deno.env.delete('SUPABASE_INTERNAL_HOST_PORT')
    } else {
      Deno.env.set('SUPABASE_INTERNAL_HOST_PORT', originalHostPort)
    }
  }
})

Deno.test('clientSignedUrl no expone el hostname interno kong', () => {
  const originalSupabaseUrl = Deno.env.get('SUPABASE_URL')
  const originalPublicUrl = Deno.env.get('SUPABASE_PUBLIC_URL')
  const originalExternalUrl = Deno.env.get('API_EXTERNAL_URL')
  const originalHostPort = Deno.env.get('SUPABASE_INTERNAL_HOST_PORT')
  Deno.env.set('SUPABASE_URL', 'http://kong:8000')
  Deno.env.delete('SUPABASE_PUBLIC_URL')
  Deno.env.delete('API_EXTERNAL_URL')
  Deno.env.set('SUPABASE_INTERNAL_HOST_PORT', '54321')

  try {
    assertEquals(
      clientSignedUrl(
        'http://kong:8000/storage/v1/object/sign/documentos-academicos/content/file.pdf?token=abc',
        'http://kong:8081/functions/v1/file-signed-url',
      ),
      'http://127.0.0.1:54321/storage/v1/object/sign/documentos-academicos/content/file.pdf?token=abc',
    )
  } finally {
    if (originalSupabaseUrl === undefined) {
      Deno.env.delete('SUPABASE_URL')
    } else {
      Deno.env.set('SUPABASE_URL', originalSupabaseUrl)
    }
    if (originalPublicUrl === undefined) {
      Deno.env.delete('SUPABASE_PUBLIC_URL')
    } else {
      Deno.env.set('SUPABASE_PUBLIC_URL', originalPublicUrl)
    }
    if (originalExternalUrl === undefined) {
      Deno.env.delete('API_EXTERNAL_URL')
    } else {
      Deno.env.set('API_EXTERNAL_URL', originalExternalUrl)
    }
    if (originalHostPort === undefined) {
      Deno.env.delete('SUPABASE_INTERNAL_HOST_PORT')
    } else {
      Deno.env.set('SUPABASE_INTERNAL_HOST_PORT', originalHostPort)
    }
  }
})

Deno.test(
  'rewriteStorageUrlOrigin conserva URLs de otro origen o invalidas',
  () => {
    const signedUrl =
      'https://exdkssurzmjnnhgtiama.supabase.co/storage/v1/object/sign/learning-packages/file.zip?token=abc'

    assertEquals(
      rewriteStorageUrlOrigin(
        signedUrl,
        'http://localhost:54321',
        'https://supabase.lci.ulsa.mx',
      ),
      signedUrl,
    )
    assertEquals(
      rewriteStorageUrlOrigin(
        'no-es-url',
        'http://localhost:54321',
        'https://supabase.lci.ulsa.mx',
      ),
      'no-es-url',
    )
  },
)
