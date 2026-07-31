import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

import { enforceStrictJsonSchema } from '../_shared/json-schema.ts'

import type { AgenteAccionRequest } from './contract.ts'

/**
 * Todo lo que mira al modelo: el JSON Schema de cada acción, las instrucciones
 * que la acompañan y la validación de lo que vuelve. Vive aparte de `index.ts`
 * —que sólo resuelve el sobre HTTP— porque es la parte que se puede probar sin
 * red, y la Edge Function no se puede ejercitar por HTTP en local.
 */

type Esquema = Record<string, unknown>

export type PeticionModelo = {
  nombreSchema: string
  schema: Esquema
  sistema: string
  usuario: string
}

/**
 * El rechazo razonado es una salida de primera clase, no un error: la IA puede
 * concluir legítimamente que no hay nada que mejorar. Modelarlo dentro del
 * mismo objeto —y no como un `anyOf` en la raíz— es además lo único que admite
 * el modo `strict` de structured outputs, cuya raíz debe ser un objeto.
 */
function sobreDecision(resultado: Esquema): Esquema {
  return enforceStrictJsonSchema({
    type: 'object',
    properties: {
      decision: {
        type: 'string',
        enum: ['aplicar', 'rechazar'],
        description:
          '"aplicar" para proponer el cambio; "rechazar" cuando no hay nada que cambiar.',
      },
      resultado: {
        anyOf: [resultado, { type: 'null' }],
        description:
          'El cambio propuesto. Debe ser null cuando decision es "rechazar".',
      },
      motivo: {
        type: ['string', 'null'],
        description:
          'Una sola frase breve, en español y en primera persona, que se le muestra al usuario. Debe ser null cuando decision es "aplicar".',
      },
    },
  })
}

const SISTEMA_BASE = [
  'Eres el agente curricular de Acad-IA, un sistema universitario de planeación y análisis de planes de estudio.',
  '',
  'El usuario trabaja en «modo agente»: en vez de escribir una instrucción larga, señala un elemento concreto de la pantalla y espera el cambio adecuado sobre ese elemento. Opcionalmente escribe unas pocas palabras de contexto que resumen su intención; cuando las hay, mandan sobre el criterio general, y cuando no, decides con el criterio académico habitual.',
  '',
  'Tienes exactamente dos salidas posibles:',
  '- decision "aplicar": propones el cambio en `resultado` y dejas `motivo` en null.',
  '- decision "rechazar": dejas `resultado` en null y explicas en `motivo`, en español, en primera persona y en una sola frase breve, por qué no hay nada que cambiar. Por ejemplo: «Yo considero que está en la mejor posición».',
  '',
  'Rechazar es una respuesta legítima y esperada. No fuerces un cambio cuando el elemento ya es correcto, cuando el contexto del usuario no aplica a este elemento o cuando no hay ninguna opción válida. Nunca inventes un cambio con tal de no rechazar.',
  '',
  'Escribe en español académico neutro, respeta la terminología del plan, conserva los hechos y no inventes requisitos normativos.',
].join('\n')

/**
 * La reorganización no es sólo geometría. Mover una asignatura de ciclo cambia
 * qué puede exigirse antes que ella, así que un mapa recolocado con las
 * seriaciones viejas queda coherente en apariencia y roto en el fondo. Se pide
 * explícitamente porque el modelo, sin instrucción, se limita a lo que el
 * usuario ve —las tarjetas— y no toca las relaciones.
 */
const INSTRUCCION_SERIACIONES =
  'Propón además las seriaciones que correspondan: cada asignatura puede tener un único prerrequisito, y ese prerrequisito debe quedar en un ciclo estrictamente anterior al suyo en la disposición que estás proponiendo. Encadena sólo lo que de verdad depende conceptualmente de lo anterior; no serias asignaturas por el mero hecho de estar en la misma línea, y no formes ciclos de dependencia.'

// ------------------------------------------------------------ descripciones

function describirLineas(lineas: Array<{ id: string; nombre: string }>) {
  if (!lineas.length) return '  (el plan todavía no tiene líneas curriculares)'
  return lineas.map((l) => `  ${l.id} — ${l.nombre}`).join('\n')
}

type AsignaturaMapa = {
  id: string
  nombre: string
  clave: string | null
  creditos: number
  horas_academicas: number
  horas_independientes: number
  tipo: string
  numero_ciclo: number | null
  linea_plan_id: string | null
  prerrequisito_asignatura_id: string | null
}

function describirAsignatura(a: AsignaturaMapa) {
  const partes = [
    a.id,
    a.nombre,
    a.clave ? `clave ${a.clave}` : 'sin clave',
    a.numero_ciclo === null ? 'sin ciclo' : `ciclo ${a.numero_ciclo}`,
    a.linea_plan_id ? `línea ${a.linea_plan_id}` : 'sin línea',
    `${a.creditos} créditos`,
    `${a.horas_academicas} h con docente + ${a.horas_independientes} h independientes`,
    a.tipo,
    a.prerrequisito_asignatura_id
      ? `prerrequisito ${a.prerrequisito_asignatura_id}`
      : 'sin prerrequisito',
  ]
  return `  ${partes.join(' | ')}`
}

function describirMapa(ctx: {
  lineas: Array<{ id: string; nombre: string; orden: number }>
  asignaturas: Array<AsignaturaMapa>
  numero_ciclos: number
  nombre_ciclo: string
}) {
  return [
    `El plan tiene ${ctx.numero_ciclos} ciclos, que aquí se llaman «${ctx.nombre_ciclo}» y se numeran de 1 a ${ctx.numero_ciclos}.`,
    '',
    'Líneas curriculares (en su orden actual):',
    describirLineas([...ctx.lineas].sort((a, b) => a.orden - b.orden)),
    '',
    `Asignaturas del plan (${ctx.asignaturas.length}):`,
    ctx.asignaturas.length
      ? ctx.asignaturas.map(describirAsignatura).join('\n')
      : '  (ninguna)',
  ].join('\n')
}

type UnidadContexto = {
  id: string
  numero: number
  titulo: string
  temas: Array<{ id: string; nombre: string; horas_estimadas: number }>
}

function describirTemario(unidades: Array<UnidadContexto>) {
  if (!unidades.length) return '  (el temario está vacío)'
  return unidades
    .map((u) => {
      const temas = u.temas.length
        ? u.temas
            .map((t) => `      ${t.id} — ${t.nombre} (${t.horas_estimadas} h)`)
            .join('\n')
        : '      (sin temas)'
      return `  ${u.id} — Unidad ${u.numero}: ${u.titulo}\n${temas}`
    })
    .join('\n')
}

// ------------------------------------------------------ construcción por acción

/**
 * `temario` sólo llega en las acciones que lo leen de la base (evaluación y
 * bibliografía): son las únicas donde la versión autoritativa importa más que
 * la que el cliente tenga en pantalla.
 */
export function construirPeticion(
  req: AgenteAccionRequest,
  temario: string | null,
): PeticionModelo {
  // El contexto es opcional: sin él, el modelo tiene que apoyarse en el criterio
  // académico general en vez de suponer una intención que nadie expresó.
  const contexto = req.contexto
    ? `Contexto que escribió el usuario: «${req.contexto}»`
    : 'El usuario no escribió contexto: decide con el criterio académico general y rechaza si el elemento ya está bien.'
  const armar = (instrucciones: string, datos: string): string =>
    [contexto, '', instrucciones, '', datos].join('\n')

  switch (req.accion) {
    case 'mejorar_campo': {
      const p = req.payload
      const limites = [
        p.minimo === null || p.minimo === undefined
          ? null
          : `mínimo ${p.minimo}`,
        p.maximo === null || p.maximo === undefined
          ? null
          : `máximo ${p.maximo}`,
      ].filter((v): v is string => v !== null)

      const instrucciones = p.opciones?.length
        ? `Elige para el campo «${p.label}» el valor más adecuado según el contexto del usuario. El resultado debe ser EXACTAMENTE uno de los valores admitidos, copiado tal cual.`
        : p.es_richtext
          ? `Reescribe el contenido del campo «${p.label}» según el contexto del usuario. Devuelve únicamente un fragmento HTML válido usando solo estas etiquetas: p, br, strong, b, em, i, u, s, del, code, pre, h1, h2, h3, ul, ol, li, a, blockquote. Nada de Markdown, scripts, clases ni estilos que no sean la alineación.`
          : `Reescribe el contenido del campo «${p.label}» según el contexto del usuario. Devuelve texto plano, sin HTML ni Markdown.`

      const datos = [
        `Entidad: ${p.entidad} (${p.entidad_id})`,
        `Campo: ${p.clave}`,
        p.ayuda ? `Qué representa: ${p.ayuda}` : null,
        p.opciones?.length
          ? `Valores admitidos:\n${p.opciones.map((o) => `  - ${o}`).join('\n')}`
          : null,
        limites.length ? `Límites numéricos: ${limites.join(', ')}` : null,
        p.campo_schema
          ? `Schema del campo:\n${JSON.stringify(p.campo_schema, null, 2)}`
          : null,
        '',
        `Contenido actual:\n${p.contenido_actual.trim() || '(vacío)'}`,
      ]
        .filter((v): v is string => v !== null)
        .join('\n')

      return {
        nombreSchema: 'agente_mejorar_campo',
        schema: sobreDecision({
          type: 'object',
          properties: {
            contenido: {
              type: 'string',
              description:
                'El valor final del campo, listo para escribirse tal cual.',
            },
          },
        }),
        sistema: SISTEMA_BASE,
        usuario: armar(instrucciones, datos),
      }
    }

    case 'asignar_asignatura': {
      const p = req.payload
      const objetivo = p.asignaturas.find((a) => a.id === p.asignatura_id)
      return {
        nombreSchema: 'agente_asignar_asignatura',
        schema: sobreDecision({
          type: 'object',
          properties: {
            linea_plan_id: {
              type: 'string',
              description:
                'Identificador de una de las líneas curriculares existentes.',
            },
            numero_ciclo: {
              type: 'integer',
              description: `Ciclo destino, entre 1 y ${p.numero_ciclos}.`,
            },
          },
        }),
        sistema: SISTEMA_BASE,
        usuario: armar(
          `Coloca la asignatura «${objetivo?.nombre ?? p.asignatura_id}» (${p.asignatura_id}) en la línea curricular y el ciclo donde encaja mejor. Ten en cuenta la progresión académica, la carga por ciclo, la afinidad temática con las asignaturas de cada línea y las seriaciones: una asignatura nunca puede quedar en un ciclo anterior o igual al de su prerrequisito. Rechaza si ninguna combinación es defendible.`,
          describirMapa(p),
        ),
      }
    }

    case 'ajustar_creditos_horas': {
      const p = req.payload
      return {
        nombreSchema: 'agente_ajustar_creditos_horas',
        schema: sobreDecision({
          type: 'object',
          properties: {
            horas_academicas: {
              type: 'integer',
              description: 'Horas con docente. Cero o más.',
            },
            horas_independientes: {
              type: 'integer',
              description: 'Horas de trabajo independiente. Cero o más.',
            },
          },
        }),
        sistema: SISTEMA_BASE,
        usuario: armar(
          `Ajusta las horas de la asignatura «${p.nombre}» según el contexto del usuario. Los créditos NO se proponen: se derivan de las horas dividiendo entre ${p.horas_por_credito} horas por crédito, así que elige horas que produzcan un número de créditos razonable. Rechaza si la carga actual ya es la adecuada.`,
          [
            `Horas con docente: ${p.horas_academicas}`,
            `Horas independientes: ${p.horas_independientes}`,
            `Créditos actuales: ${p.creditos}`,
            `Horas por crédito en este plan: ${p.horas_por_credito}`,
          ].join('\n'),
        ),
      }
    }

    case 'reorganizar_mapa': {
      const p = req.payload
      const acotada = p.linea_plan_id
        ? p.lineas.find((l) => l.id === p.linea_plan_id)
        : undefined

      return {
        nombreSchema: 'agente_reorganizar_mapa',
        schema: sobreDecision({
          type: 'object',
          properties: {
            lineas_nuevas: {
              type: 'array',
              description:
                'Líneas curriculares que hace falta crear. Deja el arreglo vacío si no hace falta ninguna.',
              items: {
                type: 'object',
                properties: {
                  clave_temporal: {
                    type: 'string',
                    description:
                      'Identificador provisional que inventas tú (por ejemplo "nueva-1") para referirte a esta línea en los movimientos.',
                  },
                  nombre: { type: 'string' },
                  color: {
                    type: ['string', 'null'],
                    description: 'Color en formato hexadecimal, o null.',
                  },
                },
              },
            },
            movimientos: {
              type: 'array',
              description:
                'Posición final de cada asignatura que cambia de sitio. No incluyas las que se quedan donde están.',
              items: {
                type: 'object',
                properties: {
                  asignatura_id: { type: 'string' },
                  numero_ciclo: {
                    type: 'integer',
                    description: `Entre 1 y ${p.numero_ciclos}.`,
                  },
                  linea: {
                    type: 'string',
                    description:
                      'Identificador de una línea existente, o la clave_temporal de una línea nueva.',
                  },
                },
              },
            },
            seriaciones: {
              type: 'array',
              description:
                'Seriaciones que cambian: la asignatura y el prerrequisito que le corresponde tras la reorganización. Incluye sólo las que cambian respecto a la seriación actual; usa null en prerrequisito_asignatura_id para quitar una seriación que dejó de tener sentido. Deja el arreglo vacío si ninguna cambia.',
              items: {
                type: 'object',
                properties: {
                  asignatura_id: { type: 'string' },
                  prerrequisito_asignatura_id: {
                    type: ['string', 'null'],
                    description:
                      'Asignatura que debe cursarse antes, o null para dejarla sin prerrequisito. Tiene que quedar en un ciclo estrictamente anterior.',
                  },
                },
              },
            },
          },
        }),
        sistema: SISTEMA_BASE,
        usuario: armar(
          acotada
            ? `Reorganiza únicamente la línea curricular «${acotada.nombre}» (${acotada.id}): su trazo es irregular y hay que darle una progresión limpia a lo largo de los ciclos. Puedes mover sus asignaturas de ciclo y, si de verdad hace falta, repartirlas en una línea nueva. ${INSTRUCCION_SERIACIONES} Rechaza si la línea ya está bien construida.`
            : `Reorganiza el mapa curricular completo según el contexto del usuario: reparte las asignaturas entre líneas y ciclos para que cada línea tenga una progresión continua, la carga quede equilibrada entre ciclos y ninguna asignatura preceda a su prerrequisito. Puedes crear líneas nuevas cuando un grupo de asignaturas no encaje en ninguna existente. ${INSTRUCCION_SERIACIONES} Rechaza si el mapa ya está bien organizado.`,
          describirMapa(p),
        ),
      }
    }

    case 'proponer_para_celda': {
      const p = req.payload
      return {
        nombreSchema: 'agente_proponer_para_celda',
        schema: sobreDecision({
          type: 'object',
          properties: {
            asignatura_id: {
              type: 'string',
              description:
                'Identificador de una de las asignaturas candidatas listadas.',
            },
          },
        }),
        sistema: SISTEMA_BASE,
        usuario: armar(
          `Hay un hueco en la línea curricular «${p.linea_nombre}» (${p.linea_plan_id}), en el ciclo ${p.numero_ciclo}. Elige qué asignatura de las candidatas encaja ahí por afinidad temática con la línea y por progresión con el ciclo. Rechaza —y dilo con naturalidad— si ninguna candidata pertenece de verdad a esa línea y a ese ciclo: dejar el hueco vacío es preferible a colocar una asignatura que no corresponde.`,
          [
            describirMapa(p),
            '',
            `Candidatas (${p.candidatas.length}):`,
            p.candidatas.length
              ? p.candidatas.map(describirAsignatura).join('\n')
              : '  (ninguna)',
          ].join('\n'),
        ),
      }
    }

    case 'ordenar_lineas': {
      const p = req.payload
      const ordenadas = [...p.lineas].sort((a, b) => a.orden - b.orden)
      return {
        nombreSchema: 'agente_ordenar_lineas',
        schema: sobreDecision({
          type: 'object',
          properties: {
            orden: {
              type: 'array',
              description:
                'TODAS las líneas, cada una con su nueva posición. Deben aparecer todas exactamente una vez.',
              items: {
                type: 'object',
                properties: {
                  linea_plan_id: { type: 'string' },
                  orden: {
                    type: 'integer',
                    description: `Posición final, de 1 a ${p.lineas.length}.`,
                  },
                },
              },
            },
          },
        }),
        sistema: SISTEMA_BASE,
        usuario: armar(
          `Reordena las líneas curriculares según el contexto del usuario. El orden de las líneas es el orden en que se leen en el mapa, así que suele ir de lo más básico y formativo a lo más profesionalizante. Devuelve todas las líneas, cada una con su posición final. Rechaza si el orden actual ya es el adecuado.${
            p.linea_plan_id
              ? ` El usuario disparó la acción desde la línea ${p.linea_plan_id}.`
              : ''
          }`,
          [
            'Líneas curriculares en su orden actual:',
            ordenadas
              .map((l, i) => `  ${i + 1}. ${l.id} — ${l.nombre}`)
              .join('\n'),
          ].join('\n'),
        ),
      }
    }

    case 'proponer_linea': {
      const p = req.payload
      return {
        nombreSchema: 'agente_proponer_linea',
        schema: sobreDecision({
          type: 'object',
          properties: {
            nombre: {
              type: 'string',
              description:
                'Nombre de la línea curricular, en español, sin numerarla ni prefijarla.',
            },
            color: {
              type: ['string', 'null'],
              description:
                'Color sugerido en hexadecimal (#rrggbb), o null para que lo elija el sistema.',
            },
            justificacion: {
              type: 'string',
              description:
                'Una frase breve, en español, que explique qué agrupa esa línea.',
            },
          },
        }),
        sistema: SISTEMA_BASE,
        usuario: armar(
          'Propón UNA línea curricular que le falte a este plan: la que agrupe mejor a las asignaturas que hoy no encajan en ninguna de las existentes, o la que la estructura del programa reclama y todavía no está. No repitas —ni con otro nombre— ninguna de las líneas que ya existen. Rechaza si las líneas actuales ya cubren el plan.',
          describirMapa(p),
        ),
      }
    }

    case 'reubicar_unidad': {
      const p = req.payload
      const tema = p.tema_id
        ? p.unidades.flatMap((u) => u.temas).find((t) => t.id === p.tema_id)
        : undefined
      const unidad = p.unidades.find((u) => u.id === p.unidad_id)

      return {
        nombreSchema: 'agente_reubicar_unidad',
        schema: sobreDecision({
          type: 'object',
          properties: {
            posicion: {
              type: 'integer',
              description:
                'Posición destino dentro de la lista correspondiente, empezando en 1.',
            },
            unidad_destino_id: {
              type: ['string', 'null'],
              description: p.tema_id
                ? 'Unidad a la que se mueve el tema, o null si se queda en la suya.'
                : 'Siempre null: una unidad no cambia de contenedor.',
            },
          },
        }),
        sistema: SISTEMA_BASE,
        usuario: armar(
          p.tema_id
            ? `Decide dónde debe ir el tema «${tema?.nombre ?? p.tema_id}» (${p.tema_id}), que hoy está en la unidad ${p.unidad_id}. Puedes moverlo a otra unidad o sólo cambiar su posición dentro de la suya, siguiendo la secuencia didáctica del temario. Rechaza si ya está donde debe estar.`
            : `Decide en qué posición debe quedar la unidad «${unidad?.titulo ?? p.unidad_id}» (${p.unidad_id}) dentro del temario de la asignatura, siguiendo la progresión de prerrequisitos conceptuales. Devuelve unidad_destino_id en null. Rechaza si ya está en la mejor posición.`,
          [
            `Asignatura: ${p.asignatura_nombre} (${p.asignatura_id})`,
            '',
            `Temario actual (${p.unidades.length} unidades):`,
            describirTemario(p.unidades),
          ].join('\n'),
        ),
      }
    }

    case 'nombrar_unidad': {
      const p = req.payload
      return {
        nombreSchema: 'agente_nombrar_unidad',
        schema: sobreDecision({
          type: 'object',
          properties: {
            titulo: {
              type: 'string',
              description: 'Título de la unidad, sin numerarla.',
            },
          },
        }),
        sistema: SISTEMA_BASE,
        usuario: armar(
          `Se va a insertar una unidad nueva en la posición ${p.posicion} del temario. Propón su título: debe cubrir el salto conceptual que hoy queda entre la unidad anterior y la siguiente, sin repetir lo que ya está. No incluyas el número de la unidad en el título.`,
          [
            `Asignatura: ${p.asignatura_nombre} (${p.asignatura_id})`,
            '',
            `Temario actual (${p.unidades.length} unidades):`,
            describirTemario(p.unidades),
          ].join('\n'),
        ),
      }
    }

    case 'nombrar_tema': {
      const p = req.payload
      const unidad = p.unidades.find((u) => u.id === p.unidad_id)
      return {
        nombreSchema: 'agente_nombrar_tema',
        schema: sobreDecision({
          type: 'object',
          properties: {
            nombre: { type: 'string', description: 'Nombre del tema.' },
            horas_estimadas: {
              type: 'integer',
              description:
                'Horas estimadas del tema, coherentes con las de los demás temas de la unidad.',
            },
          },
        }),
        sistema: SISTEMA_BASE,
        usuario: armar(
          `Se va a añadir un tema al final de la unidad «${unidad?.titulo ?? p.unidad_id}» (${p.unidad_id}). Propón su nombre y sus horas estimadas: debe continuar la secuencia de la unidad sin repetir ningún tema existente, y sus horas deben ser del mismo orden que las de sus hermanos.`,
          [
            `Asignatura: ${p.asignatura_nombre} (${p.asignatura_id})`,
            '',
            `Temario actual (${p.unidades.length} unidades):`,
            describirTemario(p.unidades),
          ].join('\n'),
        ),
      }
    }

    case 'proponer_contenido': {
      const p = req.payload
      return {
        nombreSchema: 'agente_proponer_contenido',
        schema: sobreDecision({
          type: 'object',
          properties: {
            unidades: {
              type: 'array',
              description:
                'Temario completo que sustituirá al actual, ordenado por progresión didáctica.',
              items: {
                type: 'object',
                properties: {
                  titulo: {
                    type: 'string',
                    description: 'Título de la unidad, sin numerarla.',
                  },
                  temas: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        nombre: { type: 'string' },
                        horas_estimadas: {
                          type: 'number',
                          description:
                            'Horas positivas, admitiendo medias horas.',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        sistema: SISTEMA_BASE,
        usuario: armar(
          'Propón una versión completa y sustitutiva del contenido temático de la asignatura. Organiza unidades y temas con una progresión didáctica clara, cobertura suficiente y títulos específicos; elimina repeticiones, evita unidades vacías y asigna horas realistas a cada tema. Devuelve todo el temario, no sólo los cambios. No incluyas números en los títulos de unidad. Rechaza únicamente si no existe una mejora académica real posible.',
          [
            `Asignatura: ${p.asignatura_nombre} (${p.asignatura_id})`,
            '',
            `Temario actual (${p.unidades.length} unidades):`,
            describirTemario(p.unidades),
          ].join('\n'),
        ),
      }
    }

    case 'proponer_evaluacion': {
      const p = req.payload
      return {
        nombreSchema: 'agente_proponer_evaluacion',
        schema: sobreDecision({
          type: 'object',
          properties: {
            criterios: {
              type: 'array',
              description:
                'El sistema de evaluación completo. Los porcentajes deben sumar exactamente 100.',
              items: {
                type: 'object',
                properties: {
                  criterio: { type: 'string' },
                  porcentaje: {
                    type: 'integer',
                    description: 'Entero mayor que 0.',
                  },
                },
              },
            },
          },
        }),
        sistema: SISTEMA_BASE,
        usuario: armar(
          `Propón el sistema de evaluación completo de la asignatura. Devuélvelo entero, no un criterio suelto: los porcentajes tienen que sumar exactamente 100, así que tocar uno obliga a repartir todos. Cubre el temario y equilibra evidencias de proceso y de producto. Rechaza si el sistema actual ya es adecuado.`,
          [
            `Asignatura: ${p.asignatura_nombre} (${p.asignatura_id})`,
            '',
            'Criterios actuales:',
            p.criterios.length
              ? p.criterios
                  .map((c) => `  ${c.criterio} — ${c.porcentaje}%`)
                  .join('\n')
              : '  (todavía no hay criterios)',
            temario ? `\nTemario de la asignatura:\n${temario}` : '',
          ].join('\n'),
        ),
      }
    }

    case 'proponer_bibliografia': {
      const p = req.payload
      return {
        nombreSchema: 'agente_proponer_bibliografia',
        schema: sobreDecision({
          type: 'object',
          properties: {
            cita: {
              type: 'string',
              description: `La referencia completa ya formateada en estilo ${p.formato}. Es el texto que se imprime literalmente en el documento oficial.`,
            },
            tipo: {
              type: 'string',
              enum: ['BASICA', 'COMPLEMENTARIA'],
            },
            formato: {
              type: 'string',
              description: `Estilo de la cita. Usa "${p.formato}".`,
            },
            titulo: { type: ['string', 'null'] },
            autores: {
              type: 'array',
              items: { type: 'string' },
              description: 'Autores, uno por elemento.',
            },
            editorial: { type: ['string', 'null'] },
            anio: { type: ['integer', 'null'] },
            isbn: { type: ['string', 'null'] },
            referencia_en_linea: {
              type: ['string', 'null'],
              description: 'URL de la fuente si la obra se localizó en línea.',
            },
          },
        }),
        sistema: SISTEMA_BASE,
        usuario: armar(
          `Propón UNA referencia bibliográfica para la asignatura, siguiendo el contexto del usuario. Debe ser una obra real y verificable: si no puedes confirmar que existe, rechaza en vez de inventarla. No repitas ninguna de las referencias ya presentes. Formatea la cita en estilo ${p.formato} y rellena además los campos sueltos para poder reformatearla después.`,
          [
            `Asignatura: ${p.asignatura_nombre} (${p.asignatura_id})`,
            `Estilo de cita de la casa: ${p.formato}`,
            '',
            `Referencias que ya están (${p.existentes.length}):`,
            p.existentes.length
              ? p.existentes.map((e) => `  - ${e.cita}`).join('\n')
              : '  (ninguna)',
            temario ? `\nTemario de la asignatura:\n${temario}` : '',
          ].join('\n'),
        ),
      }
    }

    case 'proponer_prerrequisito': {
      const p = req.payload
      return {
        nombreSchema: 'agente_proponer_prerrequisito',
        schema: sobreDecision({
          type: 'object',
          properties: {
            asignatura_id: {
              type: ['string', 'null'],
              description:
                'Identificador de la asignatura antecedente, o null para dejar la asignatura sin seriación.',
            },
          },
        }),
        sistema: SISTEMA_BASE,
        usuario: armar(
          `Decide de qué asignatura debe depender «${p.asignatura_nombre}». Todas las candidatas están en ciclos anteriores, así que lo único que queda por decidir es cuál es de verdad su antecedente: la que aporta los conocimientos sin los cuales esta asignatura no se puede cursar. Devolver null es una respuesta válida y significa quitar la seriación. Rechaza si ninguna candidata es realmente antecedente y la seriación actual ya es la correcta.`,
          [
            `Asignatura: ${p.asignatura_nombre} (${p.asignatura_id})`,
            `Ciclo (${p.nombre_ciclo}): ${p.numero_ciclo ?? 'sin asignar'}`,
            `Seriación actual: ${p.prerrequisito_actual ?? 'ninguna'}`,
            '',
            `Candidatas (${p.candidatas.length}):`,
            p.candidatas.length
              ? p.candidatas
                  .map(
                    (c) =>
                      `  ${c.id} | ${c.nombre} | ${c.clave ? `clave ${c.clave}` : 'sin clave'} | ${
                        c.numero_ciclo === null
                          ? 'sin ciclo'
                          : `${p.nombre_ciclo} ${c.numero_ciclo}`
                      } | ${c.misma_linea ? 'misma línea curricular' : 'otra línea'}`,
                  )
                  .join('\n')
              : '  (ninguna)',
          ].join('\n'),
        ),
      }
    }
  }
}

// ------------------------------------------------------- lectura del resultado

export type SalidaAgente =
  | { tipo: 'aplicar'; resultado: unknown }
  | { tipo: 'rechazar'; motivo: string }
  | { tipo: 'incoherente'; detalle: string }

const SobreSchema = z.object({
  decision: z.enum(['aplicar', 'rechazar']),
  resultado: z.unknown(),
  motivo: z.unknown(),
})

const MAX_MOTIVO = 300

/**
 * Lee lo que devolvió el modelo y decide si es aplicable. Además del esquema,
 * comprueba la coherencia con el dominio —que el identificador exista, que el
 * ciclo esté en rango, que los porcentajes sumen 100—: un JSON válido puede
 * seguir siendo inaplicable, y escribirlo dejaría el plan en un estado que el
 * usuario no pidió.
 */
export function interpretarSalida(
  req: AgenteAccionRequest,
  bruto: unknown,
): SalidaAgente {
  const sobre = SobreSchema.safeParse(bruto)
  if (!sobre.success) {
    return {
      tipo: 'incoherente',
      detalle: 'La respuesta no tiene la forma esperada.',
    }
  }

  if (sobre.data.decision === 'rechazar') {
    const motivo =
      typeof sobre.data.motivo === 'string' ? sobre.data.motivo.trim() : ''
    if (!motivo) {
      return {
        tipo: 'incoherente',
        detalle: 'El rechazo llegó sin motivo que mostrar.',
      }
    }
    return { tipo: 'rechazar', motivo: motivo.slice(0, MAX_MOTIVO) }
  }

  return validarResultado(req, sobre.data.resultado)
}

function incoherente(detalle: string): SalidaAgente {
  return { tipo: 'incoherente', detalle }
}

function textoNoVacio(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpio = valor.trim()
  return limpio.length ? limpio : null
}

function plano(valor: string): string {
  return valor.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
}

function validarResultado(
  req: AgenteAccionRequest,
  bruto: unknown,
): SalidaAgente {
  switch (req.accion) {
    case 'mejorar_campo': {
      const parsed = z.object({ contenido: z.string() }).safeParse(bruto)
      if (!parsed.success) return incoherente('Falta el contenido del campo.')
      const contenido = parsed.data.contenido.trim()
      if (!contenido) return incoherente('El contenido propuesto está vacío.')

      const opciones = req.payload.opciones
      if (opciones?.length && !opciones.includes(contenido)) {
        return incoherente('El valor propuesto no es uno de los admitidos.')
      }
      return { tipo: 'aplicar', resultado: { contenido } }
    }

    case 'asignar_asignatura': {
      const parsed = z
        .object({ linea_plan_id: z.string(), numero_ciclo: z.number().int() })
        .safeParse(bruto)
      if (!parsed.success) return incoherente('Falta la línea o el ciclo.')

      const { linea_plan_id, numero_ciclo } = parsed.data
      if (!req.payload.lineas.some((l) => l.id === linea_plan_id)) {
        return incoherente('La línea curricular propuesta no existe.')
      }
      if (numero_ciclo < 1 || numero_ciclo > req.payload.numero_ciclos) {
        return incoherente('El ciclo propuesto está fuera del plan.')
      }
      return { tipo: 'aplicar', resultado: { linea_plan_id, numero_ciclo } }
    }

    case 'ajustar_creditos_horas': {
      const parsed = z
        .object({
          horas_academicas: z.number(),
          horas_independientes: z.number(),
        })
        .safeParse(bruto)
      if (!parsed.success) return incoherente('Faltan las horas propuestas.')

      const { horas_academicas, horas_independientes } = parsed.data
      if (horas_academicas < 0 || horas_independientes < 0) {
        return incoherente('Las horas propuestas son negativas.')
      }
      if (horas_academicas + horas_independientes <= 0) {
        return incoherente('La asignatura se quedaría sin horas.')
      }
      return {
        tipo: 'aplicar',
        resultado: { horas_academicas, horas_independientes },
      }
    }

    case 'reorganizar_mapa': {
      const parsed = z
        .object({
          lineas_nuevas: z.array(
            z.object({
              clave_temporal: z.string(),
              nombre: z.string(),
              color: z.string().nullable().optional(),
            }),
          ),
          movimientos: z.array(
            z.object({
              asignatura_id: z.string(),
              numero_ciclo: z.number().int(),
              linea: z.string(),
            }),
          ),
          seriaciones: z
            .array(
              z.object({
                asignatura_id: z.string(),
                prerrequisito_asignatura_id: z.string().nullable(),
              }),
            )
            .nullish(),
        })
        .safeParse(bruto)
      if (!parsed.success)
        return incoherente('La reorganización llegó incompleta.')

      const { lineas_nuevas, movimientos } = parsed.data
      const seriaciones = parsed.data.seriaciones ?? []
      if (!movimientos.length && !seriaciones.length) {
        return incoherente('La reorganización no cambia nada del mapa.')
      }

      const claves = new Set<string>()
      for (const nueva of lineas_nuevas) {
        const clave = textoNoVacio(nueva.clave_temporal)
        const nombre = textoNoVacio(nueva.nombre)
        if (!clave || !nombre) {
          return incoherente('Una línea nueva llegó sin clave o sin nombre.')
        }
        if (claves.has(clave)) {
          return incoherente('Dos líneas nuevas comparten la misma clave.')
        }
        claves.add(clave)
      }

      const lineasValidas = new Set<string>([
        ...req.payload.lineas.map((l) => l.id),
        ...claves,
      ])
      const asignaturasValidas = new Set(
        req.payload.asignaturas.map((a) => a.id),
      )
      const vistas = new Set<string>()

      for (const mov of movimientos) {
        if (!asignaturasValidas.has(mov.asignatura_id)) {
          return incoherente(
            'La reorganización mueve una asignatura que no está en el plan.',
          )
        }
        if (vistas.has(mov.asignatura_id)) {
          return incoherente(
            'Una asignatura aparece dos veces en la reorganización.',
          )
        }
        vistas.add(mov.asignatura_id)

        if (!lineasValidas.has(mov.linea)) {
          return incoherente('La reorganización usa una línea que no existe.')
        }
        if (
          mov.numero_ciclo < 1 ||
          mov.numero_ciclo > req.payload.numero_ciclos
        ) {
          return incoherente(
            'La reorganización propone un ciclo fuera del plan.',
          )
        }
      }

      const usadas = new Set(movimientos.map((m) => m.linea))
      const huerfanas = [...claves].filter((clave) => !usadas.has(clave))
      if (huerfanas.length) {
        return incoherente('Se propuso una línea nueva que se quedaría vacía.')
      }

      // Las seriaciones se validan contra el mapa *resultante*, no contra el
      // actual: el modelo puede subir una asignatura de ciclo y seriarla en el
      // mismo movimiento, y juzgar esa pareja con las posiciones viejas
      // rechazaría propuestas correctas.
      const cicloFinal = new Map<string, number | null>(
        req.payload.asignaturas.map((a) => [a.id, a.numero_ciclo ?? null]),
      )
      for (const mov of movimientos) {
        cicloFinal.set(mov.asignatura_id, mov.numero_ciclo)
      }

      const prerrequisitoFinal = new Map<string, string | null>(
        req.payload.asignaturas.map((a) => [
          a.id,
          a.prerrequisito_asignatura_id,
        ]),
      )
      const seriadas = new Set<string>()
      for (const ser of seriaciones) {
        if (!asignaturasValidas.has(ser.asignatura_id)) {
          return incoherente(
            'Se propuso una seriación sobre una asignatura que no está en el plan.',
          )
        }
        if (seriadas.has(ser.asignatura_id)) {
          return incoherente(
            'Una asignatura recibe dos seriaciones distintas en la misma propuesta.',
          )
        }
        seriadas.add(ser.asignatura_id)

        const previa = ser.prerrequisito_asignatura_id
        if (previa !== null) {
          if (previa === ser.asignatura_id) {
            return incoherente(
              'Se propuso una asignatura como su propio prerrequisito.',
            )
          }
          if (!asignaturasValidas.has(previa)) {
            return incoherente(
              'Se propuso como prerrequisito una asignatura que no está en el plan.',
            )
          }
          const cicloHija = cicloFinal.get(ser.asignatura_id) ?? null
          const cicloPadre = cicloFinal.get(previa) ?? null
          // Con alguno de los dos sin ubicar no hay nada que comparar: la
          // asignatura sigue en el banco y el orden lo decidirá su colocación.
          if (
            cicloHija !== null &&
            cicloPadre !== null &&
            cicloPadre >= cicloHija
          ) {
            return incoherente(
              'Una seriación propuesta deja el prerrequisito en el mismo ciclo o después.',
            )
          }
        }
        prerrequisitoFinal.set(ser.asignatura_id, previa)
      }

      // Un ciclo de dependencias es irrecuperable desde la interfaz: la
      // asignatura deja de poder cursarse nunca y el árbol de seriación se
      // vuelve infinito. Se comprueba sobre el grafo completo resultante, no
      // sólo sobre lo propuesto, porque una sola arista nueva puede cerrar un
      // ciclo con aristas que ya existían.
      for (const inicio of prerrequisitoFinal.keys()) {
        const recorridas = new Set<string>([inicio])
        let actual: string | null = prerrequisitoFinal.get(inicio) ?? null
        while (actual) {
          if (recorridas.has(actual)) {
            return incoherente(
              'Las seriaciones propuestas forman un ciclo de dependencias.',
            )
          }
          recorridas.add(actual)
          actual = prerrequisitoFinal.get(actual) ?? null
        }
      }

      return {
        tipo: 'aplicar',
        resultado: {
          lineas_nuevas: lineas_nuevas.map((l) => ({
            clave_temporal: l.clave_temporal.trim(),
            nombre: l.nombre.trim(),
            color: l.color ?? null,
          })),
          movimientos,
          seriaciones,
        },
      }
    }

    case 'proponer_para_celda': {
      const parsed = z.object({ asignatura_id: z.string() }).safeParse(bruto)
      if (!parsed.success) return incoherente('No llegó ninguna asignatura.')
      if (
        !req.payload.candidatas.some((c) => c.id === parsed.data.asignatura_id)
      ) {
        return incoherente(
          'La asignatura propuesta no estaba entre las candidatas.',
        )
      }
      return { tipo: 'aplicar', resultado: parsed.data }
    }

    case 'ordenar_lineas': {
      const parsed = z
        .object({
          orden: z.array(
            z.object({ linea_plan_id: z.string(), orden: z.number().int() }),
          ),
        })
        .safeParse(bruto)
      if (!parsed.success)
        return incoherente('El nuevo orden llegó incompleto.')

      const esperadas = new Set(req.payload.lineas.map((l) => l.id))
      const vistas = new Set<string>()
      const posiciones = new Set<number>()

      for (const item of parsed.data.orden) {
        if (!esperadas.has(item.linea_plan_id)) {
          return incoherente(
            'El orden propuesto incluye una línea que no existe.',
          )
        }
        if (vistas.has(item.linea_plan_id)) {
          return incoherente(
            'Una línea aparece dos veces en el orden propuesto.',
          )
        }
        if (posiciones.has(item.orden)) {
          return incoherente('Dos líneas comparten la misma posición.')
        }
        vistas.add(item.linea_plan_id)
        posiciones.add(item.orden)
      }

      if (vistas.size !== esperadas.size) {
        return incoherente('El orden propuesto deja líneas fuera.')
      }
      return { tipo: 'aplicar', resultado: parsed.data }
    }

    case 'proponer_linea': {
      const parsed = z
        .object({
          nombre: z.string(),
          color: z.string().nullable().optional(),
          justificacion: z.string().nullable().optional(),
        })
        .safeParse(bruto)
      if (!parsed.success) return incoherente('No llegó ningún nombre.')

      const nombre = parsed.data.nombre.trim()
      if (!nombre) return incoherente('La línea propuesta no tiene nombre.')

      // Se compara sin acentos ni mayúsculas porque el duplicado que molesta al
      // usuario es «Ciencias básicas» junto a «ciencias basicas», no el literal.
      if (req.payload.lineas.some((l) => plano(l.nombre) === plano(nombre))) {
        return incoherente('La línea propuesta ya existe en el plan.')
      }

      const color = parsed.data.color?.trim()
      return {
        tipo: 'aplicar',
        resultado: {
          nombre,
          color: color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : null,
          justificacion: parsed.data.justificacion?.trim() || null,
        },
      }
    }

    case 'reubicar_unidad': {
      const parsed = z
        .object({
          posicion: z.number().int(),
          unidad_destino_id: z.string().nullable().optional(),
        })
        .safeParse(bruto)
      if (!parsed.success) return incoherente('No llegó la posición destino.')

      const destinoBruto = parsed.data.unidad_destino_id ?? null

      if (!req.payload.tema_id) {
        if (
          parsed.data.posicion < 1 ||
          parsed.data.posicion > req.payload.unidades.length
        ) {
          return incoherente('La posición propuesta está fuera del temario.')
        }
        return {
          tipo: 'aplicar',
          resultado: {
            posicion: parsed.data.posicion,
            unidad_destino_id: null,
          },
        }
      }

      const destino = destinoBruto
        ? req.payload.unidades.find((u) => u.id === destinoBruto)
        : req.payload.unidades.find((u) => u.id === req.payload.unidad_id)

      if (!destino) {
        return incoherente('La unidad de destino no existe.')
      }

      // El tema puede insertarse al final, de ahí el `+ 1`; si no cambia de
      // unidad, ocupa un hueco que ya existe y el tope es el número de temas.
      const cambiaDeUnidad = destino.id !== req.payload.unidad_id
      const tope = cambiaDeUnidad
        ? destino.temas.length + 1
        : destino.temas.length
      if (
        parsed.data.posicion < 1 ||
        parsed.data.posicion > Math.max(tope, 1)
      ) {
        return incoherente('La posición propuesta está fuera de la unidad.')
      }

      return {
        tipo: 'aplicar',
        resultado: {
          posicion: parsed.data.posicion,
          unidad_destino_id: cambiaDeUnidad ? destino.id : null,
        },
      }
    }

    case 'nombrar_unidad': {
      const parsed = z.object({ titulo: z.string() }).safeParse(bruto)
      const titulo = parsed.success ? textoNoVacio(parsed.data.titulo) : null
      if (!titulo) return incoherente('El título propuesto está vacío.')
      return { tipo: 'aplicar', resultado: { titulo } }
    }

    case 'nombrar_tema': {
      const parsed = z
        .object({ nombre: z.string(), horas_estimadas: z.number() })
        .safeParse(bruto)
      if (!parsed.success)
        return incoherente('El tema propuesto llegó incompleto.')

      const nombre = textoNoVacio(parsed.data.nombre)
      if (!nombre) return incoherente('El nombre propuesto está vacío.')
      if (parsed.data.horas_estimadas < 0) {
        return incoherente('Las horas propuestas son negativas.')
      }
      return {
        tipo: 'aplicar',
        resultado: { nombre, horas_estimadas: parsed.data.horas_estimadas },
      }
    }

    case 'proponer_contenido': {
      const parsed = z
        .object({
          unidades: z
            .array(
              z.object({
                titulo: z.string(),
                temas: z.array(
                  z.object({
                    nombre: z.string(),
                    horas_estimadas: z.number(),
                  }),
                ),
              }),
            )
            .min(1)
            .max(60),
        })
        .safeParse(bruto)
      if (!parsed.success)
        return incoherente('El contenido propuesto llegó incompleto.')

      const titulos = new Set<string>()
      const unidades: Array<{
        titulo: string
        temas: Array<{ nombre: string; horas_estimadas: number }>
      }> = []

      for (const unidad of parsed.data.unidades) {
        const titulo = textoNoVacio(unidad.titulo)
        if (!titulo) return incoherente('Una unidad llegó sin título.')
        const tituloPlano = plano(titulo)
        if (titulos.has(tituloPlano)) {
          return incoherente('La propuesta repite una unidad.')
        }
        titulos.add(tituloPlano)
        if (!unidad.temas.length) {
          return incoherente('Una unidad propuesta se quedaría sin temas.')
        }

        const nombresTemas = new Set<string>()
        const temas: Array<{ nombre: string; horas_estimadas: number }> = []
        for (const tema of unidad.temas) {
          const nombre = textoNoVacio(tema.nombre)
          if (!nombre) return incoherente('Un tema llegó sin nombre.')
          const nombrePlano = plano(nombre)
          if (nombresTemas.has(nombrePlano)) {
            return incoherente(
              'La propuesta repite un tema dentro de su unidad.',
            )
          }
          if (tema.horas_estimadas <= 0 || tema.horas_estimadas > 200) {
            return incoherente(
              'Un tema llegó con una cantidad de horas inválida.',
            )
          }
          nombresTemas.add(nombrePlano)
          temas.push({ nombre, horas_estimadas: tema.horas_estimadas })
        }
        unidades.push({ titulo, temas })
      }

      return { tipo: 'aplicar', resultado: { unidades } }
    }

    case 'proponer_evaluacion': {
      const parsed = z
        .object({
          criterios: z.array(
            z.object({ criterio: z.string(), porcentaje: z.number() }),
          ),
        })
        .safeParse(bruto)
      if (!parsed.success)
        return incoherente('Los criterios llegaron incompletos.')
      if (!parsed.data.criterios.length) {
        return incoherente('La propuesta se quedaría sin criterios.')
      }

      const criterios: Array<{ criterio: string; porcentaje: number }> = []
      for (const c of parsed.data.criterios) {
        const nombre = textoNoVacio(c.criterio)
        if (!nombre) return incoherente('Un criterio llegó sin nombre.')
        if (c.porcentaje <= 0) {
          return incoherente(
            'Un criterio llegó con un porcentaje que no es positivo.',
          )
        }
        criterios.push({ criterio: nombre, porcentaje: c.porcentaje })
      }

      const suma = criterios.reduce((total, c) => total + c.porcentaje, 0)
      if (suma !== 100) {
        return incoherente(`Los porcentajes suman ${suma} y deben sumar 100.`)
      }
      return { tipo: 'aplicar', resultado: { criterios } }
    }

    case 'proponer_bibliografia': {
      const parsed = z
        .object({
          cita: z.string(),
          tipo: z.enum(['BASICA', 'COMPLEMENTARIA']),
          formato: z.string(),
          titulo: z.string().nullable().optional(),
          autores: z.array(z.string()),
          editorial: z.string().nullable().optional(),
          anio: z.number().int().nullable().optional(),
          isbn: z.string().nullable().optional(),
          referencia_en_linea: z.string().nullable().optional(),
        })
        .safeParse(bruto)
      if (!parsed.success) return incoherente('La referencia llegó incompleta.')

      const cita = textoNoVacio(parsed.data.cita)
      if (!cita) return incoherente('La referencia llegó sin cita.')

      const normalizar = (valor: string) =>
        valor.toLowerCase().replace(/\s+/g, ' ').trim()
      if (
        req.payload.existentes.some(
          (e) => normalizar(e.cita) === normalizar(cita),
        )
      ) {
        return incoherente(
          'La referencia propuesta ya estaba en la asignatura.',
        )
      }

      return {
        tipo: 'aplicar',
        resultado: {
          cita,
          tipo: parsed.data.tipo,
          formato: textoNoVacio(parsed.data.formato) ?? req.payload.formato,
          titulo: textoNoVacio(parsed.data.titulo ?? null),
          autores: parsed.data.autores
            .map((a) => a.trim())
            .filter((a) => a.length > 0),
          editorial: textoNoVacio(parsed.data.editorial ?? null),
          anio: parsed.data.anio ?? null,
          isbn: textoNoVacio(parsed.data.isbn ?? null),
          referencia_en_linea: textoNoVacio(
            parsed.data.referencia_en_linea ?? null,
          ),
        },
      }
    }

    case 'proponer_prerrequisito': {
      const parsed = z
        .object({ asignatura_id: z.string().nullable() })
        .safeParse(bruto)
      if (!parsed.success)
        return incoherente('La seriación propuesta llegó incompleta.')

      const elegida = parsed.data.asignatura_id
      if (
        elegida !== null &&
        !req.payload.candidatas.some((c) => c.id === elegida)
      ) {
        return incoherente(
          'La asignatura propuesta no estaba entre las candidatas.',
        )
      }
      if (elegida === (req.payload.prerrequisito_actual ?? null)) {
        return incoherente('La seriación propuesta es la que ya estaba.')
      }
      return { tipo: 'aplicar', resultado: { asignatura_id: elegida } }
    }
  }
}
