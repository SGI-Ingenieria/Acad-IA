import {
  construirPromptEncuadre,
  esPreguntaRedundante,
  filtrarPreguntasRedundantes,
  lineasContextoDecidido,
  preguntasDesdeJson,
} from '../../ai-analyze-plan-brief/encuadre.ts'

import type { ContextoEncuadre } from '../../ai-analyze-plan-brief/encuadre.ts'

const CONTEXTO: ContextoEncuadre = {
  carrera: 'Química de Alimentos',
  nivel: 'Licenciatura',
  facultad: 'Facultad de Ciencias Químicas',
  tipoCiclo: 'Semestre',
  numCiclos: 9,
  semanasPorCiclo: null,
  tipoEstructura: 'CURRICULAR',
  estructura: 'Modelo educativo 2024',
  fechaInicioImparticion: '2026-08-01',
  instruccionesAdicionales: null,
}

Deno.test(
  'el contexto decidido llega al prompt como restricción explícita',
  () => {
    const lineas = lineasContextoDecidido(CONTEXTO)
    const texto = lineas.join('\n')

    if (!texto.includes('Nivel académico: Licenciatura')) {
      throw new Error('El nivel académico debe viajar en el contexto.')
    }
    if (!texto.includes('Duración del plan: 9 semestres')) {
      throw new Error('La duración debe pluralizar el tipo de ciclo.')
    }
    if (!texto.includes('Inicio de impartición: agosto de 2026')) {
      throw new Error('El inicio de impartición debe ser legible.')
    }
  },
)

Deno.test('un ciclo «Otro» declara sus semanas en lugar de su nombre', () => {
  const texto = lineasContextoDecidido({
    ...CONTEXTO,
    tipoCiclo: 'Otro',
    numCiclos: 5,
    semanasPorCiclo: 12,
  }).join('\n')

  if (!texto.includes('Duración del plan: 5 ciclos de 12 semanas cada uno')) {
    throw new Error('Un ciclo «Otro» debe expresar su duración en semanas.')
  }
})

Deno.test('las preguntas que repiten datos ya capturados se descartan', () => {
  const redundantes = [
    '¿Cuál es el nivel académico del programa que desea diseñar?',
    '¿El plan será de licenciatura o de maestría?',
    '¿Cuántos semestres tendrá el plan de estudios?',
    '¿Cuántas semanas dura cada ciclo?',
    '¿En qué facultad se impartirá?',
    '¿Cuándo inicia la impartición del plan?',
    '¿Es un programa oficial con RVOE?',
    '¿Cuál es el presupuesto disponible?',
  ]

  for (const pregunta of redundantes) {
    if (!esPreguntaRedundante(pregunta)) {
      throw new Error(`Debió descartarse por redundante: ${pregunta}`)
    }
  }
})

Deno.test('las preguntas curriculares legítimas sobreviven al filtro', () => {
  const legitimas = [
    '¿La formación en inocuidad debe articularse como línea propia o distribuirse en las asignaturas de procesos?',
    '¿Cuántas semanas de estancia profesional quieres reservar en el tramo final?',
    '¿El énfasis en análisis instrumental se orienta a industria o a investigación?',
    '¿Buscas acreditación por CACEI para el programa?',
  ]

  for (const pregunta of legitimas) {
    if (esPreguntaRedundante(pregunta)) {
      throw new Error(`No debió descartarse: ${pregunta}`)
    }
  }
})

Deno.test(
  'filtrarPreguntasRedundantes separa conservadas de descartadas',
  () => {
    const { conservadas, descartadas } = filtrarPreguntasRedundantes([
      { pregunta: '¿Cuál es el nivel académico del programa?' },
      { pregunta: '¿Qué peso relativo damos a la formación en bioquímica?' },
    ])

    if (conservadas.length !== 1 || descartadas.length !== 1) {
      throw new Error('El filtro debe separar exactamente una de cada tipo.')
    }
  },
)

Deno.test('el prompt prohíbe repreguntar y respeta la búsqueda web', () => {
  const conWeb = construirPromptEncuadre({
    contexto: CONTEXTO,
    solicitud:
      'Quiero una licenciatura en Química de Alimentos con énfasis en inocuidad.',
    ronda: 0,
    respuestas: {},
    preguntasPrevias: [],
    webSearchEnabled: true,
    documentosContexto: '',
    totalDocumentos: 0,
  })

  if (!conWeb.includes('CONTEXTO YA DECIDIDO')) {
    throw new Error('El prompt debe encabezar el contexto ya decidido.')
  }
  if (!conWeb.includes('Tienes búsqueda web habilitada')) {
    throw new Error('Con búsqueda web activa el prompt debe pedirla.')
  }

  const sinWeb = construirPromptEncuadre({
    contexto: CONTEXTO,
    solicitud: 'Quiero una licenciatura en Química de Alimentos.',
    ronda: 0,
    respuestas: {},
    preguntasPrevias: [],
    webSearchEnabled: false,
    documentosContexto: '',
    totalDocumentos: 0,
  })

  if (!sinWeb.includes('No tienes búsqueda web')) {
    throw new Error(
      'Sin búsqueda web el prompt debe prohibir inventar fuentes.',
    )
  }
})

Deno.test(
  'el segundo ajuste cierra el cuestionario y cita las preguntas respondidas',
  () => {
    const prompt = construirPromptEncuadre({
      contexto: CONTEXTO,
      solicitud: 'Plan con énfasis en inocuidad alimentaria.',
      ronda: 1,
      respuestas: { q1: 'Línea curricular propia' },
      preguntasPrevias: [
        {
          id: 'q1',
          pregunta: '¿Inocuidad como línea propia o distribuida?',
          porQue: 'Las fuentes la tratan de las dos formas.',
          opciones: [],
        },
      ],
      webSearchEnabled: false,
      documentosContexto: '',
      totalDocumentos: 0,
    })

    if (!prompt.includes('¿Inocuidad como línea propia o distribuida?')) {
      throw new Error('El ajuste debe citar la pregunta textual, no su id.')
    }
    if (!prompt.includes('Es la última ronda')) {
      throw new Error('El segundo ajuste debe cerrar el cuestionario.')
    }
    if (
      !prompt.includes(
        '«oportunidades» y «referentes»: devuelve ambos arreglos vacíos',
      )
    ) {
      throw new Error('El cuestionario no debe generar secciones editoriales.')
    }
  },
)

Deno.test('preguntasDesdeJson tolera borradores con forma antigua', () => {
  const preguntas = preguntasDesdeJson([
    {
      id: 'q1',
      pregunta: '¿Enfoque industrial o de investigación?',
      opciones: ['Industrial'],
    },
    {
      id: 'q2',
      pregunta: '¿Ampliar la práctica?',
      opciones: [{ etiqueta: 'Sí', implicacion: 'Más horas' }],
    },
    { pregunta: 'sin id' },
    'basura',
  ])

  if (preguntas.length !== 2) {
    throw new Error('Sólo deben sobrevivir las preguntas con id y texto.')
  }
  if (preguntas[0].opciones.length !== 0) {
    throw new Error('Las opciones en forma de string ya no son válidas.')
  }
  if (preguntas[1].opciones[0].implicacion !== 'Más horas') {
    throw new Error('Las opciones nuevas deben conservar su implicación.')
  }
})
