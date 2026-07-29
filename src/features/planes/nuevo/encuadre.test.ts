import { describe, expect, test } from 'bun:test'

import {
  contextoEncuadre,
  encuadreVigente,
  entradaEncuadre,
  firmaEncuadre,
  normalizarPreguntas,
} from './encuadre'
import { valoresInicialesNuevoPlan } from './schema'

import type { NuevoPlanFormValues } from './types'

const CATALOGOS = {
  nivelCarrera: 'Licenciatura',
  estructuraNombre: 'Modelo educativo 2024',
}

function valores(): NuevoPlanFormValues {
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
      fechaInicioImparticion: '2026-08-01',
    },
    iaConfig: {
      ...base.iaConfig,
      descripcionEnfoqueAcademico:
        'Licenciatura en Química de Alimentos con énfasis en inocuidad.',
      archivosReferencia: ['a', 'b'],
      coleccionesReferencia: ['c'],
    },
  }
}

describe('contextoEncuadre', () => {
  test('lleva el nivel y la versión normativa, que no viven en el form', () => {
    const contexto = contextoEncuadre(valores(), CATALOGOS)

    expect(contexto.nivel).toBe('Licenciatura')
    expect(contexto.estructura).toBe('Modelo educativo 2024')
    expect(contexto.carrera).toBe('Química de Alimentos')
    expect(contexto.numCiclos).toBe(9)
  })

  test('los campos sin capturar viajan como null, no como cadena vacía', () => {
    const contexto = contextoEncuadre(valoresInicialesNuevoPlan(), {})

    expect(contexto.nivel).toBeNull()
    expect(contexto.facultad).toBeNull()
    expect(contexto.tipoCiclo).toBeNull()
    expect(contexto.instruccionesAdicionales).toBeNull()
  })
})

describe('firmaEncuadre', () => {
  const firmaDe = (v: NuevoPlanFormValues) =>
    firmaEncuadre(entradaEncuadre(v, CATALOGOS, 0, {}))

  test('volver al paso sin tocar nada no invalida el encuadre', () => {
    expect(firmaDe(valores())).toBe(firmaDe(valores()))
  })

  test('el orden de las referencias no cuenta como cambio', () => {
    const otro = valores()
    otro.iaConfig.archivosReferencia = ['b', 'a']

    expect(firmaDe(otro)).toBe(firmaDe(valores()))
  })

  test('la ronda y las respuestas no forman parte de la firma', () => {
    const base = valores()
    const ronda2 = firmaEncuadre(
      entradaEncuadre(base, CATALOGOS, 2, { q1: 'Línea propia' }),
    )

    expect(ronda2).toBe(firmaDe(base))
  })

  test('cambiar la solicitud, el contexto o la búsqueda web sí invalida', () => {
    const original = firmaDe(valores())

    const otraSolicitud = valores()
    otraSolicitud.iaConfig.descripcionEnfoqueAcademico = 'Otra cosa distinta.'
    expect(firmaDe(otraSolicitud)).not.toBe(original)

    const otrosCiclos = valores()
    otrosCiclos.datosBasicos.numCiclos = 8
    expect(firmaDe(otrosCiclos)).not.toBe(original)

    const conWeb = valores()
    conWeb.iaConfig.webSearchEnabled = true
    expect(firmaDe(conWeb)).not.toBe(original)

    const otraReferencia = valores()
    otraReferencia.iaConfig.archivosReferencia = ['a']
    expect(firmaDe(otraReferencia)).not.toBe(original)
  })

  test('el alcance de generación no invalida el encuadre', () => {
    const otroAlcance = valores()
    otroAlcance.iaConfig.alcance = {
      ...otroAlcance.iaConfig.alcance,
      bibliografia: true,
    }

    expect(firmaDe(otroAlcance)).toBe(firmaDe(valores()))
  })
})

describe('encuadreVigente', () => {
  test('un encuadre sin analizar nunca es reutilizable', () => {
    const v = valores()
    const firma = firmaEncuadre(entradaEncuadre(v, CATALOGOS, 0, {}))
    v.iaBrief.firma = firma

    expect(encuadreVigente(v, firma)).toBe(false)
  })

  test('con la misma firma y un análisis hecho, se conserva', () => {
    const v = valores()
    const firma = firmaEncuadre(entradaEncuadre(v, CATALOGOS, 0, {}))
    v.iaBrief.firma = firma
    v.iaBrief.estado = 'REQUIERE_ACLARACION'

    expect(encuadreVigente(v, firma)).toBe(true)
    expect(encuadreVigente(v, 'otra-firma')).toBe(false)
  })
})

describe('normalizarPreguntas', () => {
  test('descarta las opciones en forma de cadena de borradores antiguos', () => {
    const preguntas = normalizarPreguntas([
      { id: 'q1', pregunta: '¿Industria o investigación?', opciones: ['A'] },
      {
        id: 'q2',
        pregunta: '¿Ampliar la práctica?',
        porQue: 'Cambia el tramo final.',
        opciones: [{ etiqueta: 'Sí', implicacion: 'Más horas' }],
      },
      { pregunta: 'sin id' },
      'basura',
    ])

    expect(preguntas).toHaveLength(2)
    expect(preguntas[0].opciones).toHaveLength(0)
    expect(preguntas[0].porQue).toBe('')
    expect(preguntas[1].opciones[0].implicacion).toBe('Más horas')
  })

  test('un borrador sin preguntas no rompe la restauración', () => {
    expect(normalizarPreguntas(undefined)).toEqual([])
    expect(normalizarPreguntas(null)).toEqual([])
  })
})
