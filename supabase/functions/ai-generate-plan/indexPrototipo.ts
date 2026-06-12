// supabase/functions/ai_generate_plan/index.ts
/// <reference lib="deno.window" />
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** ----------------- LOGGING HELPERS (diagnóstico) ----------------- */
function nowIso() {
  return new Date().toISOString()
}

function redactAuthHeader(v: string | null) {
  if (!v) return null
  const parts = v.split(' ')
  if (parts.length >= 2) return `${parts[0]} [REDACTED]`
  return '[REDACTED]'
}

function safePreview(val: unknown, maxLen = 1400) {
  try {
    const jsonStr = JSON.stringify(val, (k, v) => {
      if (typeof v === 'string') {
        if (v.length > 800) return v.slice(0, 800) + '…[TRUNCATED]'
        if (v.startsWith('data:') && v.includes(';base64,')) {
          return '[DATA_URL_REDACTED]'
        }
      }
      return v
    })
    if (!jsonStr) return String(val)
    return jsonStr.length > maxLen
      ? jsonStr.slice(0, maxLen) + '…[TRUNCATED]'
      : jsonStr
  } catch {
    return String(val)
  }
}

function headersSnapshot(req: Request) {
  const h: Record<string, string> = {}
  for (const [k, v] of req.headers.entries()) {
    if (k.toLowerCase() === 'authorization') h[k] = redactAuthHeader(v) ?? ''
    else h[k] = v
  }
  return h
}

function normalizeNivel(raw: string): string {
  const s = (raw ?? '').trim().toLowerCase()
  if (!s) return 'Otro'
  if (s === 'licenciatura' || s === 'lic') return 'Licenciatura'
  if (s === 'maestria' || s === 'maestría' || s === 'msc') return 'Maestría'
  if (s === 'doctorado' || s === 'phd') return 'Doctorado'
  if (s === 'especialidad') return 'Especialidad'
  if (s === 'diplomado') return 'Diplomado'
  return 'Otro'
}

function normalizeTipoCiclo(raw: string): string {
  const s = (raw ?? '').trim().toLowerCase()
  if (!s) return 'Otro'
  if (
    s === 'semestre' ||
    s === 'semestres' ||
    s === 'sem' ||
    s === 'semestre(s)' ||
    s === 'semestre' ||
    s === 'semestre' ||
    s === 'semestre'
  )
    return 'Semestre'
  if (s === 'cuatrimestre' || s === 'cuatrimestres' || s === 'cuatri') {
    return 'Cuatrimestre'
  }
  if (s === 'trimestre' || s === 'trimestres' || s === 'trim') {
    return 'Trimestre'
  }
  // si viene en mayúsculas tipo frontend
  if (s === 'semestre' || s === 'semestre'.toLowerCase()) return 'Semestre'
  if (s === 'cuatrimestre' || s === 'cuatrimestre'.toLowerCase()) {
    return 'Cuatrimestre'
  }
  if (s === 'trimestre' || s === 'trimestre'.toLowerCase()) return 'Trimestre'
  if (s === 'otro') return 'Otro'
  // variantes comunes
  if (s === 'semestre'.toLowerCase()) return 'Semestre'
  if (s === 'cuatrimestre'.toLowerCase()) return 'Cuatrimestre'
  if (s === 'trimestre'.toLowerCase()) return 'Trimestre'
  // si llega como SEMESTRE / CUATRIMESTRE / TRIMESTRE
  if (s === 'semestre'.toLowerCase()) return 'Semestre'
  if (s === 'cuatrimestre'.toLowerCase()) return 'Cuatrimestre'
  if (s === 'trimestre'.toLowerCase()) return 'Trimestre'
  // fallback
  return 'Otro'
}

function suggestedWeeksFor(tipoCiclo: string) {
  switch (tipoCiclo) {
    case 'Semestre':
      return '16'
    case 'Cuatrimestre':
      return '16'
    case 'Trimestre':
      return '12'
    default:
      return '16'
  }
}

function buildPrompt(params: {
  datosBasicos: any
  carrera?: any
  estructura?: any
  iaConfig?: any
}) {
  const { datosBasicos, carrera, estructura, iaConfig } = params

  const nombrePlan = String(datosBasicos?.nombrePlan ?? '').trim()
  const nivel = normalizeNivel(String(datosBasicos?.nivel ?? ''))
  const tipoCiclo = normalizeTipoCiclo(String(datosBasicos?.tipoCiclo ?? ''))
  const numCiclos = Number(datosBasicos?.numCiclos ?? 0) || 0

  const semanas = suggestedWeeksFor(tipoCiclo)

  const carreraTxt = carrera
    ? `Carrera: ${carrera?.nombre ?? ''} (id: ${
        carrera?.id ?? ''
      })\nFacultad: ${
        carrera?.facultades?.nombre ?? carrera?.facultad?.nombre ?? ''
      }`
    : ''

  const system = [
    'Eres un experto en diseño curricular (México) y redacción institucional.',
    'Debes generar SOLO JSON válido que cumpla EXACTAMENTE el schema (sin campos extra).',
    'Usa español neutro y redacción formal. Si un campo es opcional y no aplica, usa null.',
    'Respeta enumeraciones (p.ej. modalidad_educativa, diseno_curricular).',
    'Asegura consistencia interna entre nivel, fines, perfiles y área de estudio.',
    'La carga_horaria_a_la_semana NO debe exceder 50.',
  ].join(' ')

  const user = [
    'Genera un borrador completo del PLAN DE ESTUDIOS con base en lo siguiente:',
    '',
    '== Datos básicos (NO los cambies) ==',
    `- nivel: ${nivel}`,
    `- nombre: ${nombrePlan}`,
    `- tipo de ciclo: ${tipoCiclo}`,
    `- número de ciclos: ${numCiclos}`,
    `- duración sugerida del ciclo escolar (semanas efectivas): ${semanas}`,
    '',
    carreraTxt ? `== Contexto institucional ==\n${carreraTxt}\n` : '',
    '== Enfoque / Población / Notas ==',
    `- descripcionEnfoque: ${iaConfig?.descripcionEnfoque ?? ''}`,
    `- notasAdicionales: ${iaConfig?.notasAdicionales ?? ''}`,
    '',
    '== Reglas adicionales ==',
    '- Alinea: fines_de_aprendizaje_o_formacion ↔ perfil_de_egreso ↔ area_de_estudio.',
    `- total_de_ciclos_del_plan_de_estudios debe ser \"${String(
      numCiclos,
    )}\" (string).`,
    `- duracion_del_ciclo_escolar debe ser \"${semanas}\" (string).`,
    "- diseno_curricular: elige 'Rígido' o 'Flexible' coherente con la administración.",
    "- Si modalidad_educativa es 'No escolarizada' o 'Mixta', llena justificacion_de_la_propuesta_curricular; si es 'Escolar', puede ser null.",
    '- clave_del_plan_de_estudios: genera una clave administrativa verosímil (p.ej. 2026-XXX-YYY).',
    '',
    'Entrega únicamente el JSON final (sin Markdown, sin explicación).',
  ].join('\n')

  return {
    system,
    user,
    computed: { nivel, tipoCiclo, numCiclos, semanas, nombrePlan },
  }
}

Deno.serve(async (req) => {
  const cid = crypto.randomUUID()
  const t0 = performance.now()

  const log = (msg: string, extra?: unknown) => {
    if (extra !== undefined) {
      console.log(
        `[${nowIso()}][ai_generate_plan][${cid}] ${msg}`,
        safePreview(extra),
      )
    } else {
      console.log(`[${nowIso()}][ai_generate_plan][${cid}] ${msg}`)
    }
  }

  const warn = (msg: string, extra?: unknown) => {
    if (extra !== undefined) {
      console.warn(
        `[${nowIso()}][ai_generate_plan][${cid}] ⚠️ ${msg}`,
        safePreview(extra),
      )
    } else {
      console.warn(`[${nowIso()}][ai_generate_plan][${cid}] ⚠️ ${msg}`)
    }
  }

  const errlog = (msg: string, extra?: unknown) => {
    if (extra !== undefined) {
      console.error(
        `[${nowIso()}][ai_generate_plan][${cid}] ❌ ${msg}`,
        safePreview(extra),
      )
    } else {
      console.error(`[${nowIso()}][ai_generate_plan][${cid}] ❌ ${msg}`)
    }
  }

  if (req.method === 'OPTIONS') {
    log('OPTIONS preflight ✅', {
      method: req.method,
      url: req.url,
      headers: headersSnapshot(req),
    })
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    warn('Method not allowed', { method: req.method })
    return json({ ok: false, error: 'Method not allowed', cid }, 405)
  }

  log('START 🚀', { method: req.method, url: req.url })
  log('Headers snapshot 🧾', headersSnapshot(req))

  try {
    // 1) Auth requerido ✅
    log('Step 1: Auth check 🔐')
    const authHeaderRaw =
      req.headers.get('Authorization') ?? req.headers.get('authorization')
    log('Authorization header present?', {
      present: Boolean(authHeaderRaw),
      value: redactAuthHeader(authHeaderRaw),
    })

    if (!authHeaderRaw) {
      warn('Missing Authorization header')
      return json(
        { ok: false, error: 'Missing Authorization header', cid },
        401,
      )
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    log('Env presence (Supabase) 🌍', {
      hasSUPABASE_URL: Boolean(SUPABASE_URL),
      hasSUPABASE_ANON_KEY: Boolean(SUPABASE_ANON_KEY),
    })

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      errlog('Missing SUPABASE_URL / SUPABASE_ANON_KEY')
      return json(
        { ok: false, error: 'Missing SUPABASE_URL / SUPABASE_ANON_KEY', cid },
        500,
      )
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeaderRaw } },
    })

    const tAuth = performance.now()
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser()
    log('Supabase auth.getUser() done ⏱️', {
      ms: Math.round(performance.now() - tAuth),
    })

    if (userErr || !userData?.user) {
      warn('Invalid token', { userErr: userErr?.message ?? userErr ?? null })
      return json({ ok: false, error: 'Invalid token', cid }, 401)
    }

    const user = userData.user
    log('Authenticated user ✅', {
      userId: user.id,
      email: user.email ?? null,
    })

    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    log('Env presence (service role) 🗝️', {
      hasSERVICE_ROLE: Boolean(SERVICE_ROLE),
    })

    const supabaseAdmin = SERVICE_ROLE
      ? createClient(SUPABASE_URL, SERVICE_ROLE)
      : supabaseUser

    log('Supabase client selected 🧩', { adminMode: Boolean(SERVICE_ROLE) })

    // 2) Parse body 🧾
    log('Step 2: Parse body 🧾')
    let payload: any = {}
    const tParse = performance.now()
    try {
      payload = await req.json()
    } catch (e) {
      errlog('Invalid JSON body', {
        error: (e as Error)?.message ?? String(e),
      })
      return json({ ok: false, error: 'Invalid JSON body', cid }, 400)
    }
    log('Body parsed ⏱️', { ms: Math.round(performance.now() - tParse) })
    log('Payload preview', {
      keys: Object.keys(payload ?? {}),
      payload: payload ? { ...payload, iaConfig: undefined } : null,
    })

    const datosBasicos = payload?.datosBasicos ?? payload?.input?.datosBasicos
    const iaConfig = payload?.iaConfig ?? payload?.input?.iaConfig ?? {}

    if (
      !datosBasicos?.nombrePlan ||
      !datosBasicos?.carreraId ||
      !datosBasicos?.nivel ||
      !datosBasicos?.tipoCiclo ||
      !datosBasicos?.numCiclos
    ) {
      warn('Missing required datosBasicos fields', { datosBasicos })
      return json(
        {
          ok: false,
          error:
            'Missing required fields in datosBasicos (nombrePlan,carreraId,nivel,tipoCiclo,numCiclos).',
          cid,
        },
        400,
      )
    }

    // 3) Asegura usuarios_app (por FK en logs) 👤
    log('Step 3: Ensure usuarios_app row 👤')
    const tUserUpsert = performance.now()
    const upsertUser = {
      id: user.id,
      email: user.email ?? null,
      nombre_completo:
        (user.user_metadata as any)?.full_name ??
        (user.user_metadata as any)?.name ??
        null,
    }
    const { error: upsertErr } = await supabaseAdmin
      .from('usuarios_app')
      .upsert(upsertUser, { onConflict: 'id' })
    log('usuarios_app upsert done ⏱️', {
      ms: Math.round(performance.now() - tUserUpsert),
      ok: !upsertErr,
    })
    if (upsertErr) {
      errlog('usuarios_app upsert failed', { message: upsertErr.message })
      return json(
        {
          ok: false,
          error: 'usuarios_app upsert failed',
          details: upsertErr.message,
          cid,
        },
        500,
      )
    }

    // 4) Trae carrera + facultad (contexto prompt) 🎓
    log('Step 4: Fetch carrera/facultad 🎓')
    const carreraId = datosBasicos.carreraId
    const tCarr = performance.now()
    const { data: carrera, error: carreraErr } = await supabaseAdmin
      .from('carreras')
      .select('id,nombre,facultad_id,facultades(id,nombre,nombre_corto)')
      .eq('id', carreraId)
      .maybeSingle()
    log('Carrera fetch done ⏱️', {
      ms: Math.round(performance.now() - tCarr),
      found: Boolean(carrera),
      carreraId,
    })
    if (carreraErr) {
      warn('Carrera fetch error (continuing)', { message: carreraErr.message })
    }

    // 5) Resolver estructura (schema) desde estructuras_plan.definicion 🧩
    log('Step 5: Resolve estructura_plan 🧩')
    const estructuraIdFromPayload =
      datosBasicos?.estructuraId ?? payload?.estructuraId ?? null

    let estructura: any = null
    const tEst = performance.now()

    if (estructuraIdFromPayload) {
      log('Using estructuraId from payload', { estructuraIdFromPayload })
      const { data, error } = await supabaseAdmin
        .from('estructuras_plan')
        .select('id,nombre,tipo,template_id,definicion')
        .eq('id', estructuraIdFromPayload)
        .single()
      if (error) {
        errlog('estructuraId provided but not found', {
          message: error.message,
          estructuraIdFromPayload,
        })
        return json(
          {
            ok: false,
            error: 'estructuraId not found',
            details: error.message,
            cid,
          },
          400,
        )
      }
      estructura = data
    } else {
      // default: la más reciente tipo CURRICULAR, si no existe, la más reciente en general
      const { data, error } = await supabaseAdmin
        .from('estructuras_plan')
        .select('id,nombre,tipo,template_id,definicion')
        .eq('tipo', 'CURRICULAR')
        .order('actualizado_en', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        warn('Error fetching CURRICULAR estructura (fallback to any)', {
          message: error.message,
        })
      }
      if (data) estructura = data

      if (!estructura) {
        const { data: anyE, error: anyErr } = await supabaseAdmin
          .from('estructuras_plan')
          .select('id,nombre,tipo,template_id,definicion')
          .order('actualizado_en', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (anyErr) {
          errlog('No estructuras_plan found', { message: anyErr.message })
          return json(
            {
              ok: false,
              error: 'No estructuras_plan found',
              details: anyErr.message,
              cid,
            },
            500,
          )
        }
        estructura = anyE
      }
    }

    log('Estructura resolved ⏱️', {
      ms: Math.round(performance.now() - tEst),
      estructuraId: estructura?.id ?? null,
      nombre: estructura?.nombre ?? null,
      tipo: estructura?.tipo ?? null,
      template_id: estructura?.template_id ?? null,
      definicionKeys: estructura?.definicion
        ? Object.keys(estructura.definicion)
        : null,
    })

    if (!estructura?.definicion) {
      errlog('estructuras_plan.definicion missing', {
        estructuraId: estructura?.id ?? null,
      })
      return json(
        {
          ok: false,
          error: 'estructuras_plan.definicion missing',
          cid,
        },
        500,
      )
    }

    // 6) Resolver referencias (archivos / repositorios) 📎
    log('Step 6: Resolve references 📎')
    const archivosReferenciaIds: string[] = Array.isArray(
      iaConfig?.archivosReferencia,
    )
      ? iaConfig.archivosReferencia
      : []
    const repositoriosIds: string[] = Array.isArray(iaConfig?.repositoriosIds)
      ? iaConfig.repositoriosIds
      : []

    log('Reference IDs received', {
      archivosReferenciaIdsCount: archivosReferenciaIds.length,
      repositoriosIdsCount: repositoriosIds.length,
      usarMCP: Boolean(iaConfig?.usarMCP),
    })

    const archivosInfo: any[] = []
    const vectorInfo: any[] = []

    if (archivosReferenciaIds.length) {
      const { data, error } = await supabaseAdmin
        .from('archivos')
        .select('id,nombre,mime_type,openai_file_id,ruta_storage')
        .in('id', archivosReferenciaIds)
      if (error) {
        warn('archivos lookup failed (continuing)', { message: error.message })
      }
      for (const a of data ?? []) archivosInfo.push(a)
    }

    if (repositoriosIds.length) {
      const { data, error } = await supabaseAdmin
        .from('vector_stores')
        .select('id,nombre,openai_vector_id')
        .in('id', repositoriosIds)
      if (error) {
        warn('vector_stores lookup failed (continuing)', {
          message: error.message,
        })
      }
      for (const v of data ?? []) vectorInfo.push(v)
    }

    const openaiFileIds: string[] = archivosInfo
      .map((a) => a?.openai_file_id)
      .filter((x) => typeof x === 'string' && x.length > 0)
    const vectorStoreIds: string[] = vectorInfo
      .map((v) => v?.openai_vector_id)
      .filter((x) => typeof x === 'string' && x.length > 0)

    const rutasStorage: string[] = archivosInfo
      .map((a) => a?.ruta_storage)
      .filter((x) => typeof x === 'string' && x.length > 0)

    log('Resolved reference OpenAI IDs', {
      openaiFileIdsCount: openaiFileIds.length,
      vectorStoreIdsCount: vectorStoreIds.length,
      rutasStorageCount: rutasStorage.length,
    })

    // 7) Construye prompt + structured wrapper 🧠
    log('Step 7: Build prompt + structured schema 🧠')
    const {
      system,
      user: userPrompt,
      computed,
    } = buildPrompt({
      datosBasicos,
      carrera,
      estructura,
      iaConfig,
    })

    // definicion en DB puede venir como (schema) o como (format). Normalizamos.
    let structured: any = null
    const definicion = estructura.definicion

    if (definicion?.type === 'json_schema' && definicion?.schema) {
      structured = definicion
    } else if (
      definicion?.format?.type === 'json_schema' &&
      definicion?.format?.schema
    ) {
      structured = definicion
    } else {
      structured = {
        type: 'json_schema',
        name: 'plan_datos',
        strict: true,
        schema: definicion,
      }
    }

    log('Structured wrapper summary', {
      type: structured?.type ?? null,
      name: structured?.name ?? null,
      strict: structured?.strict ?? null,
      hasSchema: Boolean(structured?.schema),
      schemaTopKeys: structured?.schema
        ? Object.keys(structured.schema).slice(0, 20)
        : null,
    })

    // 8) Llamar ai-structured (otra Edge Function) 🔁
    log('Step 8: Call ai-structured 🔁')
    const aiStructuredUrl = `${SUPABASE_URL}/functions/v1/ai-structured`

    const model =
      payload?.model ??
      payload?.openai?.model ??
      payload?.response?.model ??
      'gpt-5'

    const aiStructuredBody = {
      response: {
        model,
        input: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
      },
      structured,
      references: {
        openaiFileIds,
        vectorStoreIds,
        archivosReferenciaIds,
      },
      usarMCP: Boolean(iaConfig?.usarMCP),
    }

    log('ai-structured request snapshot 🧪', {
      url: aiStructuredUrl,
      model,
      inputChars: { system: system.length, user: userPrompt.length },
      openaiFileIdsCount: openaiFileIds.length,
      vectorStoreIdsCount: vectorStoreIds.length,
      usarMCP: Boolean(iaConfig?.usarMCP),
    })

    const tAi = performance.now()
    const aiResp = await fetch(aiStructuredUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeaderRaw,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(aiStructuredBody),
    })

    const aiJson = await aiResp.json().catch(() => null)

    log('ai-structured response received ⏱️', {
      ms: Math.round(performance.now() - tAi),
      status: aiResp.status,
      okHttp: aiResp.ok,
      ok: aiJson?.ok ?? null,
      aiCid: aiJson?.cid ?? null,
      responseId: aiJson?.responseId ?? null,
      conversationId: aiJson?.conversationId ?? null,
      outputParseError: aiJson?.outputParseError ?? null,
    })

    if (!aiResp.ok || !aiJson) {
      errlog('ai-structured HTTP failed', {
        status: aiResp.status,
        body: aiJson,
      })
      return json(
        {
          ok: false,
          error: 'ai-structured HTTP failed',
          status: aiResp.status,
          details: aiJson,
          cid,
        },
        500,
      )
    }

    if (!aiJson.ok || !aiJson.output) {
      errlog('ai-structured returned ok=false or missing output', { aiJson })
      // Aun así, registra interaccion_ia (sin plan) para auditoría
      const { data: inter, error: interErr } = await supabaseAdmin
        .from('interacciones_ia')
        .insert({
          usuario_id: user.id,
          plan_estudio_id: null,
          tipo: 'GENERAR',
          modelo: aiJson?.model ?? model,
          temperatura: null,
          prompt: {
            datosBasicos,
            iaConfig,
            estructura: {
              id: estructura.id,
              nombre: estructura.nombre,
              template_id: estructura.template_id,
              tipo: estructura.tipo,
            },
            request: aiStructuredBody,
            computed,
          },
          respuesta: aiJson,
          aceptada: false,
          conversacion_id: aiJson?.conversationId ?? null,
          ids_archivos: archivosReferenciaIds,
          ids_vector_store: repositoriosIds,
          rutas_storage: rutasStorage,
        })
        .select('id')
        .maybeSingle()

      if (interErr) {
        warn('interacciones_ia insert failed (error path)', {
          message: interErr.message,
        })
      }

      return json(
        {
          ok: false,
          error: 'AI generation failed (structured output invalid).',
          cid,
          ai: aiJson,
          interaccion_ia_id: inter?.id ?? null,
        },
        500,
      )
    }

    // 9) Normaliza/asegura campos clave del output ✅
    log('Step 9: Normalize output ✅')
    const output = aiJson.output as Record<string, any>

    // fuerza consistencia con datosBasicos
    output.nombre = computed.nombrePlan
    output.nivel = computed.nivel
    output.total_de_ciclos_del_plan_de_estudios = String(computed.numCiclos)
    output.duracion_del_ciclo_escolar = String(computed.semanas)

    // 10) Inserta log de IA (interacciones_ia) 🧾
    log('Step 10: Insert interacciones_ia 🧾')
    const tInter = performance.now()
    const { data: interaccion, error: interErr } = await supabaseAdmin
      .from('interacciones_ia')
      .insert({
        usuario_id: user.id,
        plan_estudio_id: null, // se linkea luego (cuando exista el plan)
        tipo: 'GENERAR',
        modelo: aiJson?.model ?? model,
        temperatura: null,
        prompt: {
          datosBasicos,
          iaConfig,
          estructura: {
            id: estructura.id,
            nombre: estructura.nombre,
            template_id: estructura.template_id,
            tipo: estructura.tipo,
          },
          request: aiStructuredBody,
          computed,
        },
        respuesta: aiJson,
        aceptada: true, // se está usando para crear el plan
        conversacion_id: aiJson?.conversationId ?? null,
        ids_archivos: archivosReferenciaIds,
        ids_vector_store: repositoriosIds,
        rutas_storage: rutasStorage,
      })
      .select('id')
      .single()

    log('interacciones_ia insert done ⏱️', {
      ms: Math.round(performance.now() - tInter),
      interaccionId: interaccion?.id ?? null,
      ok: !interErr,
    })

    if (interErr) {
      errlog('interacciones_ia insert failed', { message: interErr.message })
      return json(
        {
          ok: false,
          error: 'interacciones_ia insert failed',
          details: interErr.message,
          cid,
        },
        500,
      )
    }

    // 11) Crear plan (planes_estudio) 🏗️
    log('Step 11: Insert planes_estudio 🏗️')
    const nivelDB = normalizeNivel(String(datosBasicos?.nivel ?? ''))
    const tipoCicloDB = normalizeTipoCiclo(
      String(datosBasicos?.tipoCiclo ?? ''),
    )
    const numeroCiclosDB = Number(datosBasicos?.numCiclos ?? 0)

    // intenta setear estado BORRADOR si existe
    let estadoBorradorId: string | null = null
    try {
      const { data: estado } = await supabaseAdmin
        .from('estados_plan')
        .select('id,clave,orden')
        .ilike('clave', 'BORRADOR%')
        .order('orden', { ascending: true })
        .limit(1)
        .maybeSingle()
      estadoBorradorId = estado?.id ?? null
    } catch {
      // ignore
    }

    const tPlan = performance.now()
    const { data: plan, error: planErr } = await supabaseAdmin
      .from('planes_estudio')
      .insert({
        carrera_id: carreraId,
        estructura_id: estructura.id,
        nombre: computed.nombrePlan,
        nivel: nivelDB,
        tipo_ciclo: tipoCicloDB,
        numero_ciclos: numeroCiclosDB,
        datos: output,
        estado_actual_id: estadoBorradorId,
        activo: true,
        tipo_origen: 'IA',
        meta_origen: {
          generado_por: 'ai_generate_plan',
          cid,
          ai_structured: {
            cid: aiJson?.cid ?? null,
            responseId: aiJson?.responseId ?? null,
            conversationId: aiJson?.conversationId ?? null,
            model: aiJson?.model ?? model,
            usage: aiJson?.usage ?? null,
          },
          referencias: {
            archivosReferenciaIds,
            repositoriosIds,
            openaiFileIds,
            vectorStoreIds,
          },
          iaConfig: {
            descripcionEnfoque: iaConfig?.descripcionEnfoque ?? null,
            poblacionObjetivo: iaConfig?.poblacionObjetivo ?? null,
            notasAdicionales: iaConfig?.notasAdicionales ?? null,
            usarMCP: Boolean(iaConfig?.usarMCP),
          },
        },
        creado_por: user.id,
        actualizado_por: user.id,
      })
      .select(
        'id,nombre,nivel,tipo_ciclo,numero_ciclos,carrera_id,estructura_id,estado_actual_id,activo,tipo_origen,meta_origen,creado_por,actualizado_por,creado_en,actualizado_en,datos',
      )
      .single()

    log('planes_estudio insert done ⏱️', {
      ms: Math.round(performance.now() - tPlan),
      planId: plan?.id ?? null,
      ok: !planErr,
    })

    if (planErr) {
      errlog('planes_estudio insert failed', { message: planErr.message })
      return json(
        {
          ok: false,
          error: 'planes_estudio insert failed',
          details: planErr.message,
          cid,
        },
        500,
      )
    }

    // 12) Link interaccion_ia -> plan + historial (cambios_plan) 🧩
    log('Step 12: Link interaccion + insert cambios_plan 🧩')

    const { error: linkErr } = await supabaseAdmin
      .from('interacciones_ia')
      .update({ plan_estudio_id: plan.id })
      .eq('id', interaccion.id)

    if (linkErr) {
      warn('Could not link interaccion_ia to plan (continuing)', {
        message: linkErr.message,
      })
    }

    const { error: cambioErr } = await supabaseAdmin
      .from('cambios_plan')
      .insert({
        plan_estudio_id: plan.id,
        cambiado_por: user.id,
        tipo: 'ACTUALIZACION_CAMPO',
        campo: 'datos',
        valor_anterior: null,
        valor_nuevo: output,
        interaccion_ia_id: interaccion.id,
      })

    if (cambioErr) {
      warn('cambios_plan insert failed (continuing)', {
        message: cambioErr.message,
      })
    }

    // 13) (OPCIONAL) Generar materias automáticamente (dejado comentado) 📚
    // ---------------------------------------------------------------
    // const AUTO_GENERATE_SUBJECTS = false; // 👈 activar cuando decidas
    // const AUTO_SUBJECTS_COUNT = 10; // 👈 constante pedida (número de materias)
    // if (AUTO_GENERATE_SUBJECTS) {
    //   for (let i = 1; i <= AUTO_SUBJECTS_COUNT; i++) {
    //     // TODO: insertar en `asignaturas` con plan_estudio_id = plan.id
    //     // Recomendación: usar una estructura_asignatura default y llenar datos mínimos.
    //   }
    // }
    // ---------------------------------------------------------------

    log('RETURN ✅', {
      ok: true,
      planId: plan.id,
      interaccionIaId: interaccion.id,
      totalMs: Math.round(performance.now() - t0),
    })

    return json({
      ok: true,
      cid,
      plan,
      plan_datos: output,
      interaccion_ia_id: interaccion.id,
      ai: {
        cid: aiJson?.cid ?? null,
        responseId: aiJson?.responseId ?? null,
        conversationId: aiJson?.conversationId ?? null,
        model: aiJson?.model ?? model,
        usage: aiJson?.usage ?? null,
      },
      references: {
        archivosReferenciaIds,
        repositoriosIds,
        openaiFileIds,
        vectorStoreIds,
        rutasStorage,
      },
    })
  } catch (e) {
    errlog('Unhandled error 💥', {
      message: (e as Error)?.message ?? String(e),
      stack: (e as Error)?.stack ?? null,
      totalMs: Math.round(performance.now() - t0),
    })
    return json(
      { ok: false, error: (e as Error)?.message ?? String(e), cid },
      500,
    )
  }
})
