import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import {
  buildAsignaturaUpdateJsonSchema,
  TIPO_ASIGNATURA_VALUES,
} from '../_shared/asignaturas-ai.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { registrarInteraccionIA } from '../_shared/interacciones-ia.ts'
import { OpenAIService } from '../_shared/openai-service.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

import type { Database, Json } from '../_shared/database.types.ts'
import type { StructuredResponseOptions } from '../_shared/openai-service.ts'

type BeforeUnloadWithDetail = Event & { detail?: { reason?: unknown } }

addEventListener('beforeunload', (ev: BeforeUnloadWithDetail) => {
  console.error('ALERTA: La función se va a apagar. Razón:', ev.detail?.reason)
})

const DatosUpdateSchema = z
  .object({
    id: z.string().uuid('id debe ser un UUID').optional(),

    // campos de asignatura (nombres coinciden con columnas DB)
    plan_estudio_id: z.string().uuid('plan_estudio_id debe ser un UUID'),
    estructura_id: z.string().uuid('estructura_id debe ser un UUID').optional(),
    nombre: z.string().min(1).optional(),
    codigo: z.union([z.string().min(1), z.literal(''), z.null()]).optional(),
    tipo: z.union([z.enum(TIPO_ASIGNATURA_VALUES), z.null()]).optional(),
    horas_academicas: z.number().int().nonnegative().nullable().optional(),
    horas_independientes: z.number().int().nonnegative().nullable().optional(),
    numero_ciclo: z.number().int().positive().nullable().optional(),
    linea_plan_id: z.string().uuid().nullable().optional(),
    orden_celda: z.number().int().nonnegative().nullable().optional(),
  })
  .strict()

const IAConfigSchema = z
  .object({
    descripcionEnfoqueAcademico: z.string().optional(),
    instruccionesAdicionalesIA: z.string().optional(),
    clonacionTradicional: z.boolean().optional().default(false),
    // Se reciben directamente IDs de OpenAI Files (no UUIDs de `archivos`).
    archivosReferencia: z.array(z.string().min(1)).optional().default([]),
    // IDs de vector stores de OpenAI (no UUID de Supabase).
    repositoriosIds: z.array(z.string().min(1)).optional().default([]),
  })
  .strict()
  .default({ archivosReferencia: [], repositoriosIds: [] })

const UnifiedJsonSchemaBase = z
  .object({
    datosUpdate: DatosUpdateSchema,
    iaConfig: IAConfigSchema,
  })
  .strict()

type EdgeAIGenerateSubjectUnifiedInput = z.infer<typeof UnifiedJsonSchemaBase>

const UnifiedJsonSchema = UnifiedJsonSchemaBase.superRefine(
  (val: EdgeAIGenerateSubjectUnifiedInput, ctx: z.RefinementCtx) => {
    // Si no hay id, es un insert => necesitamos campos mínimos
    if (!val.datosUpdate.id) {
      if (!val.datosUpdate.estructura_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['datosUpdate', 'estructura_id'],
          message: 'estructura_id es requerido para crear',
        })
      }
      if (!val.datosUpdate.nombre) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['datosUpdate', 'nombre'],
          message: 'nombre es requerido para crear',
        })
      }
    }
  },
)

type AsignaturaBaseSeleccionada = {
  id: string
  plan_estudio_id: string
  estructura_id: string | null
  nombre: string
  codigo: string | null
  tipo: Database['public']['Tables']['asignaturas']['Row']['tipo']
  horas_academicas: number | null
  horas_independientes: number | null
  numero_ciclo: number | null
  linea_plan_id: string | null
  orden_celda: number | null
  estado: Database['public']['Enums']['estado_asignatura']
}

// NOTE: Schema building for structured responses now lives in
// `../_shared/asignaturas-ai.ts` to keep it strongly typed and aligned with DB.

function ensureSchemaHasRequired(schemaDef: Record<string, unknown>) {
  const props = schemaDef['properties']
  if (!props || typeof props !== 'object' || Array.isArray(props)) return
  const keys = Object.keys(props)
  const prevReq = Array.isArray(schemaDef['required'])
    ? (schemaDef['required'] as Array<unknown>)
        .filter((k) => typeof k === 'string')
        .map(String)
    : []
  const set = new Set<string>([...prevReq, ...keys])
  schemaDef['required'] = Array.from(set)
}

function formatZodIssues(issues: Array<z.ZodIssue>): string {
  return issues
    .map((issue, i) => {
      const path = issue.path.length ? issue.path.join('.') : '(root)'
      return `${i + 1}. ${path}: ${issue.message}`
    })
    .join('\n')
}

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url)
  const functionName = url.pathname.split('/').pop()
  console.log(
    `[${new Date().toISOString()}][${functionName}]: Request received`,
  )

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const method = req.method
    if (method !== 'POST') {
      console.error(
        `[${new Date().toISOString()}][${functionName}]: Invalid method: ${method}`,
      )
      throw new HttpError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED', {
        method,
      })
    }

    const authHeaderRaw =
      req.headers.get('Authorization') ?? req.headers.get('authorization')
    if (!authHeaderRaw) {
      console.error(
        `[${new Date().toISOString()}][${functionName}]: Missing Authorization header`,
      )
      throw new HttpError(401, 'No autorizado.', 'UNAUTHORIZED', {
        reason: 'missing_authorization_header',
      })
    }

    const contentType = (req.headers.get('content-type') || '').toLowerCase()
    const isJson = contentType.includes('application/json')
    if (!isJson) {
      console.error(
        `[${new Date().toISOString()}][${functionName}]: Unsupported content type: ${contentType}`,
      )
      throw new HttpError(
        415,
        'Content-Type no soportado.',
        'UNSUPPORTED_MEDIA_TYPE',
        { contentType, expected: 'application/json' },
      )
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new HttpError(
        500,
        'Configuración del servidor incompleta.',
        'MISSING_ENV',
        {
          missing: [
            !SUPABASE_URL ? 'SUPABASE_URL' : null,
            !SUPABASE_ANON_KEY ? 'SUPABASE_ANON_KEY' : null,
          ].filter(Boolean),
        },
      )
    }

    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeaderRaw } },
    })

    const { data: userData, error: userErr } = await supabaseAnon.auth.getUser()
    if (userErr || !userData?.user) {
      throw new HttpError(401, 'Token inválido.', 'UNAUTHORIZED', {
        reason: userErr?.message ?? 'invalid_token',
      })
    }
    const user = userData.user

    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SERVICE_ROLE_KEY) {
      throw new HttpError(
        500,
        'Configuración del servidor incompleta.',
        'MISSING_ENV',
        { missing: ['SUPABASE_SERVICE_ROLE_KEY'] },
      )
    }

    const supabaseService = createClient<Database>(
      SUPABASE_URL,
      SERVICE_ROLE_KEY,
    )

    // Model names (override via environment variables)
    const AI_GENERATE_SUBJECT_UPDATE_MODELO =
      Deno.env.get('AI_GENERATE_SUBJECT_UPDATE_MODELO') ?? 'gpt-5-nano'
    const AI_GENERATE_SUBJECT_INSERT_MODELO =
      Deno.env.get('AI_GENERATE_SUBJECT_INSERT_MODELO') ?? 'gpt-5-nano'

    // -----------------------------
    // Unified JSON create/update flow (background)
    // -----------------------------
    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch (e) {
      throw new HttpError(400, 'Body JSON inválido.', 'INVALID_JSON', {
        cause: e,
      })
    }

    const parsedBody = UnifiedJsonSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      throw new HttpError(
        422,
        formatZodIssues(parsedBody.error.issues),
        'VALIDATION_ERROR',
        parsedBody.error,
      )
    }

    const payload: EdgeAIGenerateSubjectUnifiedInput = parsedBody.data
    const { datosUpdate, iaConfig } = payload
    const isUpdate = Boolean(datosUpdate.id)

    const svc = OpenAIService.fromEnv()
    if (!(svc instanceof OpenAIService)) {
      throw new HttpError(
        500,
        'Configuración del servidor incompleta.',
        'OPENAI_MISCONFIGURED',
        svc,
      )
    }

    // Resolve fields (merge for update)
    const selectCols =
      'id,plan_estudio_id,estructura_id,nombre,codigo,tipo,horas_academicas,horas_independientes,numero_ciclo,linea_plan_id,orden_celda,estado'

    let asignaturaBase: AsignaturaBaseSeleccionada | null = null

    if (isUpdate) {
      const { data, error } = await supabaseService
        .from('asignaturas')
        .select(selectCols)
        .eq('id', datosUpdate.id as string)
        .single()
      if (error) {
        const maybeCode = (error as { code?: string }).code
        if (maybeCode === 'PGRST116') {
          throw new HttpError(
            404,
            'No se encontró la asignatura.',
            'NOT_FOUND',
            { table: 'asignaturas', id: datosUpdate.id },
          )
        }
        throw new HttpError(
          500,
          'No se pudo obtener la asignatura.',
          'SUPABASE_QUERY_FAILED',
          error,
        )
      }
      asignaturaBase = data as unknown as AsignaturaBaseSeleccionada
    }

    const resolved = {
      id: datosUpdate.id ?? asignaturaBase?.id ?? null,
      plan_estudio_id: datosUpdate.plan_estudio_id,
      estructura_id:
        datosUpdate.estructura_id ?? asignaturaBase?.estructura_id ?? null,
      nombre: datosUpdate.nombre ?? asignaturaBase?.nombre ?? null,
      codigo: datosUpdate.codigo ?? asignaturaBase?.codigo ?? null,
      tipo: datosUpdate.tipo ?? asignaturaBase?.tipo ?? null,
      horas_academicas:
        datosUpdate.horas_academicas ??
        asignaturaBase?.horas_academicas ??
        null,
      horas_independientes:
        datosUpdate.horas_independientes ??
        asignaturaBase?.horas_independientes ??
        null,
      numero_ciclo:
        datosUpdate.numero_ciclo ?? asignaturaBase?.numero_ciclo ?? null,
      linea_plan_id:
        datosUpdate.linea_plan_id ?? asignaturaBase?.linea_plan_id ?? null,
      orden_celda:
        datosUpdate.orden_celda ?? asignaturaBase?.orden_celda ?? null,
    }

    if (!resolved.estructura_id) {
      throw new HttpError(
        422,
        'estructura_id es requerido.',
        'VALIDATION_ERROR',
        { estructura_id: resolved.estructura_id },
      )
    }
    if (!resolved.nombre) {
      throw new HttpError(422, 'nombre es requerido.', 'VALIDATION_ERROR', {
        nombre: resolved.nombre,
      })
    }

    // ---------------------------------
    // Referencias: OpenAI file IDs ya subidos.
    // ---------------------------------
    const openaiFileIds = iaConfig.archivosReferencia.filter((x: string) =>
      Boolean(x),
    )

    const vectorStoreIds = iaConfig.repositoriosIds.filter((x: string) =>
      Boolean(x),
    )

    // Crear/actualizar stub en estado 'generando'
    let asignaturaId: string
    if (isUpdate) {
      const tipoPatch =
        resolved.tipo != null
          ? ({ tipo: resolved.tipo } satisfies Pick<
              Database['public']['Tables']['asignaturas']['Update'],
              'tipo'
            >)
          : {}
      const updatePatch: Database['public']['Tables']['asignaturas']['Update'] =
        {
          estado: 'generando',
          tipo_origen: 'IA',
          plan_estudio_id: resolved.plan_estudio_id,
          estructura_id: resolved.estructura_id,
          nombre: resolved.nombre,
          codigo: resolved.codigo,
          horas_academicas: resolved.horas_academicas,
          horas_independientes: resolved.horas_independientes,
          numero_ciclo: resolved.numero_ciclo,
          linea_plan_id: resolved.linea_plan_id,
          orden_celda: resolved.orden_celda,
          ...tipoPatch,
          meta_origen: {
            generado_por: 'ai_generate_subject_unified',
            iaConfig: {
              descripcionEnfoqueAcademico:
                iaConfig.descripcionEnfoqueAcademico ?? null,
              instruccionesAdicionalesIA:
                iaConfig.instruccionesAdicionalesIA ?? null,
              archivosReferencia: iaConfig.archivosReferencia,
              repositoriosIds: iaConfig.repositoriosIds,
            },
          } as unknown as Json,
        }

      const { data, error } = await supabaseService
        .from('asignaturas')
        .update(updatePatch)
        .eq('id', resolved.id as string)
        .select('id')
        .single()
      if (error) {
        throw new HttpError(
          500,
          'No se pudo actualizar la asignatura (stub).',
          'SUPABASE_UPDATE_FAILED',
          error,
        )
      }
      asignaturaId = data.id
    } else {
      const tipoPatch =
        resolved.tipo != null
          ? ({ tipo: resolved.tipo } satisfies Pick<
              Database['public']['Tables']['asignaturas']['Insert'],
              'tipo'
            >)
          : {}
      const insertPatch: Database['public']['Tables']['asignaturas']['Insert'] =
        {
          plan_estudio_id: resolved.plan_estudio_id,
          estructura_id: resolved.estructura_id,
          nombre: resolved.nombre,
          codigo: resolved.codigo ?? null,
          ...tipoPatch,
          horas_academicas: resolved.horas_academicas ?? null,
          horas_independientes: resolved.horas_independientes ?? null,
          numero_ciclo: resolved.numero_ciclo ?? null,
          linea_plan_id: resolved.linea_plan_id ?? null,
          orden_celda: resolved.orden_celda ?? null,
          estado: 'generando',
          tipo_origen: 'IA',
          meta_origen: {
            generado_por: 'ai_generate_subject_unified',
            iaConfig: {
              descripcionEnfoqueAcademico:
                iaConfig.descripcionEnfoqueAcademico ?? null,
              instruccionesAdicionalesIA:
                iaConfig.instruccionesAdicionalesIA ?? null,
              archivosReferencia: iaConfig.archivosReferencia,
              repositoriosIds: iaConfig.repositoriosIds,
            },
          } as unknown as Json,
        }

      const { data, error } = await supabaseService
        .from('asignaturas')
        .insert(insertPatch)
        .select('id')
        .single()
      if (error) {
        const maybeCode = (error as { code?: string }).code
        const status = maybeCode ? 409 : 500
        throw new HttpError(
          status,
          'No se pudo crear la asignatura (stub).',
          'SUPABASE_INSERT_FAILED',
          { ...error, code: maybeCode },
        )
      }
      asignaturaId = data.id
    }

    const { data: estructura, error: estructuraError } = await supabaseService
      .from('estructuras_asignatura')
      .select('id,nombre,definicion')
      .eq('id', resolved.estructura_id)
      .single()
    if (estructuraError) {
      const maybeCode = (estructuraError as { code?: string }).code
      if (maybeCode === 'PGRST116') {
        throw new HttpError(
          404,
          'No se encontró la estructura de la asignatura.',
          'NOT_FOUND',
          { table: 'estructuras_asignatura', id: resolved.estructura_id },
        )
      }
      throw new HttpError(
        500,
        'No se pudo obtener la estructura de la asignatura.',
        'SUPABASE_QUERY_FAILED',
        estructuraError,
      )
    }

    const schemaForAI = buildAsignaturaUpdateJsonSchema({
      definicion: estructura.definicion,
      clonacionTradicional: iaConfig.clonacionTradicional,
    })

    // Determine model + input. IMPORTANT: clonacionTradicional uses a dedicated
    // refusal pattern (analisis_documento/refusal) and must not mix prompts with
    // the normal generations.
    let modelToUse = isUpdate
      ? AI_GENERATE_SUBJECT_UPDATE_MODELO
      : AI_GENERATE_SUBJECT_INSERT_MODELO

    let inputForAI: StructuredResponseOptions['input']

    if (iaConfig.clonacionTradicional) {
      modelToUse = 'gpt-4o-mini'

      // Prompts estilo clonación de plan (extractor + refusal gatekeeper), adaptados a asignaturas.
      const systemPromptClone = `Eres un extractor de datos altamente preciso. Tu único objetivo es volcar información de un documento adjunto hacia un formato estructurado JSON. Eres un puente de transferencia de información, no un redactor.

Reglas de Extracción:
1. Validación Estricta del Documento (Gatekeeper): evalúa si el documento corresponde a una ASIGNATURA (p.ej. programa, carta descriptiva, syllabus). Si el documento trata de cualquier otro tema (por ejemplo, manuales técnicos, presentaciones generales, artículos sin relación, material administrativo), ESTÁ ESTRICTAMENTE PROHIBIDO extraer información. En su lugar, debes llenar ÚNICAMENTE el campo "refusal" con el motivo (ej. "El documento es una presentación sobre redes, no un programa de asignatura") y dejar todos los demás campos vacíos o nulos.
2. Copia Textual (Verbatim): Extrae el contenido del documento y cópialo de manera EXACTA. Está estrictamente prohibido parafrasear, resumir, alucinar información o modificar la redacción original.
3. Mapeo Inteligente de Campos: Relaciona las secciones del documento con los campos de la estructura esperada basándote en similitud semántica.
4. Manejo de Ausencias: Si un campo de la estructura esperada no existe en el documento adjunto o no hay un equivalente claro, déjalo vacío (string vacío, null, o array vacío según el esquema). Si el campo es un listado cerrado (enum) y es obligatorio, selecciona la opción que tenga más sentido lógico. Nunca inventes información para rellenar vacíos.

Reglas de Formato (Aplicables al contenido extraído):
1. Estilo Visual: Redacta el contenido exclusivamente para visualización en texto plano (estilo 'white-space: pre-wrap').
2. Estructura Vertical: Utiliza saltos de línea explícitos (\\n) para romper líneas y doble salto de línea (\\n\\n) para separar párrafos.
3. Indentación Estricta: Usa exactamente 2 espacios para la indentación jerárquica. No uses tabuladores.
4. Listas: Utiliza un guion seguido de un espacio ("- ") para los elementos de lista.
5. Prohibiciones: No incluyas etiquetas HTML, sintaxis Markdown (asteriscos, numerales, etc.) ni caracteres de escape literales visibles en el texto final. Asegúrate de que el JSON final contenga saltos de línea válidos ('\\n') y no texto escapado.`

      const userPromptClone = `Clonar ASIGNATURA a partir del Word o PDF adjunto. Requisitos:\n- Primero llena 'analisis_documento' y después 'refusal'.\n- Si el documento NO es un programa/carta descriptiva de asignatura, escribe el motivo exacto en 'refusal' y deja el resto vacío o nulo.\n- Si sí es válido, deja 'refusal' vacío y completa los demás campos respetando el contenido del documento.\n- IMPORTANTE: Los campos de texto que NO son columnas de la tabla van dentro del objeto 'datos'. Las columnas (por ejemplo: codigo, contenido_tematico, criterios_de_evaluacion, etc.) van al nivel superior según el schema.\n- Conserva saltos de línea dentro de strings como \\n.\n- El nombre de la institución/universidad (si se pide) es Universidad La Salle México`

      const userContentClone =
        openaiFileIds.length > 0
          ? [
              ...openaiFileIds.map((id) => ({
                type: 'input_file' as const,
                file_id: id,
              })),
              {
                type: 'input_text' as const,
                text: userPromptClone,
              },
            ]
          : userPromptClone

      inputForAI = [
        { role: 'system', content: systemPromptClone },
        { role: 'user', content: userContentClone },
      ]
      // Ensure schema has required keys for OpenAI
      ensureSchemaHasRequired(schemaForAI)
    } else {
      const systemPromptNormal =
        `Eres un asistente experto en diseño curricular. ` +
        `Responde únicamente con JSON válido que cumpla estrictamente el JSON Schema proporcionado. ` +
        `Las propiedades que no correspondan a columnas DB deben ir dentro del objeto 'datos'.`

      const archivosReferenciaTexto = openaiFileIds.length
        ? `\n- Archivos de referencia: ${openaiFileIds.length}`
        : ''

      const mathRules: Array<string> = []
      if (
        typeof resolved.horas_academicas === 'number' &&
        Number.isFinite(resolved.horas_academicas) &&
        resolved.horas_academicas >= 0
      ) {
        mathRules.push(
          `- Si generas el 'contenido_tematico', la suma total de las 'horasEstimadas' de todos los temas en todas las unidades DEBE coincidir exactamente con el total de Horas académicas indicadas arriba (${resolved.horas_academicas}). No te pases ni te falten horas.`,
        )
      }
      mathRules.push(
        `- Si generas los 'criterios_de_evaluacion', la suma total de los 'porcentajes' de todos los criterios DEBE ser exactamente 100%. No te pases ni te falten porcentajes.`,
      )

      const creditosCalculados =
        Math.floor(
          ((resolved.horas_academicas ?? 0) +
            (resolved.horas_independientes ?? 0)) /
            16 *
            100,
        ) / 100

      const userPrompt =
        `Genera un borrador completo de una ASIGNATURA con base en lo siguiente:\n` +
        `- Nombre de la asignatura: ${resolved.nombre}\n` +
        `- Código (clave de la asignatura): ${
          resolved.codigo ?? '(no especificado)'
        }\n` +
        `- Tipo: ${resolved.tipo ?? '(no especificado)'}\n` +
        `- Horas académicas: ${
          resolved.horas_academicas ?? '(no especificado)'
        }\n` +
        `- Horas independientes: ${
          resolved.horas_independientes ?? '(no especificado)'
        }\n` +
        `- Créditos (calculado automáticamente): ${creditosCalculados.toFixed(2)}\n` +
        `- Descripción del enfoque académico (sobre el contenido de la respuesta generada): ${
          iaConfig.descripcionEnfoqueAcademico ?? '(ninguna)'
        }\n` +
        `- Instrucciones adicionales (sobre el formato de la respuesta generada): ${
          iaConfig.instruccionesAdicionalesIA ?? '(ninguna)'
        }` +
        archivosReferenciaTexto +
        `\n\nREGLAS ESTRICTAS MATEMÁTICAS:\n` +
        mathRules.join('\n')

      const userContentNormal =
        openaiFileIds.length > 0
          ? [
              ...openaiFileIds.map((id) => ({
                type: 'input_file' as const,
                file_id: id,
              })),
              {
                type: 'input_text' as const,
                text: `Usa estos archivos como referencia.\n\n${userPrompt}`,
              },
            ]
          : userPrompt

      inputForAI = [
        { role: 'system', content: systemPromptNormal },
        { role: 'user', content: userContentNormal },
      ]
      ensureSchemaHasRequired(schemaForAI)
    }

    console.log(
      `[${new Date().toISOString()}][${functionName}]: schemaForAI:\n${JSON.stringify(
        schemaForAI,
        null,
        2,
      )}`,
    )

    const aiStructuredPayload: StructuredResponseOptions = {
      model: modelToUse,
      background: true,
      metadata: {
        tabla: 'asignaturas',
        accion: isUpdate ? 'actualizar' : 'crear',
        id: asignaturaId,
        clonacionTradicional: iaConfig.clonacionTradicional ? 'true' : 'false',
      },
      tools: vectorStoreIds.length
        ? [
            {
              type: 'file_search',
              vector_store_ids: vectorStoreIds,
            },
          ]
        : undefined,
      input: inputForAI,
      text: {
        format: {
          type: 'json_schema',
          name: 'asignatura_contenido_tematico',
          schema: schemaForAI,
          strict: true,
        },
      },
    }

    // Se elimina el segundo parámetro
    const aiResult = await svc.createStructuredResponse(aiStructuredPayload)
    if (!aiResult.ok) {
      const status = aiResult.code === 'MissingEnv' ? 500 : 502
      throw new HttpError(
        status,
        'No se pudo iniciar la generación de la asignatura con IA.',
        'OPENAI_REQUEST_FAILED',
        aiResult,
      )
    }

    await registrarInteraccionIA(supabaseService, {
      usuarioId: user.id,
      asignaturaId,
      tipo: 'GENERAR',
      modelo: aiStructuredPayload.model,
      openaiFileIds,
      vectorStoreIds,
    })

    console.log(
      `[${new Date().toISOString()}][${functionName}]: Subject generation started in background`,
    )
    return sendSuccess({
      id: asignaturaId,
      estado: 'generando',
      openai: { responseId: aiResult.responseId },
    })
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(
        `[${new Date().toISOString()}][${functionName}] ⚠️ Handled Error:`,
        {
          message: error.message,
          code: error.code,
          internalDetails: error.internalDetails || 'N/A',
        },
      )

      return sendError(error.status, error.message, error.code)
    }

    const unexpectedError =
      error instanceof Error ? error : new Error(String(error))

    console.error(
      `[${new Date().toISOString()}][${functionName}] 💥 CRITICAL UNHANDLED ERROR:`,
      unexpectedError.stack || unexpectedError.message,
    )

    return sendError(
      500,
      'Ocurrió un error inesperado en el servidor.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
