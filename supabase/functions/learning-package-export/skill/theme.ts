// Tema institucional del skill de presentaciones. Es la única fuente de
// tokens visuales del deck: el builder (pptx.ts) no acepta overrides.

export const SKILL_VERSION = '1.0.0'

export const theme = {
  institucion: 'Universidad La Salle - Acad-IA',
  colores: {
    // Hex sin '#', como los espera pptxgenjs.
    primario: '28356E',
    acento: '0D99D9',
    acentoSuave: '95D2F1',
    acentoCalido: 'D72130',
    texto: '3C3C3C',
    textoSuave: '313C41',
    fondo: 'FFFFFF',
    fondoPortada: '28356E',
    textoPortada: 'FFFFFF',
    linea: '95D2F1',
  },
  fuentes: {
    titulos: 'Indivisa Text Serif',
    cuerpo: 'Indivisa Text Sans',
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
