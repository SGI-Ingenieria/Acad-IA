/**
 * Lógica pura del encuadre curricular: qué sabe ya el wizard, cómo se le
 * presenta al modelo y qué preguntas se descartan por redundantes.
 *
 * Vive fuera de `index.ts` para poder probarse sin red ni credenciales (ver
 * `supabase/functions/tests/unit/encuadre-plan.test.ts`).
 */

export type ContextoEncuadre = {
  carrera: string
  nivel?: string | null
  facultad?: string | null
  tipoCiclo?: string | null
  numCiclos?: number | null
  semanasPorCiclo?: number | null
  tipoEstructura?: 'CURRICULAR' | 'NO_CURRICULAR' | null
  estructura?: string | null
  fechaInicioImparticion?: string | null
  instruccionesAdicionales?: string | null
}

export type OpcionEncuadre = {
  etiqueta: string
  implicacion: string
}

export type PreguntaEncuadre = {
  id: string
  pregunta: string
  porQue: string
  opciones: Array<OpcionEncuadre>
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function pluralizarCiclo(
  tipoCiclo: string | null | undefined,
  cantidad: number,
) {
  const singular = (tipoCiclo ?? '').trim().toLowerCase()
  if (!singular || singular === 'otro') {
    return cantidad === 1 ? 'ciclo' : 'ciclos'
  }
  return cantidad === 1 ? singular : `${singular}s`
}

function mesLegible(fecha: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(fecha.trim())
  if (!match) return fecha
  const mes = MESES[Number(match[2]) - 1]
  return mes ? `${mes} de ${match[1]}` : fecha
}

/**
 * Datos que el usuario ya decidió en el formulario. El modelo los recibe como
 * restricciones duras: volver a preguntarlos fue el defecto original del
 * encuadre.
 */
export function lineasContextoDecidido(
  contexto: ContextoEncuadre,
): Array<string> {
  const lineas = [`Carrera o programa: ${contexto.carrera}`]

  if (contexto.nivel) lineas.push(`Nivel académico: ${contexto.nivel}`)
  if (contexto.facultad) {
    lineas.push(`Entidad académica responsable: ${contexto.facultad}`)
  }

  if (contexto.numCiclos) {
    const tipo = pluralizarCiclo(contexto.tipoCiclo, contexto.numCiclos)
    const semanas = contexto.semanasPorCiclo
      ? ` de ${contexto.semanasPorCiclo} semanas cada uno`
      : ''
    lineas.push(`Duración del plan: ${contexto.numCiclos} ${tipo}${semanas}`)
  } else if (contexto.tipoCiclo) {
    lineas.push(`Tipo de ciclo: ${contexto.tipoCiclo}`)
  }

  if (contexto.tipoEstructura) {
    lineas.push(
      `Naturaleza del plan: ${
        contexto.tipoEstructura === 'CURRICULAR'
          ? 'curricular'
          : 'no curricular'
      }`,
    )
  }
  if (contexto.estructura) {
    lineas.push(`Estructura normativa aplicada: ${contexto.estructura}`)
  }
  if (contexto.fechaInicioImparticion) {
    lineas.push(
      `Inicio de impartición: ${mesLegible(contexto.fechaInicioImparticion)}`,
    )
  }

  return lineas
}

export const INSTRUCCIONES_SISTEMA = [
  'Eres un diseñador curricular universitario senior. En esta etapa no recolectas datos administrativos:',
  'lees la intención del usuario y detectas únicamente las decisiones que faltan para generar un buen plan.',
  '',
  'Reglas innegociables:',
  '1. El bloque «CONTEXTO YA DECIDIDO» son restricciones duras. Nunca preguntes esos datos, no pidas',
  '   confirmarlos y no ofrezcas alternativas sobre ellos: úsalos para razonar.',
  '2. Prohibido preguntar sobre nivel académico, carrera, facultad, nombre del plan, número o tipo de ciclos,',
  '   semanas por ciclo, fecha de inicio, oficialidad o RVOE, presupuesto, matrícula, cupo o cualquier trámite',
  '   administrativo. Nada de eso cambia el diseño curricular y el usuario ya lo resolvió.',
  '3. Cada pregunta nace de una tensión o un vacío concreto. «porQue» debe ser una sola frase breve.',
  '4. Preguntar es caro: máximo dos preguntas cortas y sólo las que cambiarían el plan resultante. Lo demás lo',
  '   decides con criterio profesional y lo declaras en «supuestos».',
  '5. Las opciones son rutas de diseño reales. «etiqueta» contiene sólo el nombre corto, sin paréntesis; mueve',
  '   cualquier precisión a «implicacion» y limítala a una frase breve.',
  '6. Distingue hecho, inferencia y supuesto. No inventes evidencia, cifras, instituciones ni programas.',
  '',
  'Entrega únicamente la salida estructurada solicitada, en español.',
].join('\n')

export function instruccionBusquedaWeb(webSearchEnabled: boolean): string {
  if (webSearchEnabled) {
    return [
      'Tienes búsqueda web habilitada: úsala. Contrasta esta propuesta con programas equivalentes reales y con',
      'tendencias vigentes de la disciplina antes de responder. Úsalas para decidir qué preguntar, pero no',
      'devuelvas una bibliografía ni una lista de referentes en esta etapa.',
    ].join('\n')
  }
  return [
    'No tienes búsqueda web: no inventes programas, instituciones ni cifras. Usa las fuentes adjuntas',
    'y tu conocimiento general, y declara como supuesto todo lo',
    'que no puedas sostener con evidencia.',
  ].join('\n')
}

export function construirPromptEncuadre(args: {
  contexto: ContextoEncuadre
  solicitud: string
  ronda: number
  respuestas: Record<string, string>
  preguntasPrevias: Array<PreguntaEncuadre>
  webSearchEnabled: boolean
  documentosContexto: string
  totalDocumentos: number
}): string {
  const {
    contexto,
    solicitud,
    ronda,
    respuestas,
    preguntasPrevias,
    webSearchEnabled,
    documentosContexto,
    totalDocumentos,
  } = args

  const preguntasPorId = new Map(
    preguntasPrevias.map((pregunta) => [pregunta.id, pregunta.pregunta]),
  )
  const respondidas = Object.entries(respuestas)
    .map(([id, valor]) => `- ${preguntasPorId.get(id) ?? id}\n  → ${valor}`)
    .join('\n')

  const bloques: Array<string> = [
    'CONTEXTO YA DECIDIDO (restricciones duras; no lo preguntes ni pidas confirmarlo):',
    lineasContextoDecidido(contexto)
      .map((linea) => `- ${linea}`)
      .join('\n'),
    '',
    'LO QUE EL USUARIO PIDE, EN SUS PALABRAS:',
    solicitud,
  ]

  if (contexto.instruccionesAdicionales) {
    bloques.push(
      '',
      'INSTRUCCIONES ADICIONALES DEL USUARIO:',
      contexto.instruccionesAdicionales,
    )
  }

  bloques.push(
    '',
    totalDocumentos > 0
      ? `FUENTES ADJUNTAS: ${totalDocumentos} documento(s) del usuario. Léelos antes de preguntar y señala sólo contradicciones que cambien una decisión.`
      : 'FUENTES ADJUNTAS: ninguna. El usuario no subió documentos de referencia.',
  )

  if (documentosContexto) {
    bloques.push('', documentosContexto)
  }

  bloques.push('', instruccionBusquedaWeb(webSearchEnabled))

  bloques.push('', `AJUSTE: ${ronda + 1} de 2.`)
  if (respondidas) {
    bloques.push('', 'RESPUESTAS QUE YA DIO EL USUARIO:', respondidas)
    bloques.push(
      'Incorpóralas al encuadre. No repitas una pregunta ya respondida ni la reformules.',
    )
  }

  bloques.push(
    '',
    'TAREA:',
    '1. «fundamentos»: perfil de ingreso, perfil de egreso y fines de aprendizaje concretos para ESTA carrera,',
    '   dimensionados a la duración ya fijada. Nada de redacción genérica intercambiable entre programas.',
    '2. «contradicciones»: incongruencias reales entre lo que pide el usuario, lo que dicen sus fuentes y lo que',
    '   la duración o el nivel ya fijados permiten. Si no hay ninguna, devuelve el arreglo vacío.',
    '3. «oportunidades» y «referentes»: devuelve ambos arreglos vacíos; esta etapa es sólo un cuestionario.',
    '4. «preguntas»: hasta dos decisiones curriculares que sólo el usuario puede tomar y que cambian el plan.',
    '   Redáctalas en lenguaje llano. Cada «porQue» y cada «implicacion» debe ocupar una sola frase breve.',
    '   Las etiquetas no llevan paréntesis ni explicaciones. La interfaz además admite respuesta libre.',
    '6. «supuestos»: lo que decidiste tú por criterio profesional y el usuario debe poder objetar.',
    '6. «explicacion»: una sola frase breve que presente el ajuste.',
    '',
    'Estados: REQUIERE_ACLARACION si quedan preguntas; LISTO si el encuadre se sostiene sin preguntar más;',
    'INCOMPATIBLE si una fuente o la solicitud son ajenas a lo que se está diseñando (explícalo y pregunta).',
    ronda >= 1
      ? 'Es la última ronda: no devuelvas preguntas, explicita los supuestos necesarios y marca LISTO.'
      : 'Cuando el estado sea LISTO, «preguntas» debe ser un arreglo vacío.',
  )

  return bloques.join('\n')
}

/**
 * Rehidrata las preguntas de una ronda anterior guardadas como `jsonb`. El
 * borrador es la fuente autoritativa del hilo, así que el segundo ajuste cita
 * la pregunta textual en lugar de su id opaco.
 */
export function preguntasDesdeJson(valor: unknown): Array<PreguntaEncuadre> {
  if (!Array.isArray(valor)) return []
  return valor.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const registro = item as Record<string, unknown>
    const id = typeof registro.id === 'string' ? registro.id : ''
    const pregunta =
      typeof registro.pregunta === 'string' ? registro.pregunta : ''
    if (!id || !pregunta) return []
    const opciones = Array.isArray(registro.opciones)
      ? registro.opciones.flatMap((opcion) => {
          if (!opcion || typeof opcion !== 'object') return []
          const registroOpcion = opcion as Record<string, unknown>
          const etiqueta =
            typeof registroOpcion.etiqueta === 'string'
              ? registroOpcion.etiqueta
              : ''
          if (!etiqueta) return []
          return [
            {
              etiqueta,
              implicacion:
                typeof registroOpcion.implicacion === 'string'
                  ? registroOpcion.implicacion
                  : '',
            },
          ]
        })
      : []
    return [
      {
        id,
        pregunta,
        porQue: typeof registro.porQue === 'string' ? registro.porQue : '',
        opciones,
      },
    ]
  })
}

/**
 * Patrones de preguntas que el wizard ya respondió por formulario. El prompt lo
 * prohíbe, pero el filtro es la garantía: un modelo que reincide no vuelve a
 * gastarle una ronda al usuario.
 */
const PATRONES_REDUNDANTES: Array<RegExp> = [
  /nivel (academico|educativo|de estudios|del programa)/,
  /(licenciatura|pregrado|tecnico).*(posgrado|maestria|doctorado|especialidad)/,
  /(cuantos|cuantas|numero de|cantidad de|que cantidad de) (ciclos|semestres|cuatrimestres|trimestres|periodos)/,
  /(cuanto|que) (dura|duracion).*(programa|plan|carrera|ciclo)/,
  /(duracion) (del|de la) (programa|plan|carrera|ciclo)/,
  /tipo de ciclo/,
  /semanas\s*(por|de|dura|tiene)?\s*(cada\s+)?(ciclo|semestre|cuatrimestre|trimestre|periodo)/,
  /(que|cual|a que) (facultad|escuela|entidad academica|division academica)/,
  /(nombre|como se llamara|como se llama) (del|de la|el|la) (plan|programa|carrera)/,
  /(fecha|mes|ano|cuando).{0,30}(inicio|iniciar|comenzar|comienza|arranca|impartir|imparticion|primera generacion)/,
  /(es|sera|desea que sea) un programa oficial/,
  /\brvoe\b|registro oficial|validez oficial/,
  /(presupuesto|colegiatura|matricula|cuota|costo del programa)/,
  /(cuantos|numero de|cantidad de) (alumnos|estudiantes|aspirantes)/,
  /(curricular o no curricular)/,
]

const SIN_ACENTO: Record<string, string> = {
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ú: 'u',
  ü: 'u',
  ñ: 'n',
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[áéíóúüñ]/g, (letra) => SIN_ACENTO[letra] ?? letra)
}

export function esPreguntaRedundante(pregunta: string): boolean {
  const normalizada = normalizar(pregunta)
  return PATRONES_REDUNDANTES.some((patron) => patron.test(normalizada))
}

/**
 * Descarta las preguntas que reinciden sobre datos ya capturados. Devuelve
 * también las descartadas para poder observarlas en los logs de la función.
 */
export function filtrarPreguntasRedundantes<T extends { pregunta: string }>(
  preguntas: Array<T>,
): { conservadas: Array<T>; descartadas: Array<T> } {
  const conservadas: Array<T> = []
  const descartadas: Array<T> = []
  for (const pregunta of preguntas) {
    if (esPreguntaRedundante(pregunta.pregunta)) {
      descartadas.push(pregunta)
    } else {
      conservadas.push(pregunta)
    }
  }
  return { conservadas, descartadas }
}
