// supabase/functions/ai-structured/ai_structured.test.ts
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
  'ai_generate_plan creates plan and returns structured data',
  async () => {
    const { client, accessToken } = await getAuthedClient()

    const { data: carrera, error: carreraError } = await client
      .from('carreras')
      .select('id')
      .limit(1)
      .single()
    if (carreraError) {
      throw new Error('Failed to fetch carrera: ' + carreraError.message)
    }
    if (!carrera) throw new Error('No carrera found')

    const datosBasicos = {
      nombrePlan: 'Plan de estudios de Ingeniería en Sistemas Computacionales',
      carreraId: carrera.id,
      nivel: 'Licenciatura',
      tipoCiclo: 'Semestre', // important: normalizes to "Semestre"
      numCiclos: 8,
    }

    const { data, error } = await client.functions.invoke('ai_generate_plan', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: { datosBasicos },
    })

    if (error) throw new Error('Invoke failed: ' + error.message)
    assert(data, 'Expected data from function')

    // Top-level result
    assertEquals(data.ok, true)

    // `plan` (DB record)
    assert(typeof data.plan?.id === 'string')
    assertEquals(
      data.plan.nombre_display ?? data.plan.nombre,
      datosBasicos.nombrePlan,
    )
    assertEquals(data.plan.nivel, 'Licenciatura')
    assertEquals(data.plan.tipo_ciclo, 'Semestre')
    assertEquals(data.plan.numero_ciclos, datosBasicos.numCiclos)

    // `plan_datos` (normalized structured payload)
    assert(typeof data.plan_datos === 'object')
    assertEquals(data.plan_datos.nombre, datosBasicos.nombrePlan)
    assertEquals(data.plan_datos.nivel, 'Licenciatura')
    assertEquals(
      data.plan_datos.total_de_ciclos_del_plan_de_estudios,
      String(datosBasicos.numCiclos),
    )
    assertEquals(data.plan_datos.duracion_del_ciclo_escolar, '16') // Semestre -> 16
  },
)
/*
Deno.test("ai-structured (multipart + file)", async () => {
  const { client, accessToken } = await getAuthedClient();

  // Lee un PDF local (ajusta path)
  const bytes = await Deno.readFile("files/carta.pdf");
  const file = new File([bytes], "carta.pdf", { type: "application/pdf" });

  const payload = {
    response: { input: "Resume estos documentos en JSON.", model: "gpt-5" },
    structured: {
      type: "json_schema",
      name: "resumen",
      strict: true,
      schema: {
        type: "object",
        properties: { resumen: { type: "string" } },
        required: ["resumen"],
        additionalProperties: false,
      },
    },
    storage: { prefix: "tmp" },
  };

  const fd = new FormData();
  fd.append("payload", JSON.stringify(payload));
  fd.append("files", file);

  const { data, error } = await client.functions.invoke("ai-structured", {
    headers: {
      Authorization: `Bearer ${accessToken}`, // 👈 necesario
      // NO pongas Content-Type: fetch lo setea con boundary para FormData ✅
    },
    method: "POST",
    body: fd,
  });

  if (error) throw new Error("Invoke failed: " + error.message);
  assert(data, "Expected data from function");

  assertEquals(data.ok, true);
  assert(typeof data.output?.resumen === "string");
  assert(data.output.resumen.length > 0);

    // opcional: valida que registró upload(s) a OpenAI files
    assert(Array.isArray(data.references?.openaiFileIds));
});
 */
