import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'

import {
  conversationTableName,
  hasConversationFileAccess,
  normalizeReferenceIds,
  projectAuthorizedCollections,
  type AuthorizedCollectionRow,
} from '../../files-api/library-access.ts'

const collection = (
  overrides: Partial<AuthorizedCollectionRow>,
): AuthorizedCollectionRow => ({
  id: 'collection-own',
  name: 'Notas de trabajo',
  description: null,
  kind: 'collection',
  status: 'active',
  created_by: 'user-a',
  created_at: '2026-07-21T00:00:00Z',
  updated_at: '2026-07-21T00:00:00Z',
  file_ids: [],
  ...overrides,
})

Deno.test(
  'normaliza, deduplica y limita los identificadores de referencias',
  () => {
    const first = '11111111-1111-4111-8111-111111111111'
    const second = '22222222-2222-4222-8222-222222222222'

    assertEquals(
      normalizeReferenceIds([first, 'no-es-uuid', first, second], 2),
      [first, second],
    )
    assertEquals(normalizeReferenceIds('no-es-arreglo'), [])
  },
)

Deno.test(
  'la proyección conserva sólo colecciones personales propias y archivos visibles',
  () => {
    const projected = projectAuthorizedCollections(
      [
        collection({}),
        collection({ id: 'collection-other', created_by: 'user-b' }),
        collection({
          id: 'repository-authorized',
          kind: 'curriculum_repository',
          created_by: 'user-b',
          file_ids: ['file-visible', 'file-outside-page'],
        }),
      ],
      new Set(['file-visible']),
      'user-a',
    )

    assertEquals(
      projected.map(({ id, canManage, fileIds }) => ({
        id,
        canManage,
        fileIds,
      })),
      [
        { id: 'collection-own', canManage: true, fileIds: [] },
        {
          id: 'repository-authorized',
          canManage: false,
          fileIds: ['file-visible'],
        },
      ],
    )
  },
)

Deno.test(
  'el resolvedor de referencias valida archivos y proyecta colecciones autorizadas',
  async () => {
    const source = await Deno.readTextFile(
      new URL('../../files-api/index.ts', import.meta.url),
    )
    const block = source.match(
      /async function resolveReferences[\s\S]*?\n}\n\nfunction collectionDeclaration/,
    )

    assert(block, 'No se encontró el resolvedor de referencias')
    assertStringIncludes(
      block[0],
      "rpc(\n          'autorizar_uso_archivo_documental'",
    )
    assertStringIncludes(block[0], "p_permiso: 'view'")
    assertStringIncludes(block[0], 'projectAuthorizedCollections(')
    assertStringIncludes(block[0], ".eq('tenant_id', tenantId)")
    assertStringIncludes(block[0], ".is('deleted_at', null)")
  },
)

Deno.test(
  'cada tipo de conversación consulta su tabla protegida por RLS',
  () => {
    assertEquals(conversationTableName('plan'), 'conversaciones_plan')
    assertEquals(
      conversationTableName('asignatura'),
      'conversaciones_asignatura',
    )
  },
)

Deno.test(
  'la lectura no concede mutaciones sin IA y un colaborador con IA sí puede modificar archivos',
  () => {
    assertEquals(hasConversationFileAccess('read', true, false), true)
    assertEquals(hasConversationFileAccess('write', true, false), false)
    assertEquals(hasConversationFileAccess('write', true, true), true)
  },
)

Deno.test(
  'files-api delega la lectura de la conversación al cliente autenticado sin filtrar por creador',
  async () => {
    const source = await Deno.readTextFile(
      new URL('../../files-api/index.ts', import.meta.url),
    )
    const block = source.match(
      /async function authorizedConversation[\s\S]*?\n}\n\nasync function listConversationFiles/,
    )

    assert(block, 'No se encontró el bloque de autorización de conversación')
    assertStringIncludes(block[0], 'authenticatedClient(request)')
    assertStringIncludes(block[0], '.from(conversationTableName(')
    assertStringIncludes(block[0], "rpc('authz_plan_ia_allowed'")
    assertStringIncludes(block[0], "rpc('authz_asignatura_ia_allowed'")
    assertEquals(block[0].includes('creado_por'), false)
  },
)

Deno.test(
  'files-api exige escritura autorizada al adjuntar o retirar archivos',
  async () => {
    const source = await Deno.readTextFile(
      new URL('../../files-api/index.ts', import.meta.url),
    )
    const attach = source.match(
      /async function attachConversationFile[\s\S]*?\n}\n\nasync function detachConversationFile/,
    )
    const detach = source.match(
      /async function detachConversationFile[\s\S]*?\n}\n\nasync function getUploadSession/,
    )

    assert(attach, 'No se encontró el flujo para adjuntar archivos')
    assert(detach, 'No se encontró el flujo para retirar archivos')
    assertStringIncludes(attach[0], "conversationId,\n    'write',")
    assertStringIncludes(detach[0], "conversationId,\n    'write',")
  },
)
