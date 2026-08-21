import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import { strFromU8, unzipSync } from 'npm:fflate@0.8.3'

import {
  buildHtmlBundle,
  buildPptxPackage,
  buildScormPackage,
  slugify,
} from '../../learning-package-export/packager.ts'
import { buildImsManifest } from '../../learning-package-export/scorm.ts'
import {
  escapeHtml,
  renderObjectBody,
} from '../../learning-package-export/html-render.ts'
import { renderH5PActividad } from '../../learning-package-export/h5p-render.ts'

import type {
  PackageContext,
  PackageObject,
} from '../../learning-package-export/packager.ts'

const ctx: PackageContext = {
  asignaturaNombre: 'Cálculo I',
  asignaturaCodigo: 'MAT-101',
  nombreUnidad: (unidadId) =>
    unidadId === 'u1' ? 'Unidad 1: Límites' : `Unidad ${unidadId}`,
  nombreTema: (_unidadId, temaId) =>
    temaId === 't1' ? 'Tema 1: Concepto de límite' : `Tema ${temaId}`,
}

Deno.test('FindMultipleHotspots usa la URL de imagen generada', () => {
  const html = renderH5PActividad({
    titulo: 'Identifica las partes de la celula',
    descripcion: 'Selecciona los organulos correctos.',
    nivel: 'Intermedio',
    idioma: 'es',
    tipoActividad: 'FindMultipleHotspots',
    datos: {
      imagenUrl: 'https://ejemplo.edu/imagenes/celula.png',
      imagenAlt: 'Ilustracion de una celula animal.',
      hotspots: [
        {
          x: 25,
          y: 50,
          correcto: true,
          etiqueta: 'Nucleo',
          retroalimentacion: 'Correcto.',
        },
      ],
    },
  })

  assertStringIncludes(
    html,
    "background-image:url('https://ejemplo.edu/imagenes/celula.png')",
  )
  assertStringIncludes(html, 'class="fmh-hotspot"')
})

Deno.test('FindMultipleHotspots sustituye una URL interna de Docker', () => {
  const html = renderH5PActividad({
    titulo: 'Partes del algoritmo',
    descripcion: 'Selecciona las zonas.',
    nivel: 'Intermedio',
    idioma: 'es',
    tipoActividad: 'FindMultipleHotspots',
    datos: {
      imagenUrl:
        'http://kong:8000/storage/v1/object/public/learning-media/diagrama.png',
      hotspots: [],
    },
  })

  assertStringIncludes(
    html,
    "background-image:url('http://127.0.0.1:54321/storage/v1/object/public/learning-media/diagrama.png')",
  )
})

Deno.test(
  'FindMultipleHotspots sustituye el origen interno de Envoy en AKS',
  () => {
    const previousInternal = Deno.env.get('SUPABASE_URL')
    const previousPublic = Deno.env.get('SUPABASE_PUBLIC_URL')

    try {
      Deno.env.set('SUPABASE_URL', 'http://supabase-envoy:8000')
      Deno.env.set(
        'SUPABASE_PUBLIC_URL',
        'https://supabase.acad-ia.example.edu.mx',
      )

      const html = renderH5PActividad({
        titulo: 'Partes del algoritmo',
        descripcion: 'Selecciona las zonas.',
        nivel: 'Intermedio',
        idioma: 'es',
        tipoActividad: 'FindMultipleHotspots',
        datos: {
          imagenUrl:
            'http://supabase-envoy:8000/storage/v1/object/public/learning-media/diagrama.png',
          hotspots: [],
        },
      })

      assertStringIncludes(
        html,
        "background-image:url('https://supabase.acad-ia.example.edu.mx/storage/v1/object/public/learning-media/diagrama.png')",
      )
    } finally {
      if (previousInternal === undefined) Deno.env.delete('SUPABASE_URL')
      else Deno.env.set('SUPABASE_URL', previousInternal)

      if (previousPublic === undefined) Deno.env.delete('SUPABASE_PUBLIC_URL')
      else Deno.env.set('SUPABASE_PUBLIC_URL', previousPublic)
    }
  },
)

Deno.test(
  'un apunte aÃ­sla cada actividad H5P en un iframe interactivo',
  () => {
    const html = renderObjectBody(
      objeto({
        contenido_json: {
          apunte: {
            objetivo: 'Repasar.',
            introduccion: 'IntroducciÃ³n.',
            secciones: [],
            conceptos_clave: [],
            ejemplo_aplicado: '',
            cierre: '',
          },
          ejercicios: {
            actividades_h5p: [
              {
                titulo: 'Tarjetas 1',
                descripcion: '',
                nivel: 'Intermedio',
                idioma: 'es',
                tipoActividad: 'Flashcards',
                datos: { tarjetas: [{ frente: 'A', reverso: 'B' }] },
              },
              {
                titulo: 'Tarjetas 2',
                descripcion: '',
                nivel: 'Intermedio',
                idioma: 'es',
                tipoActividad: 'Flashcards',
                datos: { tarjetas: [{ frente: 'C', reverso: 'D' }] },
              },
            ],
          },
        },
      }),
    )

    assertEquals((html.match(/class="h5p-actividad-frame"/g) ?? []).length, 2)
    assertStringIncludes(html, 'sandbox="allow-scripts"')
    assertStringIncludes(html, 'srcdoc="&lt;!doctype html&gt;')
  },
)

function objeto(overrides: Partial<PackageObject>): PackageObject {
  return {
    id: 'lo-1',
    tipo: 'apunte',
    titulo: 'Apunte base',
    descripcion: 'Descripción',
    unidad_id: 'u1',
    tema_id: 't1',
    contenido_json: {},
    source_refs: [],
    ...overrides,
  }
}

const apunte = objeto({
  id: 'lo-apunte',
  contenido_json: {
    apunte: {
      objetivo: 'Comprender el concepto de límite',
      introduccion: 'Introducción al tema',
      secciones: [
        {
          titulo: 'Definición',
          desarrollo: 'Una función f(x)...',
          source_ref_ids: [],
        },
      ],
      conceptos_clave: ['límite', 'continuidad'],
      ejemplo_aplicado: 'Ejemplo',
      cierre: 'Cierre',
    },
  },
  source_refs: [
    {
      id: 's1',
      titulo: 'Cálculo de una variable',
      autor: 'Stewart, J.',
      licencia: 'Uso editorial',
      url: null,
    },
  ],
})

const quiz = objeto({
  id: 'lo-quiz',
  tipo: 'quiz',
  titulo: 'Quiz diagnóstico <script>alert(1)</script>',
  contenido_json: {
    quiz: {
      instrucciones: 'Responde',
      preguntas: [
        {
          pregunta: '¿Qué es un límite? </script><b>x</b>',
          opciones: [
            { id: 'a', texto: 'Opción A' },
            { id: 'b', texto: 'Opción B' },
          ],
          respuesta_correcta: 'a',
          retroalimentacion: 'Bien',
          source_ref_ids: [],
        },
      ],
    },
  },
})

const outline = objeto({
  id: 'lo-outline',
  tipo: 'outline_presentacion',
  titulo: 'Presentación: límites',
  contenido_json: {
    outline_presentacion: {
      titulo_presentacion: 'Límites y continuidad',
      diapositivas: [
        {
          numero: 1,
          titulo: 'Introducción',
          puntos: [
            'Punto 1',
            'Punto 2',
            'Punto 3',
            'Punto 4',
            'Punto 5',
            'Punto 6',
            'Punto 7',
          ],
          notas_docente: 'Abrir con una pregunta detonadora',
          source_ref_ids: [],
        },
        {
          numero: 2,
          titulo: 'Definición formal',
          puntos: ['Épsilon-delta'],
          notas_docente: '',
          source_ref_ids: [],
        },
      ],
    },
  },
  source_refs: [
    {
      id: 's1',
      titulo: 'Cálculo de una variable',
      autor: 'Stewart, J.',
      licencia: null,
    },
  ],
})

Deno.test('slugify normaliza acentos y caracteres especiales', () => {
  assertEquals(slugify('Cálculo I — Límites'), 'calculo-i-limites')
  assertEquals(slugify('***'), 'paquete')
  assertEquals(slugify('', 'fallback'), 'fallback')
})

Deno.test(
  'buildImsManifest produce XML SCORM 1.2 con masteryscore y escapes',
  () => {
    const xml = buildImsManifest({
      identifier: 'ACADIA-TEST',
      tituloCurso: 'Curso <A&B>',
      grupos: [
        {
          identifier: 'GRP-1',
          titulo: 'Unidad 1',
          scos: [
            { identifier: 'SCO-1', titulo: 'Apunte', href: 'sco-1.html' },
            {
              identifier: 'SCO-2',
              titulo: 'Quiz',
              href: 'sco-2.html',
              masteryScore: 70,
            },
          ],
        },
      ],
      sharedFiles: ['shared/styles.css', 'shared/scorm-api.js'],
    })

    assertStringIncludes(xml, '<schemaversion>1.2</schemaversion>')
    assertStringIncludes(xml, 'adlcp:scormtype="sco"')
    assertStringIncludes(xml, '<adlcp:masteryscore>70</adlcp:masteryscore>')
    assertStringIncludes(xml, '<title>Curso &lt;A&amp;B&gt;</title>')
    assertStringIncludes(xml, 'identifierref="RES-SCO-1"')
    assertStringIncludes(xml, '<file href="shared/scorm-api.js"/>')
    assert(!xml.includes('<title>Curso <A&B>'))
  },
)

Deno.test('renderObjectBody escapa HTML malicioso en quizzes', () => {
  const html = renderObjectBody(quiz)
  assertStringIncludes(html, '&lt;script&gt;alert(1)&lt;/script&gt;')
  assertStringIncludes(html, '&lt;b&gt;x&lt;/b&gt;')
  // El JSON embebido no puede contener '</script>' literal.
  assert(!html.includes('</script><b>'))
  assertStringIncludes(html, 'window.AcadScorm')
  assertStringIncludes(html, "form.dataset.submitted === 'true'")
  assertStringIncludes(html, 'input.disabled = true')
  assertStringIncludes(html, 'Intento enviado')
})

Deno.test('renderObjectBody renderiza fracciones como matemáticas', () => {
  const html = renderObjectBody(
    objeto({
      id: 'lo-ejercicios',
      tipo: 'ejercicios',
      titulo: 'Ejercicios con series',
      contenido_json: {
        ejercicios: {
          instrucciones: 'Resuelve con cuidado.',
          ejercicios: [
            {
              enunciado: 'Calcula 1/2 + 1/4 + 1/8 + 1/16 + ... y justifica.',
              dificultad: 'intermedio',
              pista: 'Usa \\(\\frac{a}{1-r}\\).',
              solucion_esperada: 'La serie equivale a \\(\\frac{1}{1}\\).',
              source_ref_ids: [],
            },
          ],
        },
      },
    }),
  )

  assertStringIncludes(html, 'class="math"')
  assertStringIncludes(html, 'class="math-frac"')
  assertStringIncludes(html, '<span class="math-den">2</span>')
  assertStringIncludes(html, '<span class="math-den">16</span>')
  assertStringIncludes(html, '<span class="math-ellipsis">...</span>')
})

Deno.test('escapeHtml cubre comillas y ampersand', () => {
  assertEquals(
    escapeHtml(`<a href="x">'&'</a>`),
    '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
  )
})

Deno.test('buildScormPackage genera ZIP con imsmanifest.xml y SCOs', () => {
  const artifact = buildScormPackage([apunte, quiz], ctx)
  assertEquals(artifact.extension, 'zip')

  const files = unzipSync(artifact.bytes)
  const nombres = Object.keys(files)
  assert(nombres.includes('imsmanifest.xml'))
  assert(nombres.includes('shared/scorm-api.js'))
  assert(nombres.includes('shared/styles.css'))

  const manifest = strFromU8(files['imsmanifest.xml'])
  assertStringIncludes(manifest, 'MAT-101 — Cálculo I')
  assertStringIncludes(
    manifest,
    'Unidad 1: Límites · Tema 1: Concepto de límite',
  )
  assertStringIncludes(manifest, '<adlcp:masteryscore>70</adlcp:masteryscore>')

  const scoQuiz = nombres.find(
    (n) => n.startsWith('sco-') && n.includes('quiz'),
  )
  assert(scoQuiz, 'debe existir un SCO para el quiz')
  const quizHtml = strFromU8(files[scoQuiz])
  assertStringIncludes(quizHtml, 'data-scorm="quiz"')
  assertStringIncludes(quizHtml, 'data-mastery-score="70"')
  assertStringIncludes(quizHtml, 'data-max-attempts="1"')
  assertStringIncludes(quizHtml, 'shared/scorm-api.js')
  assertStringIncludes(quizHtml, 'Intento enviado')

  assert(nombres.includes('shared/fonts/IndivisaTextSans-Regular.otf'))
  assert(nombres.includes('shared/fonts/IndivisaTextSans-Bold.otf'))
  assert(nombres.includes('shared/fonts/IndivisaTextSerif-Regular.otf'))
  assert(nombres.includes('shared/fonts/IndivisaTextSerif-Bold.otf'))
  assertStringIncludes(strFromU8(files['shared/styles.css']), 'Indivisa Text')

  const scoApunte = nombres.find(
    (n) => n.startsWith('sco-') && n.includes('apunte'),
  )
  assert(scoApunte, 'debe existir un SCO para el apunte')
  assertStringIncludes(strFromU8(files[scoApunte]), 'data-scorm="lesson"')
  // Las fuentes del apunte se citan en la página.
  assertStringIncludes(strFromU8(files[scoApunte]), 'Stewart, J.')
})

Deno.test(
  'buildScormPackage conserva el apunte y sus actividades H5P en un solo paquete',
  () => {
    const apunteConFlashcards = objeto({
      ...apunte,
      contenido_json: {
        ...(apunte.contenido_json as Record<string, unknown>),
        ejercicios: {
          instrucciones: 'Repasa los conceptos.',
          actividades_h5p: [
            {
              titulo: 'Conceptos clave',
              descripcion: 'Autoevaluación breve.',
              nivel: 'Intermedio',
              idioma: 'es',
              tipoActividad: 'Flashcards',
              datos: {
                tarjetas: [
                  { frente: 'Límite', reverso: 'Valor de aproximación.' },
                ],
              },
            },
          ],
        },
      },
    })

    const files = unzipSync(buildScormPackage([apunteConFlashcards], ctx).bytes)
    const nombres = Object.keys(files)
    const scoApunte = nombres.find(
      (n) => n.startsWith('sco-') && n.includes('apunte'),
    )
    const scoH5P = nombres.find(
      (n) => n.startsWith('sco-') && n.includes('h5p-conceptos-clave'),
    )

    assert(scoApunte, 'debe incluir el SCO del apunte')
    assert(scoH5P, 'debe incluir el SCO de la actividad complementaria')
    assertStringIncludes(strFromU8(files[scoApunte]), 'Introducción al tema')
    assertStringIncludes(strFromU8(files[scoH5P]), 'Conceptos clave')
  },
)

Deno.test('buildHtmlBundle genera índice navegable', () => {
  const artifact = buildHtmlBundle([apunte, quiz, outline], ctx)
  const files = unzipSync(artifact.bytes)
  const index = strFromU8(files['index.html'])

  assertStringIncludes(index, 'MAT-101 — Cálculo I')
  assertStringIncludes(index, 'Unidad 1: Límites · Tema 1: Concepto de límite')
  for (const nombre of Object.keys(files)) {
    if (nombre.startsWith('pagina-')) {
      assertStringIncludes(index, `href="${nombre}"`)
      assertStringIncludes(strFromU8(files[nombre]), 'index.html')
    }
  }
  // Sin wrapper SCORM en el bundle de preview.
  assert(!Object.keys(files).includes('shared/scorm-api.js'))
  assert(
    Object.keys(files).includes('shared/fonts/IndivisaTextSans-Regular.otf'),
  )
})

Deno.test(
  'buildPptxPackage genera un PPTX válido con notas y paginación',
  async () => {
    const artifact = await buildPptxPackage([outline], ctx)
    assertEquals(artifact.extension, 'pptx')
    // Firma ZIP (PK\x03\x04).
    assertEquals(artifact.bytes[0], 0x50)
    assertEquals(artifact.bytes[1], 0x4b)

    const files = unzipSync(artifact.bytes)
    const nombres = Object.keys(files)
    assert(nombres.includes('ppt/presentation.xml'))

    const slides = nombres.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    // Portada + agenda? (2 slides de contenido tras paginar 7 bullets → 2) +
    // fuentes + cierre: al menos 5 slides.
    assert(slides.length >= 5, `esperaba >= 5 slides, hay ${slides.length}`)

    const todoElXml = slides.map((n) => strFromU8(files[n])).join('')
    assertStringIncludes(todoElXml, 'Límites y continuidad')
    assertStringIncludes(todoElXml, '(cont.)')

    const notas = nombres.filter((n) => n.startsWith('ppt/notesSlides/'))
    assert(notas.length >= 1, 'debe haber notas del orador')
    assertStringIncludes(
      notas.map((n) => strFromU8(files[n])).join(''),
      'pregunta detonadora',
    )

    const manifest = artifact.manifest as {
      decks: Array<{ diapositivas: number }>
    }
    assertEquals(manifest.decks.length, 1)
  },
)
