import { assert, assertEquals } from 'jsr:@std/assert@1'
import { strFromU8, strToU8, unzipSync, zipSync } from 'npm:fflate@0.8.3'

import {
  CAMPOS_SIEMPRE_PLAN,
  collectRichtextKeys,
  construirDatos,
  construirMetadata,
} from '../../_shared/camposDocumento.ts'
import {
  patchRenderedRichtextHtmlInXml,
  postProcessRenderedDocxRichtext,
  richtextHtmlToWordXml,
} from '../../carbone-io-wrapper/richtext-template.ts'
import {
  buildAsignaturaUpdateJsonSchema,
  parseAsignaturaAIOutputToUpdatePatch,
} from '../../_shared/asignaturas-ai.ts'
import { stripRestrictedJsonSchemaProperties } from '../../_shared/json-schema.ts'
import {
  buildReasoningParam,
  supportsNoReasoning,
} from '../../_shared/openai-response-controls.ts'
import { sendError, sendSuccess } from '../../_shared/utils.ts'

Deno.test(
  'stripRestrictedJsonSchemaProperties removes restricted fields (incl. nested) and their required entries',
  () => {
    const schema = {
      type: 'object',
      properties: {
        objetivo: { type: 'string' },
        nombre_y_cargo_de_la_persona_facultada: {
          type: 'string',
          'x-acad-ia': { restriccion: { estados: ['BORRADOR'] } },
        },
        bloque_autorizacion: {
          type: 'object',
          properties: {
            firma_autoridad: {
              type: 'string',
              'x-acad-ia': { restriccion: { estados: ['BORRADOR'] } },
            },
            descripcion: { type: 'string' },
          },
          required: ['firma_autoridad', 'descripcion'],
        },
      },
      required: [
        'objetivo',
        'nombre_y_cargo_de_la_persona_facultada',
        'bloque_autorizacion',
      ],
    }

    const stripped = stripRestrictedJsonSchemaProperties(schema) as Record<
      string,
      any
    >

    // El campo restringido de primer nivel desaparece de properties y required.
    assertEquals(
      Object.hasOwn(
        stripped.properties,
        'nombre_y_cargo_de_la_persona_facultada',
      ),
      false,
    )
    assertEquals(stripped.required, ['objetivo', 'bloque_autorizacion'])

    // La restricción anidada dentro de un sub-objeto también se elimina.
    assertEquals(
      Object.hasOwn(
        stripped.properties.bloque_autorizacion.properties,
        'firma_autoridad',
      ),
      false,
    )
    assertEquals(stripped.properties.bloque_autorizacion.required, [
      'descripcion',
    ])

    // Los metadatos propietarios nunca sobreviven al esquema enviado a OpenAI.
    assert(!JSON.stringify(stripped).includes('x-acad-ia'))
  },
)

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

Deno.test('los modelos GPT-5.1+ aceptan razonamiento none', () => {
  assertEquals(buildReasoningParam('gpt-5.6-luna', 'none'), {
    effort: 'none',
  })
  assertEquals(supportsNoReasoning('gpt-5.6-luna'), true)
  assertEquals(buildReasoningParam('gpt-5-mini', 'auto'), undefined)
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

Deno.test(
  'construirDatos keeps sanitized rich text HTML for document exports',
  () => {
    const definicion = {
      properties: {
        perfil_egreso: {
          title: 'Perfil de egreso',
          type: 'string',
          format: 'html',
          'x-richtext': true,
        },
      },
    }

    const data = construirDatos(
      CAMPOS_SIEMPRE_PLAN,
      {
        plan: { nombre: 'Plan', numero_ciclos: 4, tipo_ciclo: 'SEMESTRE' },
        carrera: { nivel: 'Licenciatura', nombre: 'Derecho' },
      },
      definicion,
      {
        perfil_egreso:
          '<h2>Perfil</h2><p><strong>Ética</strong> y <em>criterio</em></p><script>alert(1)</script>',
      },
      { richtextMode: 'documentHtml' },
    )

    assertEquals(
      data.perfil_egreso,
      '<h2>Perfil</h2><p><strong>Ética</strong> y <em>criterio</em></p>',
    )
    assertEquals(collectRichtextKeys(definicion), ['perfil_egreso'])
  },
)

Deno.test('richtextHtmlToWordXml maps common HTML to Word XML', () => {
  const result = richtextHtmlToWordXml(
    '<h2>Perfil</h2><p><strong>Ética</strong> y <em>criterio</em></p><ul><li>Colaboración</li></ul>',
  )

  // Los encabezados se dimensionan por run (w:sz) y no por el estilo HeadingN
  // del template, para verse más grandes sin heredar otra tipografía.
  assert(result.xml.includes('<w:sz w:val="28"/>'))
  assert(!result.xml.includes('<w:pStyle'))
  assert(result.xml.includes('<w:b/>'))
  assert(result.xml.includes('<w:i/>'))
  assert(result.xml.includes('<w:numPr>'))
  assert(result.usesNumbering)
})

Deno.test('richtextHtmlToWordXml maps text-align to w:jc', () => {
  const result = richtextHtmlToWordXml(
    '<p style="text-align: center;">Centro</p>' +
      '<p style="text-align:right">Derecha</p>' +
      '<h1 style="text-align: justify">Just</h1>',
  )

  assert(result.xml.includes('<w:jc w:val="center"/>'))
  assert(result.xml.includes('<w:jc w:val="right"/>'))
  assert(result.xml.includes('<w:jc w:val="both"/>'))
})

Deno.test('collectRichtextKeys treats plain string fields as rich text', () => {
  const definicion = {
    properties: {
      objetivo: { type: 'string', title: 'Objetivo' },
      modalidad: { type: 'string', enum: ['Escolar', 'Mixta'] },
      ciclos: { type: 'integer' },
      legacy: { type: 'string', 'x-richtext': true },
    },
  }

  // string sin enum → rich text; enum e integer quedan fuera; el marcador
  // legacy x-richtext sigue contando.
  assertEquals(collectRichtextKeys(definicion).sort(), ['legacy', 'objetivo'])
})

Deno.test(
  'patchRenderedRichtextHtmlInXml replaces rendered raw HTML without touching the field title',
  () => {
    const html = '<h1>hola</h1><p><strong>asdf</strong></p>'
    const xml =
      '<w:document><w:body><w:p><w:r><w:t>Perfil de egreso</w:t></w:r></w:p><w:p><w:r><w:t>&lt;h1&gt;hola&lt;/h1&gt;&lt;p&gt;&lt;strong&gt;asdf&lt;/strong&gt;&lt;/p&gt;</w:t></w:r></w:p></w:body></w:document>'

    const result = patchRenderedRichtextHtmlInXml(
      xml,
      { perfil_egreso: html },
      ['perfil_egreso'],
    )

    assertEquals(result.patchedTags, 1)
    assert(result.xml.includes('Perfil de egreso'))
    assert(!result.xml.includes('&lt;h1&gt;hola&lt;/h1&gt;'))
    assert(result.xml.includes('<w:sz w:val="32"/>'))
    assert(result.xml.includes('<w:b/>'))
  },
)

Deno.test(
  'patchRenderedRichtextHtmlInXml finds raw HTML split across Word text nodes',
  () => {
    const html = '<h1>hola</h1><p><strong>asdf</strong></p>'
    const xml =
      '<w:document><w:body><w:p><w:r><w:t>&lt;h1&gt;ho</w:t></w:r><w:r><w:t>la&lt;/h1&gt;&lt;p&gt;&lt;strong&gt;as</w:t></w:r><w:r><w:t>df&lt;/strong&gt;&lt;/p&gt;</w:t></w:r></w:p></w:body></w:document>'

    const result = patchRenderedRichtextHtmlInXml(
      xml,
      { perfil_egreso: html },
      ['perfil_egreso'],
    )

    assertEquals(result.patchedTags, 1)
    assert(!result.xml.includes('&lt;strong&gt;'))
    assert(result.xml.includes('<w:sz w:val="32"/>'))
    assert(result.xml.includes('<w:b/>'))
  },
)

Deno.test(
  'postProcessRenderedDocxRichtext patches the rendered docx and adds numbering for lists',
  () => {
    const html = '<ul><li>Uno</li></ul>'
    const docXml =
      '<w:document><w:body><w:p><w:r><w:t>&lt;ul&gt;&lt;li&gt;Uno&lt;/li&gt;&lt;/ul&gt;</w:t></w:r></w:p></w:body></w:document>'
    const buffer = zipSync({
      '[Content_Types].xml': strToU8('<Types></Types>'),
      'word/document.xml': strToU8(docXml),
      'word/_rels/document.xml.rels': strToU8(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>',
      ),
    })

    const result = postProcessRenderedDocxRichtext(
      buffer,
      { perfil_egreso: html },
      ['perfil_egreso'],
    )
    const zip = unzipSync(result.buffer)
    const patchedDocXml = strFromU8(zip['word/document.xml'])

    assertEquals(result.patchedTags, 1)
    assert(patchedDocXml.includes('<w:numPr>'))
    assert(strFromU8(zip['word/numbering.xml']).includes('<w:numbering'))
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
