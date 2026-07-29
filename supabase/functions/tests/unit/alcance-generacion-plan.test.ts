import {
  ALCANCE_POR_DEFECTO,
  normalizarAlcance,
} from '../../ai-generate-plan/alcance.ts'

Deno.test(
  'organizar asignaturas en el mapa requiere asignaturas y líneas curriculares',
  () => {
    const sinLineas = normalizarAlcance({
      ...ALCANCE_POR_DEFECTO,
      lineasCurriculares: false,
      asignaturas: true,
      acomodarAsignaturas: true,
      ordenarAsignaturas: true,
    })

    if (sinLineas.acomodarAsignaturas || sinLineas.ordenarAsignaturas) {
      throw new Error('No debe organizar el mapa sin líneas curriculares.')
    }
  },
)

Deno.test(
  'acomodar y ordenar representan una sola configuración del mapa',
  () => {
    const alcance = normalizarAlcance({
      ...ALCANCE_POR_DEFECTO,
      lineasCurriculares: true,
      asignaturas: true,
      acomodarAsignaturas: true,
      ordenarAsignaturas: false,
    })

    if (!alcance.acomodarAsignaturas || !alcance.ordenarAsignaturas) {
      throw new Error('La organización del mapa debe aplicarse completa.')
    }
  },
)
