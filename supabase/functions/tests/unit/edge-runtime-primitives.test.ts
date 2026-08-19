import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
} from 'jsr:@std/assert@1'

import { preflightResponse, withCors } from '../../_shared/cors.ts'
import {
  getEnv,
  getFirstEnv,
  requireEnv,
  requireFirstEnv,
} from '../../_shared/env.ts'
import {
  getBearerToken,
  readJsonBody,
  requireJsonContentType,
  requireMethod,
} from '../../_shared/request.ts'
import { isPlanAIBlockedState } from '../../_shared/ai-plan-state.ts'
import {
  extractOpenAIResponseText,
  resolveStructuredResponseOutput,
  sanitizeJsonControlChars,
} from '../../_shared/openai-response.ts'
import { edgeErrorResponse, HttpError } from '../../_shared/utils.ts'
import {
  joinValidationMessages,
  validateInput,
} from '../../_shared/validation.ts'
import {
  asRecord,
  isExpiredTimestamp,
  nonEmptyString,
  normalizeEmail,
  slugifyAscii,
  stableJson,
} from '../../_shared/value.ts'

Deno.test(
  'las primitivas de entorno resuelven fallback, alias y errores tipados',
  () => {
    const primary = 'ACAD_IA_TEST_ENV_PRIMARY'
    const secondary = 'ACAD_IA_TEST_ENV_SECONDARY'
    const previousPrimary = Deno.env.get(primary)
    const previousSecondary = Deno.env.get(secondary)

    try {
      Deno.env.delete(primary)
      Deno.env.set(secondary, 'valor-secundario')

      assertEquals(getEnv(primary, 'fallback'), 'fallback')
      assertEquals(getFirstEnv([primary, secondary]), 'valor-secundario')
      assertEquals(requireFirstEnv([primary, secondary]), 'valor-secundario')

      let captured: unknown
      try {
        requireEnv(primary, { message: 'Falta la prueba.', code: 'TEST_ENV' })
      } catch (error) {
        captured = error
      }
      assertInstanceOf(captured, HttpError)
      assertEquals(captured.status, 500)
      assertEquals(captured.code, 'TEST_ENV')
      assertEquals(captured.message, 'Falta la prueba.')
    } finally {
      if (previousPrimary === undefined) Deno.env.delete(primary)
      else Deno.env.set(primary, previousPrimary)
      if (previousSecondary === undefined) Deno.env.delete(secondary)
      else Deno.env.set(secondary, previousSecondary)
    }
  },
)

Deno.test(
  'los valores JSON desconocidos se normalizan de forma estable',
  () => {
    assertEquals(asRecord({ clave: 1 }), { clave: 1 })
    assertEquals(asRecord([]), null)
    assertEquals(nonEmptyString('valor'), 'valor')
    assertEquals(nonEmptyString(''), null)
    assertEquals(normalizeEmail(' Persona@LaSalle.MX '), 'persona@lasalle.mx')
    assertEquals(
      stableJson({ z: [2, { b: true, a: false }], a: 1 }),
      '{"a":1,"z":[2,{"a":false,"b":true}]}',
    )
    assertEquals(
      slugifyAscii('Diseño curricular — 2026'),
      'diseno-curricular-2026',
    )
    assertEquals(slugifyAscii('---', 'recurso'), 'recurso')
    assertEquals(
      isExpiredTimestamp(
        '2026-01-01T00:00:00.000Z',
        1_000,
        Date.parse('2026-01-01T00:00:02.000Z'),
      ),
      true,
    )
    assertEquals(isExpiredTimestamp(undefined, 1_000), true)
  },
)

Deno.test('la validación compartida devuelve datos o un HttpError', () => {
  const schema = {
    safeParse: (value: unknown) =>
      value === 'válido'
        ? ({ success: true, data: { value } } as const)
        : ({
            success: false,
            error: {
              issues: [
                { path: ['uno'], message: 'Primero.' },
                { path: ['dos'], message: 'Segundo.' },
              ],
            },
          } as const),
  }
  assertEquals(validateInput(schema, 'válido').data, { value: 'válido' })

  let captured: unknown
  try {
    validateInput(schema, 'inválido', { message: joinValidationMessages })
  } catch (error) {
    captured = error
  }
  assertInstanceOf(captured, HttpError)
  assertEquals(captured.status, 422)
  assertEquals(captured.message, 'Primero. Segundo.')
})

Deno.test(
  'la salida de Responses acepta el acceso directo y el anidado',
  () => {
    assertEquals(
      extractOpenAIResponseText({ output_text: 'directo' }),
      'directo',
    )
    assertEquals(
      extractOpenAIResponseText({
        output: [
          {
            type: 'message',
            content: [
              { type: 'output_text', text: 'uno' },
              { type: 'refusal', refusal: 'omitido' },
              { type: 'output_text', text: ' dos' },
            ],
          },
        ],
      }),
      'uno dos',
    )
    assertEquals(extractOpenAIResponseText({ output: [] }), '')
  },
)

Deno.test(
  'el saneamiento conserva JSON con controles dentro de strings',
  () => {
    const sanitized = sanitizeJsonControlChars(
      '{"texto":"línea\nsegunda\tcolumna"}',
    )
    assertEquals(JSON.parse(sanitized), {
      texto: 'línea\nsegunda\tcolumna',
    })
  },
)

Deno.test('la salida estructurada tipa el JSON inválido', () => {
  assertEquals(resolveStructuredResponseOutput({ output: { ok: true } }), {
    ok: true,
  })
  assertEquals(resolveStructuredResponseOutput({ outputText: '{"valor":7}' }), {
    valor: 7,
  })

  let captured: unknown
  try {
    resolveStructuredResponseOutput({ outputText: '{invalido' })
  } catch (error) {
    captured = error
  }
  assertInstanceOf(captured, HttpError)
  assertEquals(captured.status, 502)
  assertEquals(captured.code, 'OPENAI_INVALID_JSON')
})

Deno.test('los estados bloqueados para IA se comparten entre handlers', () => {
  assertEquals(isPlanAIBlockedState('REV_PLANEACION'), true)
  assertEquals(isPlanAIBlockedState('APROBADO'), true)
  assertEquals(isPlanAIBlockedState('BORRADOR'), false)
  assertEquals(isPlanAIBlockedState(null), false)
})

Deno.test(
  'los errores Edge conservan contratos tipados y ocultan fallos',
  async () => {
    const originalError = console.error
    console.error = () => undefined
    try {
      const handled = edgeErrorResponse(
        new HttpError(409, 'Conflicto.', 'CONFLICT', { internal: true }),
        'test-edge',
      )
      assertEquals(handled.status, 409)
      assertEquals(await handled.json(), {
        error: { message: 'Conflicto.', code: 'CONFLICT' },
      })

      const unexpected = edgeErrorResponse(
        new Error('secreto interno'),
        'test-edge',
        'Mensaje seguro.',
        'SAFE_ERROR',
        502,
      )
      assertEquals(unexpected.status, 502)
      assertEquals(await unexpected.json(), {
        error: { message: 'Mensaje seguro.', code: 'SAFE_ERROR' },
      })
    } finally {
      console.error = originalError
    }
  },
)

Deno.test(
  'preflight y withCors comparten headers sin perder la respuesta',
  async () => {
    const preflight = preflightResponse()
    assertEquals(preflight.status, 204)
    assertEquals(preflight.headers.get('Access-Control-Allow-Origin'), '*')

    const response = withCors(
      new Response('contenido', {
        status: 202,
        statusText: 'Accepted',
        headers: { 'X-Domain-Header': 'preservado' },
      }),
    )
    assertEquals(response.status, 202)
    assertEquals(response.statusText, 'Accepted')
    assertEquals(response.headers.get('X-Domain-Header'), 'preservado')
    assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
    assertEquals(await response.text(), 'contenido')
  },
)

Deno.test(
  'las validaciones HTTP aceptan JSON y conservan detalles del error',
  async () => {
    const request = new Request('https://example.test/function', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-prueba',
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ ok: true }),
    })

    requireMethod(request, 'POST')
    requireJsonContentType(request)
    assertEquals(getBearerToken(request), 'token-prueba')
    assertEquals(await readJsonBody(request), { ok: true })

    const invalidMethod = new Request('https://example.test/function')
    let methodError: unknown
    try {
      requireMethod(invalidMethod, 'POST')
    } catch (error) {
      methodError = error
    }
    assertInstanceOf(methodError, HttpError)
    assertEquals(methodError.status, 405)
    assertEquals(methodError.internalDetails, { method: 'GET' })

    await assertRejects(
      () =>
        readJsonBody(
          new Request('https://example.test/function', {
            method: 'POST',
            body: '{invalido',
          }),
        ),
      HttpError,
      'Body JSON inválido.',
    )
  },
)
