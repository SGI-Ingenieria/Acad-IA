import { describe, expect, test } from 'bun:test'

import {
  camposPorPaso,
  errorPasoActual,
  preguntasSinResponder,
  valoresInicialesNuevoPlan,
} from './schema'

import type { NuevoPlanFormValues } from './types'

/** Datos básicos completos de un plan curricular. */
function basicosCompletos(): NuevoPlanFormValues {
  const base = valoresInicialesNuevoPlan()
  return {
    ...base,
    tipoOrigen: 'IA',
    datosBasicos: {
      ...base.datosBasicos,
      carrera: { id: 'c1', nombre: 'Química de Alimentos' },
      facultad: { id: 'f1', nombre: 'Facultad de Ciencias Químicas' },
      tipoCiclo: 'Semestre',
      numCiclos: 9,
      tipoEstructura: 'CURRICULAR',
      estructuraPlanId: 'e1',
      fechaInicioImparticion: '2099-08-01',
    },
    confirmarFechaPasada: false,
  }
}

describe('errorPasoActual — método', () => {
  test('sin método elegido la acción principal está bloqueada', () => {
    expect(errorPasoActual('modo', valoresInicialesNuevoPlan(), true)).toBe(
      'Selecciona un método de creación para continuar.',
    )
  })
})

describe('valores iniciales — ciclos', () => {
  test('el número empieza en el mínimo válido y nunca se presenta como cero', () => {
    expect(valoresInicialesNuevoPlan().datosBasicos.numCiclos).toBe(1)
  })
})

describe('pasos intermedios del ámbito', () => {
  test('cada decisión explica únicamente lo que falta en su paso', () => {
    const valores = valoresInicialesNuevoPlan()

    expect(errorPasoActual('tipo', valores, true)).toBe(
      'Selecciona el tipo de plan de estudios para continuar.',
    )
    valores.datosBasicos.tipoEstructura = 'CURRICULAR'
    valores.datosBasicos.estructuraPlanId = 'e1'
    expect(errorPasoActual('tipo', valores, true)).toBeNull()

    expect(errorPasoActual('facultad', valores, true)).toBe(
      'Selecciona una facultad para continuar.',
    )
    valores.datosBasicos.facultad = { id: 'f1', nombre: 'Ciencias Químicas' }
    expect(errorPasoActual('facultad', valores, true)).toBeNull()

    expect(errorPasoActual('carrera', valores, true)).toBe(
      'Selecciona una carrera para continuar.',
    )
    valores.datosBasicos.carrera = { id: 'c1', nombre: 'Química de Alimentos' }
    expect(errorPasoActual('carrera', valores, true)).toBeNull()
  })

  test('datos básicos ya no intenta validar controles desmontados del ámbito', () => {
    expect(camposPorPaso('tipo', 'IA', true)).toEqual([
      'datosBasicos.tipoEstructura',
    ])
    expect(camposPorPaso('facultad', 'IA', true)).toEqual([
      'datosBasicos.facultad',
    ])
    expect(camposPorPaso('carrera', 'IA', true)).toEqual([
      'datosBasicos.carrera',
    ])
    expect(camposPorPaso('basicos', 'IA', true)).not.toContain(
      'datosBasicos.tipoEstructura',
    )
    expect(camposPorPaso('basicos', 'IA', true)).not.toContain(
      'datosBasicos.facultad',
    )
    expect(camposPorPaso('basicos', 'IA', true)).not.toContain(
      'datosBasicos.carrera',
    )
  })
})

describe('errorPasoActual — datos básicos', () => {
  test('explica el primer dato que falta', () => {
    const valores = valoresInicialesNuevoPlan()
    valores.tipoOrigen = 'IA'

    expect(errorPasoActual('basicos', valores, true)).toBeTruthy()
  })

  test('con los datos completos deja de bloquear', () => {
    expect(errorPasoActual('basicos', basicosCompletos(), true)).toBeNull()
  })

  test('un ciclo «Otro» sin semanas bloquea el paso', () => {
    const valores = basicosCompletos()
    valores.datosBasicos.tipoCiclo = 'Otro'

    expect(errorPasoActual('basicos', valores, true)).toBe(
      'Indica cuántas semanas dura cada ciclo.',
    )

    valores.datosBasicos.semanasPorCiclo = 12
    expect(errorPasoActual('basicos', valores, true)).toBeNull()
  })

  test('un inicio de impartición pasado exige confirmación explícita', () => {
    const valores = basicosCompletos()
    valores.datosBasicos.fechaInicioImparticion = '2000-01-01'

    expect(errorPasoActual('basicos', valores, true)).toBe(
      'El inicio seleccionado es pasado: confirma que el mes es correcto para continuar.',
    )

    valores.confirmarFechaPasada = true
    expect(errorPasoActual('basicos', valores, true)).toBeNull()
  })
})

describe('errorPasoActual — detalles', () => {
  test('la IA no avanza sin descripción del enfoque académico', () => {
    const valores = basicosCompletos()

    expect(errorPasoActual('detalles', valores, true)).toBe(
      'Describe el enfoque académico para la IA.',
    )

    valores.iaConfig.descripcionEnfoqueAcademico = 'Énfasis en inocuidad.'
    expect(errorPasoActual('detalles', valores, true)).toBeNull()
  })
})

describe('errorPasoActual — encuadre', () => {
  function conPreguntas(): NuevoPlanFormValues {
    const valores = basicosCompletos()
    valores.iaConfig.descripcionEnfoqueAcademico = 'Énfasis en inocuidad.'
    valores.iaBrief = {
      ...valores.iaBrief,
      estado: 'REQUIERE_ACLARACION',
      preguntas: [
        { id: 'q1', pregunta: '¿Línea propia?', porQue: '', opciones: [] },
        { id: 'q2', pregunta: '¿Industria?', porQue: '', opciones: [] },
      ],
    }
    return valores
  }

  test('cuenta las preguntas pendientes en plural y en singular', () => {
    const valores = conPreguntas()
    expect(errorPasoActual('aclaraciones', valores, true)).toBe(
      'Faltan 2 preguntas del encuadre por responder.',
    )

    valores.iaBrief.respuestas = { q1: 'Línea propia' }
    expect(errorPasoActual('aclaraciones', valores, true)).toBe(
      'Falta responder una pregunta del encuadre.',
    )

    valores.iaBrief.respuestas = { q1: 'Línea propia', q2: 'Industria' }
    expect(errorPasoActual('aclaraciones', valores, true)).toBeNull()
  })

  test('una respuesta en blanco no cuenta como respondida', () => {
    const valores = conPreguntas()
    valores.iaBrief.respuestas = { q1: '   ', q2: 'Industria' }

    expect(preguntasSinResponder(valores)).toEqual(['q1'])
  })

  test('sin encuadre analizado no se puede continuar', () => {
    const valores = basicosCompletos()

    expect(errorPasoActual('aclaraciones', valores, true)).toBe(
      'Todavía no se ha analizado el encuadre curricular.',
    )
  })
})

describe('errorPasoActual — resumen', () => {
  test('la creación por IA exige un encuadre en estado LISTO', () => {
    const valores = basicosCompletos()
    valores.iaConfig.descripcionEnfoqueAcademico = 'Énfasis en inocuidad.'

    expect(errorPasoActual('resumen', valores, true)).toBe(
      'Confirma el encuadre curricular y responde las aclaraciones antes de crear el plan.',
    )

    valores.iaBrief.estado = 'LISTO'
    expect(errorPasoActual('resumen', valores, true)).toBeNull()
  })

  test('un plan manual no depende del encuadre', () => {
    const valores = basicosCompletos()
    valores.tipoOrigen = 'MANUAL'

    expect(errorPasoActual('resumen', valores, true)).toBeNull()
  })
})
