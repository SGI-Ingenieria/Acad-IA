import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1'

import {
  cachePath,
  computeCacheKey,
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
