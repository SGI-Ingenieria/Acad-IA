import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { preflightResponse } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/utils.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return preflightResponse()

  if (request.method === 'GET') {
    return jsonResponse({ ok: true, function: 'prueba' })
  }

  let payload: { name?: unknown }
  try {
    payload = await request.json()
  } catch {
    return jsonResponse({ error: 'JSON invalido o faltante.' }, 400)
  }

  const name =
    typeof payload.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : 'Functions'

  return jsonResponse({ message: `Hello ${name}!` })
})
