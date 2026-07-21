// supabase/functions/ai-structured/ai_structured.test.ts
// dummy number
/// <reference lib="deno.ns" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { assert, assertEquals } from 'jsr:@std/assert@1'
import 'jsr:@std/dotenv/load'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '' // (o PUBLISHABLE_KEY si así lo nombraste)
const EMAIL = Deno.env.get('TEST_EMAIL') ?? 'guillermo.arrieta@lasalle.mx'
const PASSWORD = Deno.env.get('TEST_PASSWORD') ?? 'admin'

const options = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
}

function mustEnv() {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required')
  if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY is required')
}

async function getAuthedClient(): Promise<{
  client: SupabaseClient
  accessToken: string
}> {
  mustEnv()
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options)

  const { data, error } = await client.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  if (error) throw new Error('Sign-in failed: ' + error.message)

  const accessToken = data.session?.access_token
  if (!accessToken) {
    throw new Error('No access_token returned from signInWithPassword')
  }

  return { client, accessToken }
}

Deno.test(
  { name: 'ai-structured (JSON body) [DEPRECATED]', ignore: true },
  async () => {
    const { client, accessToken } = await getAuthedClient()

    const { data, error } = await client.functions.invoke('ai-structured', {
      headers: {
        Authorization: `Bearer ${accessToken}`, // 👈 clave para que tu función pase el authHeader check
      },
      body: {
        response: {
          model: 'gpt-5',
          input: [
            { role: 'system', content: 'Responde SIEMPRE en JSON válido.' },
            {
              role: 'user',
              content: 'Dame 3 ideas de proyecto de IA para educación.',
            },
          ],
        },
        structured: {
          type: 'json_schema',
          name: 'ideas',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              ideas: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    titulo: { type: 'string' },
                    descripcion: { type: 'string' },
                  },
                  required: ['titulo', 'descripcion'],
                  additionalProperties: false,
                },
              },
            },
            required: ['ideas'],
            additionalProperties: false,
          },
        },
        references: {},
        usarMCP: false,
      },
    })

    if (error) throw new Error('Invoke failed: ' + error.message)
    assert(data, 'Expected data from function')

    // tu función responde { ok, output, outputText, ... }
    assertEquals(data.ok, true)
    assert(Array.isArray(data.output?.ideas), 'output.ideas should be an array')
    assertEquals(data.output.ideas.length, 3)
    for (const it of data.output.ideas) {
      assert(typeof it.titulo === 'string')
      assert(typeof it.descripcion === 'string')
    }
  },
)

Deno.test(
  {
    name: 'ai-structured (multipart + file) [DEPRECATED]',
    ignore: true,
  },
  async () => {
    const { client, accessToken } = await getAuthedClient()

    // Lee un PDF local (ajusta path)
    const bytes = await Deno.readFile('files/carta.pdf')
    const file = new File([bytes], 'carta.pdf', { type: 'application/pdf' })

    const payload = {
      response: {
        input: 'Resume estos documentos en JSON.',
        model: 'gpt-5.6-luna',
      },
      structured: {
        type: 'json_schema',
        name: 'resumen',
        strict: true,
        schema: {
          type: 'object',
          properties: { resumen: { type: 'string' } },
          required: ['resumen'],
          additionalProperties: false,
        },
      },
      storage: { prefix: 'tmp' },
    }

    const fd = new FormData()
    fd.append('payload', JSON.stringify(payload))
    fd.append('files', file)

    const { data, error } = await client.functions.invoke('ai-structured', {
      headers: {
        Authorization: `Bearer ${accessToken}`, // 👈 necesario
        // NO pongas Content-Type: fetch lo setea con boundary para FormData ✅
      },
      method: 'POST',
      body: fd,
    })

    if (error) throw new Error('Invoke failed: ' + error.message)
    assert(data, 'Expected data from function')

    assertEquals(data.ok, true)
    assert(typeof data.output?.resumen === 'string')
    assert(data.output.resumen.length > 0)

    // opcional: valida que registró upload(s) a OpenAI files
    assert(Array.isArray(data.references?.openaiFileIds))
  },
)
