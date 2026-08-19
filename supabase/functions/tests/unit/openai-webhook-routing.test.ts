import { assertEquals } from 'jsr:@std/assert@1'

import {
  projectRefFromSupabaseUrl,
  withOpenAIWebhookRouting,
} from '../../_shared/openai-webhook-routing.ts'

const PROJECT_REF = 'abcdefghijklmnopqrst'

Deno.test(
  'extrae el project_ref únicamente de hosts administrados por Supabase',
  () => {
    assertEquals(
      projectRefFromSupabaseUrl(`https://${PROJECT_REF}.supabase.co`),
      PROJECT_REF,
    )
    assertEquals(projectRefFromSupabaseUrl('http://127.0.0.1:54321'), null)
    assertEquals(projectRefFromSupabaseUrl('https://example.com'), null)
  },
)

Deno.test(
  'añade la branch a Responses background sin alterar metadata de dominio',
  () => {
    const request = withOpenAIWebhookRouting(
      {
        model: 'gpt-5.6-luna',
        background: true,
        metadata: { tabla: 'planes_estudio', id: 'plan-1' },
      },
      `https://${PROJECT_REF}.supabase.co`,
    )

    assertEquals(request.metadata as Record<string, string>, {
      tabla: 'planes_estudio',
      id: 'plan-1',
      supabase_project_ref: PROJECT_REF,
    })
  },
)

Deno.test('no añade routing a Responses foreground', () => {
  const request = { model: 'gpt-5.6-luna', metadata: { tabla: 'prueba' } }
  assertEquals(
    withOpenAIWebhookRouting(request, `https://${PROJECT_REF}.supabase.co`),
    request,
  )
})
