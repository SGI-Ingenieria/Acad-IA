// Builder de presentaciones institucionales. Aplica el tema del skill
// (skill/theme.ts) sobre outlines revisados (learning_objects de tipo
// outline_presentacion). No llama a ningún modelo: convierte contenido
// aprobado en un archivo real.

import PptxGenJSImport from 'npm:pptxgenjs@3.12.0'

import { theme } from './skill/theme.ts'

// El .d.ts de pptxgenjs (export default sobre un paquete CJS) no interopera
// con el chequeo de Deno; se tipa estructuralmente la superficie usada.
type PptxTextRun = { text: string; options?: Record<string, unknown> }
type PptxSlide = {
  background: { color: string }
  addText: (
    text: string | Array<PptxTextRun>,
    opts: Record<string, unknown>,
  ) => void
  addShape: (type: string, opts: Record<string, unknown>) => void
  addNotes: (notes: string) => void
}
type PptxPresentation = {
  defineLayout: (layout: {
    name: string
    width: number
    height: number
  }) => void
  layout: string
  author: string
  company: string
  title: string
  addSlide: () => PptxSlide
  write: (opts: { outputType: 'arraybuffer' }) => Promise<ArrayBuffer>
}

const PptxGenJS = PptxGenJSImport as unknown as new () => PptxPresentation

export type DeckDiapositiva = {
  titulo: string
  puntos: Array<string>
  notas?: string
}

export type DeckFuente = {
  titulo: string
  autor?: string | null
  licencia?: string | null
}

export type DeckInput = {
  tituloPresentacion: string
  subtitulo: string
  diapositivas: Array<DeckDiapositiva>
  fuentes: Array<DeckFuente>
}

const SLIDE_W = 10
const SLIDE_H = 5.625

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

/** Regla del skill: máx. bullets por slide; el resto pasa a slides "(cont.)". */
function paginarDiapositivas(
  diapositivas: Array<DeckDiapositiva>,
): Array<DeckDiapositiva> {
  const max = theme.layout.maxBulletsPorSlide
  const paginadas: Array<DeckDiapositiva> = []

  for (const diapositiva of diapositivas) {
    if (diapositiva.puntos.length <= max) {
      paginadas.push(diapositiva)
      continue
    }
    for (let inicio = 0; inicio < diapositiva.puntos.length; inicio += max) {
      paginadas.push({
        titulo:
          inicio === 0 ? diapositiva.titulo : `${diapositiva.titulo} (cont.)`,
        puntos: diapositiva.puntos.slice(inicio, inicio + max),
        notas: inicio === 0 ? diapositiva.notas : undefined,
      })
    }
  }

  return paginadas.slice(0, theme.layout.maxSlidesDesarrollo)
}

function addPortada(pptx: PptxPresentation, deck: DeckInput) {
  const slide = pptx.addSlide()
  slide.background = { color: theme.colores.fondoPortada }
  slide.addText(truncate(deck.tituloPresentacion, 120), {
    x: theme.layout.margenX,
    y: 1.7,
    w: SLIDE_W - theme.layout.margenX * 2,
    h: 1.4,
    fontFace: theme.fuentes.titulos,
    fontSize: 32,
    color: theme.colores.textoPortada,
    bold: true,
  })
  slide.addText(deck.subtitulo, {
    x: theme.layout.margenX,
    y: 3.1,
    w: SLIDE_W - theme.layout.margenX * 2,
    h: 0.8,
    fontFace: theme.fuentes.cuerpo,
    fontSize: 16,
    color: theme.colores.acento,
  })
  slide.addText(theme.institucion, {
    x: theme.layout.margenX,
    y: SLIDE_H - 0.7,
    w: SLIDE_W - theme.layout.margenX * 2,
    h: 0.4,
    fontFace: theme.fuentes.cuerpo,
    fontSize: 11,
    color: theme.colores.textoPortada,
  })
}

function addSlideContenido(
  pptx: PptxPresentation,
  diapositiva: DeckDiapositiva,
) {
  const slide = pptx.addSlide()
  slide.background = { color: theme.colores.fondo }
  slide.addText(truncate(diapositiva.titulo, 90), {
    x: theme.layout.margenX,
    y: theme.layout.tituloY,
    w: SLIDE_W - theme.layout.margenX * 2,
    h: 0.7,
    fontFace: theme.fuentes.titulos,
    fontSize: 24,
    color: theme.colores.primario,
    bold: true,
  })
  slide.addShape('line', {
    x: theme.layout.margenX,
    y: theme.layout.contenidoY - 0.15,
    w: SLIDE_W - theme.layout.margenX * 2,
    h: 0,
    line: { color: theme.colores.acento, width: 1.5 },
  })

  if (diapositiva.puntos.length) {
    slide.addText(
      diapositiva.puntos.map((punto) => ({
        text: punto,
        options: { bullet: { characterCode: '2022', indent: 14 } },
      })),
      {
        x: theme.layout.margenX,
        y: theme.layout.contenidoY,
        w: SLIDE_W - theme.layout.margenX * 2,
        h: SLIDE_H - theme.layout.contenidoY - 0.5,
        fontFace: theme.fuentes.cuerpo,
        fontSize: 16,
        color: theme.colores.texto,
        valign: 'top',
        paraSpaceAfter: 8,
      },
    )
  }

  if (diapositiva.notas) slide.addNotes(diapositiva.notas)
}

function addFuentes(pptx: PptxPresentation, fuentes: Array<DeckFuente>) {
  // Regla del skill: solo fuentes con datos citables; nada se inventa.
  const citables = fuentes.filter((fuente) => fuente.titulo.trim())
  if (!citables.length) return

  const slide = pptx.addSlide()
  slide.background = { color: theme.colores.fondo }
  slide.addText('Fuentes', {
    x: theme.layout.margenX,
    y: theme.layout.tituloY,
    w: SLIDE_W - theme.layout.margenX * 2,
    h: 0.7,
    fontFace: theme.fuentes.titulos,
    fontSize: 24,
    color: theme.colores.primario,
    bold: true,
  })
  slide.addText(
    citables.slice(0, 12).map((fuente) => ({
      text: truncate(
        [fuente.autor, fuente.titulo].filter(Boolean).join('. ') +
          (fuente.licencia ? ` (${fuente.licencia})` : ''),
        160,
      ),
      options: { bullet: { characterCode: '2022', indent: 14 } },
    })),
    {
      x: theme.layout.margenX,
      y: theme.layout.contenidoY,
      w: SLIDE_W - theme.layout.margenX * 2,
      h: SLIDE_H - theme.layout.contenidoY - 0.5,
      fontFace: theme.fuentes.cuerpo,
      fontSize: 12,
      color: theme.colores.textoSuave,
      valign: 'top',
      paraSpaceAfter: 6,
    },
  )
}

function addCierre(pptx: PptxPresentation) {
  const slide = pptx.addSlide()
  slide.background = { color: theme.colores.fondoPortada }
  slide.addText('Gracias', {
    x: theme.layout.margenX,
    y: 2.2,
    w: SLIDE_W - theme.layout.margenX * 2,
    h: 1,
    fontFace: theme.fuentes.titulos,
    fontSize: 36,
    color: theme.colores.textoPortada,
    bold: true,
    align: 'center',
  })
  slide.addText(theme.institucion, {
    x: theme.layout.margenX,
    y: 3.3,
    w: SLIDE_W - theme.layout.margenX * 2,
    h: 0.5,
    fontFace: theme.fuentes.cuerpo,
    fontSize: 14,
    color: theme.colores.acento,
    align: 'center',
  })
}

/**
 * Construye un único PPTX. Con varios decks (scope unidad/asignatura) cada
 * outline aporta su portada de sección y sus diapositivas; el cierre es único.
 */
export async function buildDeckPptx(
  decks: Array<DeckInput>,
): Promise<Uint8Array> {
  if (!decks.length) {
    throw new Error('buildDeckPptx requiere al menos un outline')
  }

  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'ACADIA_16x9', width: SLIDE_W, height: SLIDE_H })
  pptx.layout = 'ACADIA_16x9'
  pptx.author = theme.institucion
  pptx.company = theme.institucion
  pptx.title = decks[0].tituloPresentacion

  for (const deck of decks) {
    addPortada(pptx, deck)

    const diapositivas = paginarDiapositivas(deck.diapositivas)
    if (diapositivas.length > 4) {
      addSlideContenido(pptx, {
        titulo: 'Agenda',
        puntos: [...new Set(diapositivas.map((d) => d.titulo))].slice(0, 8),
      })
    }
    for (const diapositiva of diapositivas) {
      addSlideContenido(pptx, diapositiva)
    }
    addFuentes(pptx, deck.fuentes)
  }

  addCierre(pptx)

  const buffer = await pptx.write({ outputType: 'arraybuffer' })
  return new Uint8Array(buffer)
}
