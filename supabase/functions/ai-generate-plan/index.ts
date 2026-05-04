// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { corsHeaders } from '../_shared/cors.ts'
import { OpenAIService } from '../_shared/openai-service.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

import { systemPrompt } from './prompts.ts'

import type { AIGeneratePlanInput } from './types.ts'
import type { Database, Json } from '../_shared/database.types.ts'
import type { StructuredResponseOptions } from '../_shared/openai-service.ts'
// Typed aliases for strict field unions.

type BeforeUnloadWithDetail = Event & { detail?: { reason?: unknown } }

// Re-registramos con tipo estricto (evita `any` en análisis)
addEventListener('beforeunload', (ev: BeforeUnloadWithDetail) => {
  console.error('ALERTA: La función se va a apagar. Razón:', ev.detail?.reason)
})

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
    if (!contentType.startsWith('multipart/form-data')) {
      console.error(
        `[${new Date().toISOString()}][${functionName}]: Unsupported content type: ${contentType}`,
      )
      throw new HttpError(
        415,
        'Content-Type no soportado.',
        'UNSUPPORTED_MEDIA_TYPE',
        { contentType },
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

    // If needed for RLS-protected reads, create an anon client with user's JWT
    // Currently not used; kept here for future expansion.
    // const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    //   global: {
    //     headers: {
    //       Authorization: authHeaderRaw,
    //     },
    //   },
    // });

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

    // Model name controlled via env var (single use)
    const AI_GENERATE_PLAN_MODELO =
      Deno.env.get('AI_GENERATE_PLAN_MODELO') ?? 'gpt-5-nano'

    const formData = await req.formData()
    const validation = parseAndValidate(formData)
    if (!validation.success) {
      console.error(
        `[${new Date().toISOString()}][${functionName}]: Validation errors:`,
        validation.errors,
      )
      const message = validation.errors
        .map((e, i) => `(${i + 1}) ${e}`)
        .join('\n')

      throw new HttpError(422, message, 'VALIDATION_ERROR', {
        errors: validation.errors,
      })
    }

    const payload: AIGeneratePlanInput = validation.data

    const { data: estructuraPlan, error: estructuraPlanError } =
      await supabaseService
        .from('estructuras_plan')
        .select('id,nombre,tipo,template_id,definicion')
        .eq('id', payload.datosBasicos.estructuraPlanId)
        .single()
    if (estructuraPlanError) {
      const maybeCode = (estructuraPlanError as { code?: string }).code
      if (maybeCode === 'PGRST116') {
        throw new HttpError(
          404,
          'No se encontró la estructura del plan.',
          'NOT_FOUND',
          {
            table: 'estructuras_plan',
            id: payload.datosBasicos.estructuraPlanId,
          },
        )
      }
      throw new HttpError(
        500,
        'No se pudo obtener la estructura del plan.',
        'SUPABASE_QUERY_FAILED',
        estructuraPlanError,
      )
    }

    const openaiFileIds = (payload.iaConfig.archivosReferencia ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    )

    const vectorStoreIds = (payload.iaConfig.repositoriosIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    )

    // CLONADO_TRADICIONAL: flujo síncrono, genera todas las columnas e inserta directamente
    if (payload.clonacionPlan) {
      if (openaiFileIds.length !== 1) {
        throw new HttpError(
          422,
          'Se requiere un único archivo de OpenAI',
          'ONE_FILE_REQUIRED',
        )
      }

      // Estados: se usará BORRADOR
      const { data: estadoBorr } = await supabaseService
        .from('estados_plan')
        .select('id,clave')
        .eq('clave', 'BORRADOR')
        .maybeSingle()
      if (!estadoBorr?.id) {
        throw new HttpError(
          500,
          'No se encontró el estado BORRADOR.',
          'MISSING_STATE',
          {
            clave: 'BORRADOR',
          },
        )
      }

      // Catálogo de carreras para que la IA seleccione la más cercana
      const { data: carrerasAll, error: carrerasErr } = await supabaseService
        .from('carreras')
        .select('id,nombre')
      if (carrerasErr) {
        throw new HttpError(
          500,
          'No se pudieron obtener las carreras.',
          'SUPABASE_QUERY_FAILED',
          carrerasErr,
        )
      }

      const carrerasList = (Array.isArray(carrerasAll) ? carrerasAll : []).map(
        (c) => ({
          id: String(c.id),
          nombre: String(c.nombre),
        }),
      )

      // Construcción de schema: datos = definicion; además pide columnas principales
      const datosSchema: Record<string, unknown> =
        typeof estructuraPlan.definicion === 'object' &&
        estructuraPlan.definicion !== null
          ? (estructuraPlan.definicion as Record<string, unknown>)
          : {}

      const fullPlanSchema = {
        type: 'object',
        additionalProperties: false,
        required: [
          'analisis_documento',
          'refusal',
          'nombre',
          'tipo_ciclo',
          'numero_ciclos',
          'carrera_id',
          'datos',
        ],
        properties: {
          analisis_documento: {
            type: 'string',
            description:
              'Paso 1: Analiza brevemente de qué trata el documento. Determina explícitamente si contiene una tira de materias, créditos y estructura académica, o si es un documento técnico/informativo diferente.',
          },
          refusal: {
            type: 'string',
            description:
              'Paso 2: Basado en el analisis_documento, si el texto NO es un plan de estudios, escribe aquí el motivo exacto del rechazo. Si sí es un plan válido, deja vacío este campo.',
          },
          nombre: {
            type: 'string',
            minLength: 1,
            description:
              'No debe incluir el nivel del plan. Por lo tanto no debe empezar con Licenciatura en, Ingeniería en, etc.',
          },
          tipo_ciclo: {
            type: 'string',
            enum: ['Semestre', 'Cuatrimestre', 'Trimestre', 'Otro'],
          },
          numero_ciclos: { type: 'integer', minimum: 1 },
          carrera_id: {
            type: 'string',
            minLength: 1,
            description:
              'Debe ser uno de los ids proporcionados en la lista de carreras.',
          },
          datos: datosSchema,
        },
      } as const

      const carrerasText = carrerasList
        .map((c) => `- ${c.nombre} (id: ${c.id})`)
        .join('\n')

      const systemPromptClone = `Eres un extractor de datos altamente preciso. Tu único objetivo es volcar información de un documento adjunto hacia un formato estructurado JSON. Eres un puente de transferencia de información, no un redactor.

Reglas de Extracción:
1. Validación Estricta del Documento (Gatekeeper): evalúa si el documento es genuinamente un Plan de Estudios. Un plan de estudios real DEBE contener elementos como: fines de aprendizaje, perfil de ingreso, modalidad, etc. Si no es un documento que describe un plan de estudios o si el documento trata de cualquier otro tema (por ejemplo, manuales técnicos, presentaciones, artículos), ESTÁ ESTRICTAMENTE PROHIBIDO extraer información. En su lugar, debes llenar ÚNICAMENTE el campo "refusal" con el motivo (ej. "El documento es una presentación sobre redes, no un plan de estudios") y dejar todos los demás campos vacíos o nulos.
2. Copia Textual (Verbatim): Extrae el contenido del documento y cópialo de manera EXACTA. Está estrictamente prohibido parafrasear, resumir, alucinar información o modificar la redacción original.
3. Mapeo Inteligente de Campos: Relaciona las secciones del documento con los campos de la estructura esperada basándote en similitud semántica. Por ejemplo, mapea "FIN DEL APRENDIZAJE" o "fines de aprendizaje" hacia el campo equivalente en el esquema (ej. "Fines de aprendizaje o formación").
4. Manejo de Ausencias: Si un campo de la estructura esperada no existe en el documento adjunto o no hay un equivalente claro, déjalo vacío (string vacío, null, o array vacío según el esquema). Si el campo es un listado cerrado (enum) y es obligatorio, selecciona la opción que tenga más sentido lógico. Nunca inventes información para rellenar vacíos.

Reglas de Formato (Aplicables al contenido extraído):
1. Estilo Visual: Redacta el contenido exclusivamente para visualización en texto plano (estilo 'white-space: pre-wrap').
2. Estructura Vertical: Utiliza saltos de línea explícitos (\\n) para romper líneas y doble salto de línea (\\n\\n) para separar párrafos.
3. Indentación Estricta: Usa exactamente 2 espacios para la indentación jerárquica. No uses tabuladores.
4. Listas: Utiliza un guion seguido de un espacio ("- ") para los elementos de lista.
5. Prohibiciones: No incluyas etiquetas HTML, sintaxis Markdown (asteriscos, numerales, etc.) ni caracteres de escape literales visibles en el texto final. Asegúrate de que el JSON final contenga saltos de línea válidos ('\\n') y no texto escapado.`
      
      const userPromptClone = `Clonar plan de estudios a partir del Word o pdf adjunto. Requisitos:
- Elegir 'carrera_id' de esta lista, seleccionando la más cercana por nombre:
${carrerasText}
- Generar 'nombre', 'nivel', 'tipo_ciclo', 'numero_ciclos' y 'datos' respetando el contenido del documento.
- El campo 'datos' debe seguir estrictamente el esquema provisto.
- El nombre de la institución/universidad (si se pide) es Universidad La Salle México`

      const svc = OpenAIService.fromEnv()
      if (!(svc instanceof OpenAIService)) {
        throw new HttpError(
          500,
          'Configuración de OpenAI incompleta.',
          'OPENAI_MISCONFIGURED',
          svc,
        )
      }

      const structuredPayload: StructuredResponseOptions = {
        model: 'gpt-4o-mini',
        background: false,
        input: [
          { role: 'system', content: systemPromptClone },
          {
            role: 'user',
            content: [
              { type: 'input_file', file_id: openaiFileIds[0] },
              { type: 'input_text', text: userPromptClone },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'plan_de_estudios_completo',
            schema: fullPlanSchema as unknown as Record<string, unknown>,
            strict: true,
          },
        },
      }

      const aiResultSync = await svc.createStructuredResponse<{
        nombre: string
        nivel: string
        tipo_ciclo: Database['public']['Tables']['planes_estudio']['Insert']['tipo_ciclo']
        numero_ciclos: number
        carrera_id: string
        datos: Json
      }>(structuredPayload)
      if (!aiResultSync.ok) {
        const status = aiResultSync.code === 'MissingEnv' ? 500 : 502
        throw new HttpError(
          status,
          'La IA no pudo generar el plan clonado.',
          'OPENAI_REQUEST_FAILED',
          aiResultSync,
        )
      }

      // Se espera que el servicio empaquete la salida json en aiResultSync.data
      const out = aiResultSync.output as {
        nombre: string
        nivel: string
        tipo_ciclo: Database['public']['Tables']['planes_estudio']['Insert']['tipo_ciclo']
        numero_ciclos: number
        carrera_id: string
        datos: Json
        refusal: string
      }

      if (out.refusal) {
        throw new HttpError(
          422,
          'La IA no pudo generar el plan.',
          'AI_GENERATION_FAILED',
          { refusal: out.refusal },
        )
      }

      const carreraOk = carrerasList.some((c) => c.id === out.carrera_id)
      if (!carreraOk) {
        throw new HttpError(
          422,
          'La IA devolvió una carrera_id no válida.',
          'INVALID_CARRERA_ID',
          {
            carrera_id: out.carrera_id,
          },
        )
      }

      const { data: inserted, error: insErr } = await supabaseService
        .from('planes_estudio')
        .insert({
          nombre: out.nombre,
          tipo_ciclo: out.tipo_ciclo,
          numero_ciclos: out.numero_ciclos,
          carrera_id: out.carrera_id,
          estructura_id: estructuraPlan.id,
          estado_actual_id: estadoBorr.id,
          activo: true,
          tipo_origen: 'IA',
          datos: out.datos,
          meta_origen: {
            generado_por: 'ai-generate-plan',
            clonacionPlan: true,
            referencias: { archivoWordOpenAI: openaiFileIds[0] },
          } as unknown as Json,
        })
        .select('id,nombre')
        .single()

      if (insErr) {
        throw new HttpError(
          500,
          'No se pudo insertar el plan clonado.',
          'SUPABASE_INSERT_FAILED',
          insErr,
        )
      }
      console.log(
        `[${new Date().toISOString()}][${functionName}]: Request processed successfully`,
      )
      return sendSuccess(inserted)
    }

    // Ensure the JSON schema is an object as required by OpenAI types
    const schemaDef: Record<string, unknown> =
      typeof estructuraPlan.definicion === 'object' &&
      estructuraPlan.definicion !== null
        ? (estructuraPlan.definicion as Record<string, unknown>)
        : {}

    if (!payload.clonacionPlan) {
      const userPrompt = `Genera un borrador completo del PLAN DE ESTUDIOS con base en lo siguiente:
      - Nombre de la institución: Universidad La Salle México
    - Nombre del plan: ${String(payload.datosBasicos.nombrePlan)}
    - Tipo de ciclo: ${String(payload.datosBasicos.tipoCiclo)}
    - Número de ciclos: ${String(payload.datosBasicos.numCiclos)}
    - Descripción del enfoque académico (sobre el contenido de la respuesta generada): ${String(
      payload.iaConfig.descripcionEnfoqueAcademico,
    )}
    - Notas adicionales (sobre el formato de la respuesta generada): ${String(
      payload.iaConfig.instruccionesAdicionalesIA ?? 'Ninguna',
    )}`

      const { data: estado } = await supabaseService
        .from('estados_plan')
        .select('id,clave,orden')
        .eq('clave', 'GENERANDO')
        .maybeSingle()

      if (!estado?.id) {
        throw new HttpError(
          500,
          'No se encontró el estado GENERANDO.',
          'MISSING_STATE',
          { clave: 'GENERANDO' },
        )
      }

      const { data: carrera, error: carreraError } = await supabaseService
        .from('carreras')
        .select('id,nombre,facultad_id,facultades(id,nombre,nombre_corto)')
        .eq('id', String(payload.datosBasicos.carreraId))
        .maybeSingle()
      if (carreraError) {
        throw new HttpError(
          500,
          'No se pudo obtener la carrera.',
          'SUPABASE_QUERY_FAILED',
          carreraError,
        )
      }
      if (!carrera) {
        throw new HttpError(404, 'No se encontró la carrera.', 'NOT_FOUND', {
          table: 'carreras',
          id: payload.datosBasicos.carreraId,
        })
      }

      const planInsert: Database['public']['Tables']['planes_estudio']['Insert'] =
        {
          carrera_id: carrera.id,
          estructura_id: estructuraPlan.id,
          nombre: String(payload.datosBasicos.nombrePlan),
          tipo_ciclo: String(
            payload.datosBasicos.tipoCiclo,
          ) as Database['public']['Tables']['planes_estudio']['Insert']['tipo_ciclo'],
          numero_ciclos: Number(payload.datosBasicos.numCiclos),
          // IMPORTANTE: se inserta SIN `datos` (se actualiza vía webhook)
          estado_actual_id: estado.id,
          activo: true,
          tipo_origen: 'IA',
          meta_origen: {
            generado_por: 'ai-generate-plan',
            referencias: {
              archivosReferenciaIds:
                payload.iaConfig.archivosReferencia ?? null,
              repositoriosIds: payload.iaConfig.repositoriosIds ?? null,
            },
            iaConfig: {
              descripcionEnfoqueAcademico:
                payload.iaConfig.descripcionEnfoqueAcademico,
              instruccionesAdicionalesIA:
                payload.iaConfig.instruccionesAdicionalesIA ?? null,
              usarMCP: Boolean(payload.iaConfig.usarMCP),
            },
          } as unknown as Json,
        }

      const { data: plan, error: planError } = await supabaseService
        .from('planes_estudio')
        .insert(planInsert)
        .select(
          'id,nombre,tipo_ciclo,numero_ciclos,carrera_id,estructura_id,estado_actual_id,activo,tipo_origen,meta_origen,creado_por,actualizado_por,creado_en,actualizado_en,datos',
        )
        .single()

      if (planError) {
        const maybeCode = (planError as { code?: string }).code
        const status = maybeCode ? 409 : 500
        throw new HttpError(
          status,
          'No se pudo guardar el plan de estudios.',
          'SUPABASE_INSERT_FAILED',
          { ...planError, code: maybeCode },
        )
      }

      const userContent = openaiFileIds.length
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

      const aiStructuredPayload: StructuredResponseOptions = {
        model: AI_GENERATE_PLAN_MODELO,
        background: true,
        metadata: {
          tabla: 'planes_estudio',
          accion: 'crear',
          id: String(plan.id),
        },
        tools: vectorStoreIds.length
          ? [
              {
                type: 'file_search',
                vector_store_ids: vectorStoreIds,
              },
            ]
          : undefined,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'plan_de_estudios_standard',
            schema: schemaDef,
            strict: true,
          },
        },
      }

      // Use shared OpenAI service directly (no HTTP invoke)
      const svc = OpenAIService.fromEnv()
      if (!(svc instanceof OpenAIService)) {
        throw new HttpError(
          500,
          'Configuración del servidor incompleta.',
          'OPENAI_MISCONFIGURED',
          svc,
        )
      }

      // INICIO DE CÓDIGO PARA DEBBUGGING
      // console.log(
      //   `[${
      //     new Date().toISOString()
      //   }][${functionName}]: Request processed successfully`,
      // );
      // const { data: plan_debug } = await supabaseService
      //   .from("planes_estudio")
      //   .select("*")
      //   .eq("id", "7ce657b1-1abf-4972-858d-5fffe1d51499")
      //   .maybeSingle();
      // return sendSuccess(plan_debug);
      // FIN DE CÓDIGO PARA DEBBUGGING

      const aiResult = await svc.createStructuredResponse(aiStructuredPayload)
      if (!aiResult.ok) {
        const status = aiResult.code === 'MissingEnv' ? 500 : 502
        throw new HttpError(
          status,
          'No se pudo iniciar la generación del plan con IA.',
          'OPENAI_REQUEST_FAILED',
          aiResult,
        )
      }

      // TODO: update a interaccion_ia y e insert a cambios_plan con id de plan generado

      console.log(
        `[${new Date().toISOString()}][${functionName}]: Request processed successfully`,
      )
      return sendSuccess(plan)
    } // fin flujo no clonación

    throw new HttpError(
      500,
      'Flujo no manejado en ai-generate-plan',
      'UNREACHABLE',
    )
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

      // RESPONSE: Solo enviamos el mensaje limpio y el código
      return sendError(error.status, error.message, error.code)
    }

    // CASO B: Error Inesperado (Crash, Bug, Syntax Error, etc.)
    // El usuario NO debe ver esto.
    const unexpectedError =
      error instanceof Error ? error : new Error(String(error))

    // LOG: Full stack trace y mensaje real
    console.error(
      `[${new Date().toISOString()}][${functionName}] 💥 CRITICAL UNHANDLED ERROR:`,
      unexpectedError.stack || unexpectedError.message, // Esto es lo que necesitas para debuguear
    )

    // RESPONSE: Mensaje genérico y seguro
    return sendError(
      500,
      'Ocurrió un error inesperado en el servidor.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})

// Este helper recibe un esquema (ej. DatosBasicosSchema) y devuelve un validador
// que acepta un string JSON y lo valida contra ese esquema.
const jsonFromString = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .string()
    .transform((str, ctx) => {
      try {
        return JSON.parse(str)
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El formato no es un JSON válido',
        })
        return z.NEVER // Detiene la ejecución aquí si falla el parseo
      }
    })
    .pipe(schema) // Si el parseo es exitoso, pasa los datos al esquema real

// --- VALIDACIÓN ESTRICTA DE DATOS BÁSICOS ---
const DatosBasicosSchema: z.ZodType<AIGeneratePlanInput['datosBasicos']> =
  z.object({
    nombrePlan: z.string().min(1, 'El nombre es requerido'),
    carreraId: z.string().uuid('carreraId debe ser un UUID'),
    facultadId: z.string().uuid('facultadId debe ser un UUID').optional(),
    tipoCiclo: z.enum(['Semestre', 'Cuatrimestre', 'Trimestre', 'Otro']),
    numCiclos: z.number().int().positive(),
    estructuraPlanId: z.string().uuid('estructuraPlanId debe ser un UUID'),
  })

const IAConfigSchema: z.ZodType<AIGeneratePlanInput['iaConfig']> = z.object({
  descripcionEnfoqueAcademico: z.string(),
  instruccionesAdicionalesIA: z.string().optional(),
  archivosReferencia: z.array(z.string().min(1)).optional(),
  repositoriosIds: z.array(z.string().min(1)).optional(),
  usarMCP: z.boolean().optional(),
})

const SolicitudSchema = z.object({
  // Usamos el helper aquí. Zod recibe string -> parsea -> valida estructura
  datosBasicos: jsonFromString(DatosBasicosSchema),

  iaConfig: jsonFromString(IAConfigSchema),

  // Validamos directamente que sea un array de Archivos
  // z.instanceof(File) funciona en entornos Web/Deno
  archivosAdjuntos: z.array(z.instanceof(File)).optional().default([]),
})

function parseAndValidate(formData: FormData):
  | { success: true; data: AIGeneratePlanInput }
  | {
      success: false
      errors: Array<string>
    } {
  // Detectar clonación
  const clonacionPlanRaw = formData.get('clonacionPlan')
  const clonacionPlan = String(clonacionPlanRaw ?? '').toLowerCase() === 'true'

  if (clonacionPlan) {
    const DatosBasicosClone = z.object({
      estructuraPlanId: z.string().uuid('estructuraPlanId debe ser un UUID'),
    })
    const IAConfigClone = z.object({
      archivosReferencia: z.array(z.string().min(1)).length(1),
    })

    const datosBasicosStr = formData.get('datosBasicos')
    const iaConfigStr = formData.get('iaConfig')

    let datosBasicosParsed: unknown
    let iaConfigParsed: unknown
    try {
      datosBasicosParsed = JSON.parse(String(datosBasicosStr))
      iaConfigParsed = JSON.parse(String(iaConfigStr))
    } catch {
      return {
        success: false,
        errors: ['datosBasicos o iaConfig no son JSON válidos'],
      }
    }

    let dbData: z.infer<typeof DatosBasicosClone> | null = null
    let iaData: z.infer<typeof IAConfigClone> | null = null
    const errs: Array<string> = []
    try {
      dbData = DatosBasicosClone.parse(datosBasicosParsed)
    } catch (e) {
      const ze = e as z.ZodError
      errs.push(
        ...ze.issues.map(
          (issue: z.ZodIssue) =>
            `datosBasicos.${issue.path.join('.')}: ${issue.message}`,
        ),
      )
    }
    try {
      iaData = IAConfigClone.parse(iaConfigParsed)
    } catch (e) {
      const ze = e as z.ZodError
      errs.push(
        ...ze.issues.map(
          (issue: z.ZodIssue) =>
            `iaConfig.${issue.path.join('.')}: ${issue.message}`,
        ),
      )
    }
    if (errs.length) return { success: false, errors: errs }

    return {
      success: true,
      data: {
        clonacionPlan: true,
        datosBasicos: dbData as AIGeneratePlanInput['datosBasicos'],
        iaConfig: iaData as AIGeneratePlanInput['iaConfig'],
        archivosAdjuntos: [],
      },
    }
  }

  // Flujo normal (no clonación)
  const rawInput = {
    datosBasicos: formData.get('datosBasicos'),
    iaConfig: formData.get('iaConfig'),
    archivosAdjuntos: formData.getAll('archivosAdjuntos'),
  }

  const result = SolicitudSchema.safeParse(rawInput)
  if (!result.success) {
    const errors: Array<string> = result.error.issues.map(
      (issue: z.ZodIssue) => {
        const path = issue.path.join('.')
        return `${path}: ${issue.message}`
      },
    )

    return { success: false, errors }
  }
  return { success: true, data: result.data }
}
