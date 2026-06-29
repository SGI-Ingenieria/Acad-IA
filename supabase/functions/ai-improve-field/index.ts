import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { corsHeaders } from '../_shared/cors.ts'
import { registrarInteraccionIA } from '../_shared/interacciones-ia.ts'
import { OpenAIService } from '../_shared/openai-service.ts'
import { buildSafetyIdentifier } from '../_shared/openai-response-controls.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

import type { Database } from '../_shared/database.types.ts'
import type { StructuredResponseOptions } from '../_shared/openai-service.ts'

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
])

const RequestSchema = z
  .object({
    entidad: z.enum(['plan', 'asignatura']),
    entidad_id: z.string().uuid(),
    clave: z.string().trim().min(1),
    campo_schema: z.record(z.unknown()).nullable().optional(),
    contenido_actual: z.string().default(''),
    prompt_usuario: z.string().trim().min(1).max(4000),
    es_richtext: z.boolean().default(false),
  })
  .strict()

function escapeAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  }

  return value.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (match, entity) => {
    const key = String(entity).toLowerCase()
    if (key.startsWith('#x')) {
      const code = Number.parseInt(key.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (key.startsWith('#')) {
      const code = Number.parseInt(key.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return named[key] ?? match
  })
}

function stripHtmlToText(value: string) {
  return decodeEntities(
    value
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\/\s*(p|h1|h2|h3|li|blockquote|pre)\s*>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  )
}

function readAttr(rawAttrs: string, attr: string) {
  const pattern = new RegExp(
    `${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'=<>\\x60]+))`,
    'i',
  )
  const match = rawAttrs.match(pattern)
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? ''
}

function sanitizeStyle(rawAttrs: string) {
  const style = readAttr(rawAttrs, 'style')
  const match = style.match(/text-align\s*:\s*(left|center|right)/i)
  return match ? ` style="text-align: ${match[1].toLowerCase()}"` : ''
}

function sanitizeAllowedHtml(value: string) {
  const withoutDangerousBlocks = value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(
      /<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      '',
    )

  return withoutDangerousBlocks.replace(
    /<\/?\s*([a-z0-9]+)([^>]*)>/gi,
    (fullTag, rawName, rawAttrs) => {
      const tag = String(rawName).toLowerCase()
      if (!ALLOWED_TAGS.has(tag)) return ''

      const isClosing = /^<\s*\//.test(fullTag)
      if (isClosing) return tag === 'br' ? '' : `</${tag}>`
      if (tag === 'br') return '<br>'

      const style = sanitizeStyle(String(rawAttrs ?? ''))

      if (tag !== 'a') return `<${tag}${style}>`

      const href = readAttr(String(rawAttrs ?? ''), 'href').trim()
      if (!href || /^\s*javascript:/i.test(href)) {
        return `<a${style}>`
      }

      return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer"${style}>`
    },
  )
}

function formatZodIssues(issues: Array<z.ZodIssue>) {
  return issues
    .map((issue, i) => {
      const path = issue.path.length ? issue.path.join('.') : '(root)'
      return `${i + 1}. ${path}: ${issue.message}`
    })
    .join('\n')
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED')
    }

    const authHeader =
      req.headers.get('Authorization') ?? req.headers.get('authorization')
    if (!authHeader) {
      throw new HttpError(401, 'No autorizado.', 'UNAUTHORIZED')
    }

    const contentType = (req.headers.get('content-type') ?? '').toLowerCase()
    if (!contentType.includes('application/json')) {
      throw new HttpError(
        415,
        'Content-Type no soportado.',
        'UNSUPPORTED_MEDIA_TYPE',
        { contentType },
      )
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch (error) {
      throw new HttpError(400, 'Body JSON inválido.', 'INVALID_JSON', error)
    }

    const parsed = RequestSchema.safeParse(rawBody)
    if (!parsed.success) {
      throw new HttpError(
        422,
        formatZodIssues(parsed.error.issues),
        'VALIDATION_ERROR',
        parsed.error,
      )
    }

    const payload = parsed.data
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
      throw new HttpError(
        500,
        'Configuración del servidor incompleta.',
        'MISSING_ENV',
      )
    }

    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } =
      await supabaseAnon.auth.getUser()

    if (userError || !userData.user) {
      throw new HttpError(401, 'Token inválido.', 'UNAUTHORIZED', {
        reason: userError?.message ?? 'invalid_token',
      })
    }

    const supabaseService = createClient<Database>(
      SUPABASE_URL,
      SERVICE_ROLE_KEY,
    )

    const rpcName =
      payload.entidad === 'plan'
        ? 'usuario_puede_usar_ia_plan'
        : 'usuario_puede_usar_ia_asignatura'
    const rpcArgs =
      payload.entidad === 'plan'
        ? { p_usuario_id: userData.user.id, p_plan_id: payload.entidad_id }
        : {
            p_usuario_id: userData.user.id,
            p_asignatura_id: payload.entidad_id,
          }

    const { data: puedeUsarIA, error: authzError } = await supabaseService.rpc(
      rpcName,
      rpcArgs,
    )

    if (authzError) {
      throw new HttpError(
        500,
        'No se pudo validar el permiso de IA.',
        'AUTHZ_ERROR',
        authzError,
      )
    }

    if (!puedeUsarIA) {
      throw new HttpError(
        403,
        'No tienes permiso para usar IA en este campo.',
        'IA_NOT_ALLOWED',
      )
    }

    const model = Deno.env.get('AI_IMPROVE_FIELD_MODELO') ?? 'gpt-5-nano'
    const svc = OpenAIService.fromEnv()
    if (!(svc instanceof OpenAIService)) {
      throw new HttpError(
        500,
        'Configuración del servidor incompleta.',
        'OPENAI_MISCONFIGURED',
        svc,
      )
    }

    const currentContent = payload.es_richtext
      ? sanitizeAllowedHtml(payload.contenido_actual)
      : stripHtmlToText(payload.contenido_actual)

    const systemPrompt = payload.es_richtext
      ? `Eres un editor académico. Devuelve únicamente un fragmento HTML válido para el campo solicitado. Puedes usar solo estas etiquetas: p, br, strong, b, em, i, u, s, del, code, pre, h1, h2, h3, ul, ol, li, a, blockquote. No uses Markdown, scripts, iframes, clases ni atributos fuera de href, target, rel y style para alineación.`
      : `Eres un editor académico. Devuelve únicamente texto plano para el campo solicitado. No uses HTML ni Markdown.`

    const userPrompt =
      `Entidad: ${payload.entidad}\n` +
      `ID: ${payload.entidad_id}\n` +
      `Campo: ${payload.clave}\n` +
      `Schema del campo:\n${JSON.stringify(payload.campo_schema ?? {}, null, 2)}\n\n` +
      `Contenido actual:\n${currentContent || '(vacio)'}\n\n` +
      `Instrucción del usuario:\n${payload.prompt_usuario}\n\n` +
      `Respeta el idioma, conserva hechos y no inventes requisitos normativos.`

    const options: StructuredResponseOptions = {
      model,
      metadata: {
        tabla: payload.entidad === 'plan' ? 'planes_estudio' : 'asignaturas',
        accion: 'mejorar_campo',
        id: payload.entidad_id,
        campo: payload.clave,
      },
      safety_identifier: await buildSafetyIdentifier(userData.user.id),
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'ai_improve_field',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              contenido_mejorado: {
                type: 'string',
                description:
                  'Contenido final mejorado para previsualizar y aplicar.',
              },
            },
            required: ['contenido_mejorado'],
          },
        },
      },
    }

    const aiResult = await svc.createStructuredResponse<{
      contenido_mejorado: string
    }>(options)

    if (!aiResult.ok) {
      const status = aiResult.code === 'MissingEnv' ? 500 : 502
      throw new HttpError(
        status,
        'No se pudo generar la mejora con IA.',
        'OPENAI_REQUEST_FAILED',
        aiResult,
      )
    }

    let output = aiResult.output ?? null
    if (output == null && aiResult.outputText) {
      try {
        output = JSON.parse(aiResult.outputText)
      } catch {
        throw new HttpError(
          502,
          'La respuesta de la IA no es JSON válido.',
          'OPENAI_INVALID_JSON',
          { outputText: aiResult.outputText },
        )
      }
    }

    const improvedRaw =
      output && typeof output.contenido_mejorado === 'string'
        ? output.contenido_mejorado
        : ''

    if (!improvedRaw.trim()) {
      throw new HttpError(
        502,
        'La respuesta de la IA no contiene contenido.',
        'OPENAI_EMPTY_OUTPUT',
      )
    }

    const contenido_mejorado = payload.es_richtext
      ? sanitizeAllowedHtml(improvedRaw)
      : stripHtmlToText(improvedRaw)

    await registrarInteraccionIA(supabaseService, {
      usuarioId: userData.user.id,
      tipo: 'MEJORAR_SECCION',
      planEstudioId: payload.entidad === 'plan' ? payload.entidad_id : null,
      asignaturaId:
        payload.entidad === 'asignatura' ? payload.entidad_id : null,
      modelo: aiResult.model,
    })

    return sendSuccess({ ok: true, contenido_mejorado })
  } catch (error) {
    if (error instanceof HttpError) {
      console.error('[ai-improve-field] handled error', {
        message: error.message,
        code: error.code,
        details: error.internalDetails ?? null,
      })

      return sendError(error.status, error.message, error.code)
    }

    const unexpected = error instanceof Error ? error : new Error(String(error))
    console.error('[ai-improve-field] unexpected error', unexpected)

    return sendError(
      500,
      'Ocurrió un error inesperado en el servidor.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
