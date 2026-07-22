// Ensambla los artefactos exportables a partir de learning_objects revisados:
// paquete SCORM 1.2 (ZIP con imsmanifest.xml), bundle HTML de preview (ZIP) y
// PPTX institucional. Módulo puro (sin Supabase) para poder testearlo con
// `deno test`.

import { strToU8, zipSync } from 'npm:fflate@0.8.3'

import {
  BASE_CSS,
  buildPageHtml,
  escapeHtml,
  extractContenido,
  renderObjectBody,
} from './html-render.ts'
import { type H5PActividad, renderH5PActividad } from './h5p-render.ts'
import { buildDeckPptx } from './pptx.ts'
import { buildImsManifest, SCORM_API_JS } from './scorm.ts'
import { SKILL_VERSION, theme } from './skill/theme.ts'

import type { RenderableObject } from './html-render.ts'
import type { DeckInput } from './pptx.ts'
import type { ScormGrupo } from './scorm.ts'

export type PackageObject = RenderableObject & {
  unidad_id: string | null
  tema_id: string | null
}

export type PackageContext = {
  asignaturaNombre: string
  asignaturaCodigo: string | null
  /** unidad_id/tema_id → nombre legible, resuelto desde contenido_tematico. */
  nombreUnidad: (unidadId: string | null) => string
  nombreTema: (unidadId: string | null, temaId: string | null) => string
}

export type BuiltArtifact = {
  bytes: Uint8Array
  mime: string
  extension: 'zip' | 'pptx' | 'html'
  manifest: Record<string, unknown>
}

const TIPO_LABEL: Record<PackageObject['tipo'], string> = {
  apunte: 'Apunte',
  quiz: 'Quiz',
  actividad: 'Actividad',
  ejercicios: 'Ejercicios',
  rubrica: 'Rúbrica',
  outline_presentacion: 'Presentación',
  recursos_externos: 'Recursos externos',
}

const QUIZ_MASTERY_SCORE = 70

const FONT_FILES: Array<{ path: string; url: URL }> = [
  {
    path: 'shared/fonts/IndivisaTextSans-Regular.otf',
    url: new URL(
      './assets/fonts/IndivisaTextSans-Regular.otf',
      import.meta.url,
    ),
  },
  {
    path: 'shared/fonts/IndivisaTextSans-Bold.otf',
    url: new URL('./assets/fonts/IndivisaTextSans-Bold.otf', import.meta.url),
  },
  {
    path: 'shared/fonts/IndivisaTextSerif-Regular.otf',
    url: new URL(
      './assets/fonts/IndivisaTextSerif-Regular.otf',
      import.meta.url,
    ),
  },
  {
    path: 'shared/fonts/IndivisaTextSerif-Bold.otf',
    url: new URL('./assets/fonts/IndivisaTextSerif-Bold.otf', import.meta.url),
  },
]

function addSharedStyleFiles(files: Record<string, Uint8Array>) {
  files['shared/styles.css'] = strToU8(BASE_CSS)
  for (const font of FONT_FILES) {
    try {
      files[font.path] = Deno.readFileSync(font.url)
    } catch (error) {
      console.warn('[learning-package-export] font asset unavailable', {
        path: font.path,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export function slugify(value: string, fallback = 'paquete'): string {
  const slug = value
    .normalize('NFD')
    .replace(/[^\x20-\x7e]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || fallback
}

function tituloCurso(ctx: PackageContext): string {
  return [ctx.asignaturaCodigo, ctx.asignaturaNombre]
    .filter(Boolean)
    .join(' — ')
}

type Grupo = {
  clave: string
  titulo: string
  objetos: Array<PackageObject>
}

/** Agrupa por (unidad, tema) preservando el orden de aparición. */
function agruparObjetos(
  objetos: Array<PackageObject>,
  ctx: PackageContext,
): Array<Grupo> {
  const grupos = new Map<string, Grupo>()
  for (const objeto of objetos) {
    const clave = `${objeto.unidad_id ?? ''}::${objeto.tema_id ?? ''}`
    let grupo = grupos.get(clave)
    if (!grupo) {
      const partes = [
        objeto.unidad_id ? ctx.nombreUnidad(objeto.unidad_id) : null,
        objeto.tema_id
          ? ctx.nombreTema(objeto.unidad_id, objeto.tema_id)
          : null,
      ].filter(Boolean)
      grupo = {
        clave,
        titulo: partes.length ? partes.join(' · ') : 'Contenido general',
        objetos: [],
      }
      grupos.set(clave, grupo)
    }
    grupo.objetos.push(objeto)
  }
  return [...grupos.values()]
}

function manifestBase(
  tipo: string,
  objetos: Array<PackageObject>,
): Record<string, unknown> {
  return {
    tipo,
    generado_por: 'learning-package-export',
    skill_version: SKILL_VERSION,
    objetos: objetos.map((objeto) => ({
      id: objeto.id,
      tipo: objeto.tipo,
      titulo: objeto.titulo,
      unidad_id: objeto.unidad_id,
      tema_id: objeto.tema_id,
    })),
  }
}

// ---------------------------------------------------------------------------
// SCORM 1.2
// ---------------------------------------------------------------------------

export function buildScormPackage(
  objetos: Array<PackageObject>,
  ctx: PackageContext,
): BuiltArtifact {
  const grupos = agruparObjetos(objetos, ctx)
  const files: Record<string, Uint8Array> = {
    'shared/scorm-api.js': strToU8(SCORM_API_JS),
  }
  addSharedStyleFiles(files)

  let consecutivo = 0
  const scormGrupos: Array<ScormGrupo> = grupos.map((grupo, grupoIdx) => ({
    identifier: `GRP-${grupoIdx + 1}`,
    titulo: grupo.titulo,
    scos: grupo.objetos.flatMap((objeto) => {
      // H5P ejercicios: expand into one SCO per actividad_h5p
      if (objeto.tipo === 'ejercicios') {
        const contenido = extractContenido(objeto)
        const actividadesH5P = Array.isArray(contenido.actividades_h5p)
          ? (contenido.actividades_h5p as H5PActividad[])
          : []

        if (actividadesH5P.length > 0) {
          return actividadesH5P.map((act) => {
            consecutivo++
            const href = `sco-${consecutivo}-h5p-${slugify(act.titulo || act.tipoActividad, 'ejercicio')}.html`
            // Inject scorm-api.js script before </body> in the standalone H5P HTML
            const h5pHtml = renderH5PActividad(act)
            const htmlWithScorm = h5pHtml.replace(
              '</body>',
              `<script src="shared/scorm-api.js"></script>\n</body>`,
            )
            files[href] = strToU8(htmlWithScorm)
            return {
              identifier: `SCO-${consecutivo}`,
              titulo: `${act.tipoActividad}: ${act.titulo}`,
              href,
              masteryScore: QUIZ_MASTERY_SCORE,
            }
          })
        }
      }

      // Default: one SCO per objeto
      consecutivo++
      const esQuiz = objeto.tipo === 'quiz'
      const href = `sco-${consecutivo}-${slugify(objeto.titulo, objeto.tipo)}.html`
      const bodyAttrs = esQuiz
        ? `data-scorm="quiz" data-mastery-score="${QUIZ_MASTERY_SCORE}" data-max-attempts="1"`
        : 'data-scorm="lesson"'

      files[href] = strToU8(
        buildPageHtml({
          titulo: objeto.titulo,
          bodyHtml: renderObjectBody(objeto),
          cssHref: 'shared/styles.css',
          scriptsHref: ['shared/scorm-api.js'],
          bodyAttrs,
        }),
      )

      return [{
        identifier: `SCO-${consecutivo}`,
        titulo: `${TIPO_LABEL[objeto.tipo]}: ${objeto.titulo}`,
        href,
        ...(esQuiz ? { masteryScore: QUIZ_MASTERY_SCORE } : {}),
      }]
    }),
  }))

  files['imsmanifest.xml'] = strToU8(
    buildImsManifest({
      identifier: `ACADIA-${slugify(tituloCurso(ctx), 'curso')}`,
      tituloCurso: tituloCurso(ctx),
      grupos: scormGrupos,
      sharedFiles: [
        'shared/styles.css',
        'shared/scorm-api.js',
        ...FONT_FILES.map((font) => font.path),
      ],
    }),
  )

  return {
    bytes: zipSync(files),
    mime: 'application/zip',
    extension: 'zip',
    manifest: {
      ...manifestBase('scorm_1_2', objetos),
      schemaversion: '1.2',
      mastery_score: QUIZ_MASTERY_SCORE,
      archivos: Object.keys(files),
    },
  }
}

// ---------------------------------------------------------------------------
// Bundle HTML de preview
// ---------------------------------------------------------------------------

export function buildHtmlBundle(
  objetos: Array<PackageObject>,
  ctx: PackageContext,
): BuiltArtifact {
  const grupos = agruparObjetos(objetos, ctx)
  const files: Record<string, Uint8Array> = {}
  addSharedStyleFiles(files)

  let consecutivo = 0
  const navSecciones = grupos
    .map((grupo) => {
      const enlaces = grupo.objetos
        .map((objeto) => {
          consecutivo++
          const href = `pagina-${consecutivo}-${slugify(objeto.titulo, objeto.tipo)}.html`
          files[href] = strToU8(
            buildPageHtml({
              titulo: objeto.titulo,
              bodyHtml: `${renderObjectBody(objeto)}\n<p><a href="index.html">← Volver al índice</a></p>`,
              cssHref: 'shared/styles.css',
            }),
          )
          return `<li><a href="${href}">${escapeHtml(objeto.titulo)}</a><span class="badge">${TIPO_LABEL[objeto.tipo]}</span></li>`
        })
        .join('\n')

      return `<section><h2>${escapeHtml(grupo.titulo)}</h2><ul>${enlaces}</ul></section>`
    })
    .join('\n')

  files['index.html'] = strToU8(
    buildPageHtml({
      titulo: tituloCurso(ctx),
      bodyHtml: `<header><h1>${escapeHtml(tituloCurso(ctx))}</h1><p class="descripcion">Vista previa de recursos — ${escapeHtml(theme.institucion)}</p></header>\n<nav class="indice">${navSecciones}</nav>`,
      cssHref: 'shared/styles.css',
    }),
  )

  return {
    bytes: zipSync(files),
    mime: 'application/zip',
    extension: 'zip',
    manifest: {
      ...manifestBase('html_bundle', objetos),
      archivos: Object.keys(files),
    },
  }
}

// ---------------------------------------------------------------------------
// PPTX institucional
// ---------------------------------------------------------------------------

function asArray(value: unknown): Array<unknown> {
  return Array.isArray(value) ? value : []
}

function toDeck(objeto: PackageObject, ctx: PackageContext): DeckInput {
  const contenido = extractContenido(objeto)
  const subtituloPartes = [
    tituloCurso(ctx),
    objeto.unidad_id ? ctx.nombreUnidad(objeto.unidad_id) : null,
    objeto.tema_id ? ctx.nombreTema(objeto.unidad_id, objeto.tema_id) : null,
  ].filter(Boolean)

  const diapositivas = asArray(contenido.diapositivas).flatMap(
    (diapositiva): Array<DeckInput['diapositivas'][number]> => {
      const d = diapositiva as Record<string, unknown> | null
      if (!d || typeof d !== 'object') return []
      const titulo = typeof d.titulo === 'string' ? d.titulo : ''
      const puntos = asArray(d.puntos).map((punto) => String(punto ?? ''))
      if (!titulo && !puntos.length) return []
      const notas =
        typeof d.notas_docente === 'string' && d.notas_docente
          ? d.notas_docente
          : undefined
      return [
        notas === undefined ? { titulo, puntos } : { titulo, puntos, notas },
      ]
    },
  )

  const fuentes = asArray(objeto.source_refs)
    .map((ref) => {
      const r = ref as Record<string, unknown> | null
      if (!r || typeof r !== 'object') return null
      return {
        titulo: typeof r.titulo === 'string' ? r.titulo : '',
        autor: typeof r.autor === 'string' ? r.autor : null,
        licencia: typeof r.licencia === 'string' ? r.licencia : null,
      }
    })
    .filter((f): f is NonNullable<typeof f> => f !== null && Boolean(f.titulo))

  return {
    tituloPresentacion:
      (typeof contenido.titulo_presentacion === 'string' &&
        contenido.titulo_presentacion) ||
      objeto.titulo,
    subtitulo: subtituloPartes.join(' · '),
    diapositivas,
    fuentes,
  }
}

export async function buildPptxPackage(
  objetos: Array<PackageObject>,
  ctx: PackageContext,
): Promise<BuiltArtifact> {
  const outlines = objetos.filter((o) => o.tipo === 'outline_presentacion')
  const decks = outlines.map((objeto) => toDeck(objeto, ctx))
  const bytes = await buildDeckPptx(decks)

  return {
    bytes,
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extension: 'pptx',
    manifest: {
      ...manifestBase('pptx_bundle', outlines),
      decks: decks.map((deck) => ({
        titulo: deck.tituloPresentacion,
        diapositivas: deck.diapositivas.length,
        fuentes: deck.fuentes.length,
      })),
    },
  }
}
