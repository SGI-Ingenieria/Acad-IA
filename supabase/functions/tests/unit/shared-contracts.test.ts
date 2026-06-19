import { assert, assertEquals } from 'jsr:@std/assert@1'

import {
  CAMPOS_SIEMPRE_PLAN,
  construirDatos,
  construirMetadata,
} from '../../_shared/camposDocumento.ts'
import {
  buildAsignaturaUpdateJsonSchema,
  parseAsignaturaAIOutputToUpdatePatch,
} from '../../_shared/asignaturas-ai.ts'
import { sendError, sendSuccess } from '../../_shared/utils.ts'

Deno.test('sendSuccess and sendError return JSON responses', async () => {
  const success = sendSuccess({ ok: true }, 201)
  assertEquals(success.status, 201)
  assertEquals(success.headers.get('Content-Type'), 'application/json')
  assertEquals(await success.json(), { ok: true })

  const failure = sendError(422, 'Datos inválidos', 'INVALID_INPUT')
  assertEquals(failure.status, 422)
  assertEquals(await failure.json(), {
    error: { message: 'Datos inválidos', code: 'INVALID_INPUT' },
  })
})

Deno.test(
  'construirDatos keeps canonical fields and ignores undeclared data',
  () => {
    const definicion = {
      properties: {
        nombre: { title: 'Nombre declarado por estructura' },
        objetivo: { title: 'Objetivo' },
        perfil_egreso: { title: 'Perfil de egreso' },
      },
    }

    const data = construirDatos(
      CAMPOS_SIEMPRE_PLAN,
      {
        plan: {
          nombre: 'Maestría en Ciberseguridad',
          numero_ciclos: 4,
          tipo_ciclo: 'SEMESTRE',
        },
        carrera: {
          nivel: 'Maestría',
          nombre: 'Ciberseguridad',
          clave_sep: 'SEP-123',
        },
      },
      definicion,
      {
        nombre: 'No debe pisar el nombre canónico',
        objetivo: 'Formar especialistas.',
        no_declarado: 'Se debe ignorar',
      },
    )

    assertEquals(data.nombre, 'Maestría en Ciberseguridad')
    assertEquals(data.nivel, 'Maestría')
    assertEquals(data.objetivo, 'Formar especialistas.')
    assertEquals(data.perfil_egreso, null)
    assertEquals(Object.hasOwn(data, 'no_declarado'), false)
  },
)

Deno.test('construirMetadata marks canonical and structure fields', () => {
  const metadata = construirMetadata(CAMPOS_SIEMPRE_PLAN, {
    properties: {
      objetivo: { title: 'Objetivo general' },
    },
  })

  assert(metadata.some((field) => field.key === 'nombre' && field.isAlways))
  assert(
    metadata.some(
      (field) =>
        field.key === 'objetivo' &&
        field.title === 'Objetivo general' &&
        !field.isAlways,
    ),
  )
})

Deno.test(
  'buildAsignaturaUpdateJsonSchema excludes column fields from datos',
  () => {
    const schema = buildAsignaturaUpdateJsonSchema({
      clonacionTradicional: false,
      definicion: {
        properties: {
          contenido_tematico: { type: 'string' },
          perfil_egreso: { type: 'string' },
        },
        required: ['perfil_egreso'],
      },
    })

    const properties = schema.properties as Record<string, any>
    const datos = properties.datos as Record<string, any>
    assertEquals(Object.hasOwn(datos.properties, 'contenido_tematico'), false)
    assertEquals(datos.properties.perfil_egreso.type, 'string')
    assertEquals(schema.required, [
      'datos',
      'codigo',
      'contenido_tematico',
      'criterios_de_evaluacion',
    ])
  },
)

Deno.test(
  'parseAsignaturaAIOutputToUpdatePatch validates required fields',
  () => {
    const parsed = parseAsignaturaAIOutputToUpdatePatch({
      clonacionTradicional: false,
      aiOutput: {
        datos: { perfil_egreso: 'Especialista en seguridad.' },
        codigo: null,
        contenido_tematico: [],
        criterios_de_evaluacion: [],
      },
    })

    assert(parsed.ok)
    assertEquals(parsed.value.patch.datos, {
      perfil_egreso: 'Especialista en seguridad.',
    })
    assertEquals(parsed.value.patch.codigo, null)

    const invalid = parseAsignaturaAIOutputToUpdatePatch({
      clonacionTradicional: false,
      aiOutput: {
        datos: {},
        codigo: null,
        contenido_tematico: [],
        criterios_de_evaluacion: 'no es arreglo',
      },
    })

    assertEquals(invalid.ok, false)
    if (!invalid.ok) {
      assertEquals(invalid.error.code, 'AI_OUTPUT_MISSING_REQUIRED')
      assertEquals(invalid.error.extra, {
        missing: ['criterios_de_evaluacion'],
      })
    }
  },
)
