// Tema institucional del skill de presentaciones. Es la única fuente de
// tokens visuales del deck: el builder (pptx.ts) no acepta overrides.

export const SKILL_VERSION = '1.0.0'

export const theme = {
  institucion: 'Universidad La Salle — Acad-IA',
  colores: {
    // Hex sin '#', como los espera pptxgenjs.
    primario: '00335B',
    acento: 'C8A24B',
    texto: '1F2937',
    textoSuave: '5B6472',
    fondo: 'FFFFFF',
    fondoPortada: '00335B',
    textoPortada: 'FFFFFF',
    linea: 'D6DAE0',
  },
  fuentes: {
    titulos: 'Segoe UI Semibold',
    cuerpo: 'Segoe UI',
  },
  layout: {
    // Pulgadas, layout 16:9 (10 x 5.625).
    margenX: 0.6,
    tituloY: 0.45,
    contenidoY: 1.35,
    maxBulletsPorSlide: 6,
    maxSlidesDesarrollo: 24,
  },
} as const

export type SkillTheme = typeof theme
