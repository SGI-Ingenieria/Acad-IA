import { assert, assertEquals, assertFalse } from 'jsr:@std/assert@1'

import {
  construirPeticion,
  interpretarSalida,
} from '../../ai-agente-accion/acciones.ts'
import {
  AgenteAccionRequestSchema,
  verificarAmbito,
} from '../../ai-agente-accion/contract.ts'

const PLAN = '11111111-1111-4111-8111-111111111111'
const ASIGNATURA = '22222222-2222-4222-8222-222222222222'
const OTRA_ASIGNATURA = '33333333-3333-4333-8333-333333333333'
const LINEA_A = '44444444-4444-4444-8444-444444444444'
const LINEA_B = '55555555-5555-4555-8555-555555555555'
const SESION = '66666666-6666-4666-8666-666666666666'

function peticion(input: Record<string, unknown>) {
  return AgenteAccionRequestSchema.parse(input)
}

function asignaturaMapa(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    nombre: 'Cálculo I',
    clave: 'CAL-101',
    creditos: 8,
    horas_academicas: 64,
    horas_independientes: 32,
    tipo: 'OBLIGATORIA',
    numero_ciclo: 1,
    linea_plan_id: LINEA_A,
    prerrequisito_asignatura_id: null,
    ...extra,
  }
}

const CONTEXTO_MAPA = {
  lineas: [
    { id: LINEA_A, nombre: 'Ciencias básicas', orden: 1 },
    { id: LINEA_B, nombre: 'Formación profesional', orden: 2 },
  ],
  asignaturas: [asignaturaMapa(ASIGNATURA), asignaturaMapa(OTRA_ASIGNATURA)],
  numero_ciclos: 9,
  nombre_ciclo: 'Semestre',
}

const AMBITO_PLAN = { tipo: 'plan' as const, planId: PLAN }
const AMBITO_ASIGNATURA = {
  tipo: 'asignatura' as const,
  asignaturaId: ASIGNATURA,
  planId: PLAN,
}

// ------------------------------------------------------------------ contrato

Deno.test(
  'el contexto es opcional y las llaves desconocidas se rechazan',
  () => {
    // Señalar un elemento ya es una intención completa: el modo agente debe poder
    // usarse sin escribir nada en el dock.
    const sinContexto = AgenteAccionRequestSchema.safeParse({
      accion: 'nombrar_unidad',
      ambito: AMBITO_ASIGNATURA,
      sesion_id: SESION,
      payload: {
        asignatura_id: ASIGNATURA,
        asignatura_nombre: 'Cálculo I',
        unidades: [],
        posicion: 1,
      },
    })
    assert(sinContexto.success, 'una petición sin contexto debe aceptarse')
    assertEquals(sinContexto.data.contexto, '')

    const contextoEnBlanco = AgenteAccionRequestSchema.safeParse({
      accion: 'nombrar_unidad',
      ambito: AMBITO_ASIGNATURA,
      contexto: '   ',
      sesion_id: SESION,
      payload: {
        asignatura_id: ASIGNATURA,
        asignatura_nombre: 'Cálculo I',
        unidades: [],
        posicion: 1,
      },
    })
    assert(contextoEnBlanco.success)
    assertEquals(
      contextoEnBlanco.data.contexto,
      '',
      'un contexto en blanco se normaliza a vacío, no es un error',
    )

    assertFalse(
      AgenteAccionRequestSchema.safeParse({
        accion: 'nombrar_unidad',
        ambito: AMBITO_ASIGNATURA,
        contexto: 'más práctica',
        sesion_id: SESION,
        payload: {
          asignatura_id: ASIGNATURA,
          asignatura_nombre: 'Cálculo I',
          unidades: [],
          posicion: 1,
          sobra: true,
        },
      }).success,
    )
  },
)

Deno.test(
  'sin contexto el prompt lo dice en vez de fingir una intención',
  () => {
    const { usuario } = construirPeticion(
      peticion({
        accion: 'nombrar_tema',
        ambito: AMBITO_ASIGNATURA,
        sesion_id: SESION,
        payload: {
          asignatura_id: ASIGNATURA,
          asignatura_nombre: 'Cálculo I',
          unidades: [],
          unidad_id: 'u-1',
        },
      }),
      null,
    )

    assert(usuario.includes('no escribió contexto'))
    assertFalse(usuario.includes('Contexto que escribió el usuario'))
  },
)

Deno.test('el esfuerzo de razonamiento por defecto es "none"', () => {
  const parsed = peticion({
    accion: 'nombrar_tema',
    ambito: AMBITO_ASIGNATURA,
    contexto: 'más práctica',
    sesion_id: SESION,
    payload: {
      asignatura_id: ASIGNATURA,
      asignatura_nombre: 'Cálculo I',
      unidades: [{ id: 'u-1', numero: 1, titulo: 'Límites', temas: [] }],
      unidad_id: 'u-1',
    },
  })

  assertEquals(parsed.reasoning_effort, 'none')
})

// -------------------------------------------------------------------- ámbito

Deno.test(
  'verificarAmbito impide leer una asignatura ajena al ámbito autorizado',
  () => {
    const fuera = peticion({
      accion: 'proponer_evaluacion',
      ambito: AMBITO_ASIGNATURA,
      contexto: 'más equilibrado',
      sesion_id: SESION,
      payload: {
        asignatura_id: OTRA_ASIGNATURA,
        asignatura_nombre: 'Otra',
        criterios: [],
      },
    })
    assertEquals(verificarAmbito(fuera).ok, false)

    const dentro = peticion({
      accion: 'proponer_evaluacion',
      ambito: AMBITO_ASIGNATURA,
      contexto: 'más equilibrado',
      sesion_id: SESION,
      payload: {
        asignatura_id: ASIGNATURA,
        asignatura_nombre: 'Cálculo I',
        criterios: [],
      },
    })
    assertEquals(verificarAmbito(dentro), { ok: true })
  },
)

Deno.test(
  'verificarAmbito difiere a la base la seriación propuesta desde el mapa',
  () => {
    const desdeElMapa = peticion({
      accion: 'proponer_prerrequisito',
      ambito: AMBITO_PLAN,
      contexto: 'antecedente real',
      sesion_id: SESION,
      payload: {
        asignatura_id: ASIGNATURA,
        asignatura_nombre: 'Cálculo II',
        numero_ciclo: 2,
        nombre_ciclo: 'Semestre',
        prerrequisito_actual: null,
        candidatas: [],
      },
    })

    assertEquals(verificarAmbito(desdeElMapa), {
      ok: 'comprobar-asignatura-del-plan',
      asignaturaId: ASIGNATURA,
      planId: PLAN,
    })
  },
)

Deno.test('verificarAmbito ata mejorar_campo a la entidad del ámbito', () => {
  const otroPlan = peticion({
    accion: 'mejorar_campo',
    ambito: AMBITO_PLAN,
    contexto: 'mejorar gramática',
    sesion_id: SESION,
    payload: {
      entidad: 'plan',
      entidad_id: ASIGNATURA,
      clave: 'perfil_egreso',
      label: 'Perfil de egreso',
      contenido_actual: '<p>Hola</p>',
      es_richtext: true,
    },
  })
  assertEquals(verificarAmbito(otroPlan).ok, false)
})

Deno.test(
  'mejorar_campo sobre una asignatura desde el mapa queda pendiente de la base',
  () => {
    // El mapa curricular ajusta el nombre y el tipo de una asignatura sin salir
    // del plan: el ámbito es el plan y la entidad es la asignatura. No es un
    // rechazo, es una comprobación que sólo la base puede resolver.
    const desdeElMapa = peticion({
      accion: 'mejorar_campo',
      ambito: AMBITO_PLAN,
      contexto: 'más claro',
      sesion_id: SESION,
      payload: {
        entidad: 'asignatura',
        entidad_id: ASIGNATURA,
        clave: 'nombre',
        label: 'Nombre de la asignatura',
        contenido_actual: 'Calculo 1',
        es_richtext: false,
      },
    })
    assertEquals(verificarAmbito(desdeElMapa), {
      ok: 'comprobar-asignatura-del-plan',
      asignaturaId: ASIGNATURA,
      planId: AMBITO_PLAN.planId,
    })
  },
)

Deno.test(
  'verificarAmbito exige el ámbito de plan para las acciones de mapa',
  () => {
    const desdeAsignatura = peticion({
      accion: 'ordenar_lineas',
      ambito: AMBITO_ASIGNATURA,
      contexto: 'más al principio',
      sesion_id: SESION,
      payload: { lineas: CONTEXTO_MAPA.lineas },
    })
    assertEquals(verificarAmbito(desdeAsignatura).ok, false)
  },
)

// ---------------------------------------------------------------- JSON Schema

Deno.test(
  'el JSON Schema cumple el modo estricto y ofrece las dos ramas de decisión',
  () => {
    const req = peticion({
      accion: 'asignar_asignatura',
      ambito: AMBITO_PLAN,
      contexto: 'primer semestre',
      sesion_id: SESION,
      payload: { ...CONTEXTO_MAPA, asignatura_id: ASIGNATURA },
    })

    const { schema, usuario } = construirPeticion(req, null)
    const raiz = schema as Record<string, any>

    assertEquals(raiz.type, 'object')
    assertEquals(raiz.additionalProperties, false)
    assertEquals(raiz.required, ['decision', 'resultado', 'motivo'])
    assertEquals(raiz.properties.decision.enum, ['aplicar', 'rechazar'])

    // La rama de resultado también debe quedar estricta: OpenAI exige
    // additionalProperties:false y required completo en TODO nodo objeto.
    const rama = raiz.properties.resultado.anyOf[0]
    assertEquals(rama.additionalProperties, false)
    assertEquals(rama.required, ['linea_plan_id', 'numero_ciclo'])
    assertEquals(raiz.properties.resultado.anyOf[1], { type: 'null' })

    assert(usuario.includes('primer semestre'))
    assert(usuario.includes(LINEA_A))
  },
)

// -------------------------------------------------------------- interpretación

Deno.test('un rechazo con motivo se propaga; sin motivo es incoherente', () => {
  const req = peticion({
    accion: 'nombrar_unidad',
    ambito: AMBITO_ASIGNATURA,
    contexto: 'más práctica',
    sesion_id: SESION,
    payload: {
      asignatura_id: ASIGNATURA,
      asignatura_nombre: 'Cálculo I',
      unidades: [{ id: 'u-1', numero: 1, titulo: 'Límites', temas: [] }],
      posicion: 1,
    },
  })

  assertEquals(
    interpretarSalida(req, {
      decision: 'rechazar',
      resultado: null,
      motivo: '  Yo considero que está en la mejor posición.  ',
    }),
    { tipo: 'rechazar', motivo: 'Yo considero que está en la mejor posición.' },
  )

  assertEquals(
    interpretarSalida(req, {
      decision: 'rechazar',
      resultado: null,
      motivo: '',
    }).tipo,
    'incoherente',
  )
})

Deno.test('asignar_asignatura valida que la línea y el ciclo existan', () => {
  const req = peticion({
    accion: 'asignar_asignatura',
    ambito: AMBITO_PLAN,
    contexto: 'ciencias básicas',
    sesion_id: SESION,
    payload: { ...CONTEXTO_MAPA, asignatura_id: ASIGNATURA },
  })

  assertEquals(
    interpretarSalida(req, {
      decision: 'aplicar',
      resultado: { linea_plan_id: LINEA_B, numero_ciclo: 3 },
      motivo: null,
    }),
    { tipo: 'aplicar', resultado: { linea_plan_id: LINEA_B, numero_ciclo: 3 } },
  )

  assertEquals(
    interpretarSalida(req, {
      decision: 'aplicar',
      resultado: { linea_plan_id: SESION, numero_ciclo: 3 },
      motivo: null,
    }).tipo,
    'incoherente',
  )

  assertEquals(
    interpretarSalida(req, {
      decision: 'aplicar',
      resultado: { linea_plan_id: LINEA_A, numero_ciclo: 12 },
      motivo: null,
    }).tipo,
    'incoherente',
  )
})

Deno.test('proponer_para_celda sólo admite una de las candidatas', () => {
  const req = peticion({
    accion: 'proponer_para_celda',
    ambito: AMBITO_PLAN,
    contexto: 'álgebra',
    sesion_id: SESION,
    payload: {
      ...CONTEXTO_MAPA,
      linea_plan_id: LINEA_A,
      linea_nombre: 'Ciencias básicas',
      numero_ciclo: 2,
      candidatas: [asignaturaMapa(ASIGNATURA)],
    },
  })

  assertEquals(
    interpretarSalida(req, {
      decision: 'aplicar',
      resultado: { asignatura_id: OTRA_ASIGNATURA },
      motivo: null,
    }).tipo,
    'incoherente',
  )
  assertEquals(
    interpretarSalida(req, {
      decision: 'aplicar',
      resultado: { asignatura_id: ASIGNATURA },
      motivo: null,
    }).tipo,
    'aplicar',
  )
})

Deno.test('ordenar_lineas exige una permutación completa y sin empates', () => {
  const req = peticion({
    accion: 'ordenar_lineas',
    ambito: AMBITO_PLAN,
    contexto: 'más al principio',
    sesion_id: SESION,
    payload: { lineas: CONTEXTO_MAPA.lineas },
  })

  assertEquals(
    interpretarSalida(req, {
      decision: 'aplicar',
      resultado: { orden: [{ linea_plan_id: LINEA_B, orden: 1 }] },
      motivo: null,
    }).tipo,
    'incoherente',
    'dejar una línea fuera perdería su posición',
  )

  assertEquals(
    interpretarSalida(req, {
      decision: 'aplicar',
      resultado: {
        orden: [
          { linea_plan_id: LINEA_B, orden: 1 },
          { linea_plan_id: LINEA_A, orden: 1 },
        ],
      },
      motivo: null,
    }).tipo,
    'incoherente',
  )

  assertEquals(
    interpretarSalida(req, {
      decision: 'aplicar',
      resultado: {
        orden: [
          { linea_plan_id: LINEA_B, orden: 1 },
          { linea_plan_id: LINEA_A, orden: 2 },
        ],
      },
      motivo: null,
    }).tipo,
    'aplicar',
  )
})

Deno.test(
  'proponer_linea rechaza la línea que ya existe, con o sin acentos',
  () => {
    const req = peticion({
      accion: 'proponer_linea',
      ambito: AMBITO_PLAN,
      sesion_id: SESION,
      payload: CONTEXTO_MAPA,
    })

    // El duplicado que molesta al usuario es «Ciencias básicas» junto a
    // «ciencias basicas», no el literal repetido.
    assertEquals(
      interpretarSalida(req, {
        decision: 'aplicar',
        resultado: { nombre: '  ciencias basicas ', color: null },
        motivo: null,
      }).tipo,
      'incoherente',
    )

    assertEquals(
      interpretarSalida(req, {
        decision: 'aplicar',
        resultado: { nombre: '   ', color: null },
        motivo: null,
      }).tipo,
      'incoherente',
      'una línea sin nombre no se puede crear',
    )
  },
)

Deno.test(
  'proponer_linea normaliza el color y deja elegirlo al cliente',
  () => {
    const req = peticion({
      accion: 'proponer_linea',
      ambito: AMBITO_PLAN,
      sesion_id: SESION,
      payload: CONTEXTO_MAPA,
    })

    assertEquals(
      interpretarSalida(req, {
        decision: 'aplicar',
        resultado: {
          nombre: ' Ciencias sociales ',
          color: '#1A2B3C',
          justificacion: ' Agrupa la formación humanística. ',
        },
        motivo: null,
      }),
      {
        tipo: 'aplicar',
        resultado: {
          nombre: 'Ciencias sociales',
          color: '#1A2B3C',
          justificacion: 'Agrupa la formación humanística.',
        },
      },
    )

    // Un color que no es `#rrggbb` no se propaga a medias: se anula para que el
    // cliente genere uno contrastante con los que ya usa el mapa.
    const conColorMalo = interpretarSalida(req, {
      decision: 'aplicar',
      resultado: {
        nombre: 'Ciencias sociales',
        color: 'azul',
        justificacion: '',
      },
      motivo: null,
    })
    assertEquals(conColorMalo.tipo, 'aplicar')
    assertEquals((conColorMalo as any).resultado.color, null)
    assertEquals((conColorMalo as any).resultado.justificacion, null)
  },
)

Deno.test(
  'reorganizar_mapa rechaza movimientos y líneas inconsistentes',
  () => {
    const req = peticion({
      accion: 'reorganizar_mapa',
      ambito: AMBITO_PLAN,
      contexto: 'equilibrar carga',
      sesion_id: SESION,
      payload: CONTEXTO_MAPA,
    })

    assertEquals(
      interpretarSalida(req, {
        decision: 'aplicar',
        resultado: {
          lineas_nuevas: [],
          movimientos: [
            { asignatura_id: SESION, numero_ciclo: 2, linea: LINEA_A },
          ],
        },
        motivo: null,
      }).tipo,
      'incoherente',
      'la asignatura movida no está en el plan',
    )

    assertEquals(
      interpretarSalida(req, {
        decision: 'aplicar',
        resultado: {
          lineas_nuevas: [
            { clave_temporal: 'nueva-1', nombre: 'Integradora', color: null },
          ],
          movimientos: [
            { asignatura_id: ASIGNATURA, numero_ciclo: 2, linea: LINEA_A },
          ],
        },
        motivo: null,
      }).tipo,
      'incoherente',
      'una línea nueva que nadie ocupa quedaría vacía',
    )

    assertEquals(
      interpretarSalida(req, {
        decision: 'aplicar',
        resultado: {
          lineas_nuevas: [
            { clave_temporal: 'nueva-1', nombre: 'Integradora', color: null },
          ],
          movimientos: [
            { asignatura_id: ASIGNATURA, numero_ciclo: 2, linea: 'nueva-1' },
            { asignatura_id: OTRA_ASIGNATURA, numero_ciclo: 3, linea: LINEA_B },
          ],
        },
        motivo: null,
      }).tipo,
      'aplicar',
    )
  },
)

Deno.test(
  'reorganizar_mapa valida las seriaciones contra el mapa resultante',
  () => {
    const req = peticion({
      accion: 'reorganizar_mapa',
      ambito: AMBITO_PLAN,
      contexto: 'ordenar la progresión',
      sesion_id: SESION,
      payload: CONTEXTO_MAPA,
    })

    // El prerrequisito se juzga con las posiciones que propone la misma
    // respuesta, no con las actuales: ambas nacen en el ciclo 1, y sólo el
    // movimiento que las separa hace legítima la seriación.
    assertEquals(
      interpretarSalida(req, {
        decision: 'aplicar',
        resultado: {
          lineas_nuevas: [],
          movimientos: [
            { asignatura_id: OTRA_ASIGNATURA, numero_ciclo: 3, linea: LINEA_A },
          ],
          seriaciones: [
            {
              asignatura_id: OTRA_ASIGNATURA,
              prerrequisito_asignatura_id: ASIGNATURA,
            },
          ],
        },
        motivo: null,
      }).tipo,
      'aplicar',
    )

    assertEquals(
      interpretarSalida(req, {
        decision: 'aplicar',
        resultado: {
          lineas_nuevas: [],
          movimientos: [
            { asignatura_id: OTRA_ASIGNATURA, numero_ciclo: 3, linea: LINEA_A },
          ],
          seriaciones: [
            {
              asignatura_id: ASIGNATURA,
              prerrequisito_asignatura_id: OTRA_ASIGNATURA,
            },
          ],
        },
        motivo: null,
      }).tipo,
      'incoherente',
      'el prerrequisito quedaría en un ciclo posterior',
    )

    // Un ciclo de dependencias no es recuperable desde la interfaz: la
    // asignatura deja de poder cursarse nunca.
    assertEquals(
      interpretarSalida(req, {
        decision: 'aplicar',
        resultado: {
          lineas_nuevas: [],
          movimientos: [],
          seriaciones: [
            {
              asignatura_id: ASIGNATURA,
              prerrequisito_asignatura_id: OTRA_ASIGNATURA,
            },
            {
              asignatura_id: OTRA_ASIGNATURA,
              prerrequisito_asignatura_id: ASIGNATURA,
            },
          ],
        },
        motivo: null,
      }).tipo,
      'incoherente',
      'las dos seriaciones se apuntan entre sí',
    )

    // Sólo seriaciones, sin mover nada, es una propuesta completa: quitar una
    // seriación que dejó de tener sentido es un cambio en sí mismo.
    assertEquals(
      interpretarSalida(req, {
        decision: 'aplicar',
        resultado: {
          lineas_nuevas: [],
          movimientos: [],
          seriaciones: [
            {
              asignatura_id: ASIGNATURA,
              prerrequisito_asignatura_id: null,
            },
          ],
        },
        motivo: null,
      }).tipo,
      'aplicar',
    )
  },
)

Deno.test('proponer_evaluacion exige que los porcentajes sumen 100', () => {
  const req = peticion({
    accion: 'proponer_evaluacion',
    ambito: AMBITO_ASIGNATURA,
    contexto: 'más práctica',
    sesion_id: SESION,
    payload: {
      asignatura_id: ASIGNATURA,
      asignatura_nombre: 'Cálculo I',
      criterios: [{ criterio: 'Examen', porcentaje: 100 }],
    },
  })

  assertEquals(
    interpretarSalida(req, {
      decision: 'aplicar',
      resultado: {
        criterios: [
          { criterio: 'Examen', porcentaje: 50 },
          { criterio: 'Proyecto', porcentaje: 40 },
        ],
      },
      motivo: null,
    }).tipo,
    'incoherente',
  )

  assertEquals(
    interpretarSalida(req, {
      decision: 'aplicar',
      resultado: {
        criterios: [
          { criterio: ' Examen ', porcentaje: 60 },
          { criterio: 'Proyecto', porcentaje: 40 },
        ],
      },
      motivo: null,
    }),
    {
      tipo: 'aplicar',
      resultado: {
        criterios: [
          { criterio: 'Examen', porcentaje: 60 },
          { criterio: 'Proyecto', porcentaje: 40 },
        ],
      },
    },
  )
})

Deno.test(
  'proponer_bibliografia no admite repetir una referencia existente',
  () => {
    const req = peticion({
      accion: 'proponer_bibliografia',
      ambito: AMBITO_ASIGNATURA,
      contexto: 'libro de texto',
      sesion_id: SESION,
      payload: {
        asignatura_id: ASIGNATURA,
        asignatura_nombre: 'Cálculo I',
        formato: 'apa',
        existentes: [
          { titulo: 'Cálculo', cita: 'Stewart, J. (2015). Cálculo.' },
        ],
      },
    })

    assertEquals(
      interpretarSalida(req, {
        decision: 'aplicar',
        resultado: {
          cita: '  stewart, j. (2015).   Cálculo.  ',
          tipo: 'BASICA',
          formato: 'apa',
          titulo: 'Cálculo',
          autores: ['Stewart, J.'],
          editorial: null,
          anio: 2015,
          isbn: null,
          referencia_en_linea: null,
        },
        motivo: null,
      }).tipo,
      'incoherente',
    )
  },
)

Deno.test(
  'proponer_prerrequisito admite null pero no repetir la seriación actual',
  () => {
    const conSeriacion = peticion({
      accion: 'proponer_prerrequisito',
      ambito: AMBITO_ASIGNATURA,
      contexto: 'antecedente real',
      sesion_id: SESION,
      payload: {
        asignatura_id: ASIGNATURA,
        asignatura_nombre: 'Cálculo II',
        numero_ciclo: 2,
        nombre_ciclo: 'Semestre',
        prerrequisito_actual: OTRA_ASIGNATURA,
        candidatas: [
          {
            id: OTRA_ASIGNATURA,
            nombre: 'Cálculo I',
            clave: 'CAL-101',
            numero_ciclo: 1,
            misma_linea: true,
          },
        ],
      },
    })

    assertEquals(
      interpretarSalida(conSeriacion, {
        decision: 'aplicar',
        resultado: { asignatura_id: null },
        motivo: null,
      }),
      { tipo: 'aplicar', resultado: { asignatura_id: null } },
    )

    assertEquals(
      interpretarSalida(conSeriacion, {
        decision: 'aplicar',
        resultado: { asignatura_id: OTRA_ASIGNATURA },
        motivo: null,
      }).tipo,
      'incoherente',
      'proponer lo que ya estaba no es un cambio',
    )

    assertEquals(
      interpretarSalida(conSeriacion, {
        decision: 'aplicar',
        resultado: { asignatura_id: PLAN },
        motivo: null,
      }).tipo,
      'incoherente',
    )
  },
)

Deno.test('mejorar_campo con opciones sólo admite un valor admitido', () => {
  const req = peticion({
    accion: 'mejorar_campo',
    ambito: AMBITO_ASIGNATURA,
    contexto: 'obligatoria',
    sesion_id: SESION,
    payload: {
      entidad: 'asignatura',
      entidad_id: ASIGNATURA,
      clave: 'tipo',
      label: 'Tipo de asignatura',
      contenido_actual: 'OPTATIVA',
      es_richtext: false,
      opciones: ['OBLIGATORIA', 'OPTATIVA'],
    },
  })

  assertEquals(
    interpretarSalida(req, {
      decision: 'aplicar',
      resultado: { contenido: 'TRONCAL' },
      motivo: null,
    }).tipo,
    'incoherente',
  )
  assertEquals(
    interpretarSalida(req, {
      decision: 'aplicar',
      resultado: { contenido: 'OBLIGATORIA' },
      motivo: null,
    }),
    { tipo: 'aplicar', resultado: { contenido: 'OBLIGATORIA' } },
  )
})

Deno.test('reubicar_unidad acota la posición a la lista de destino', () => {
  const temario = [
    {
      id: 'u-1',
      numero: 1,
      titulo: 'Límites',
      temas: [{ id: 't-1-0', nombre: 'Noción de límite', horas_estimadas: 4 }],
    },
    { id: 'u-2', numero: 2, titulo: 'Derivadas', temas: [] },
  ]

  const unidad = peticion({
    accion: 'reubicar_unidad',
    ambito: AMBITO_ASIGNATURA,
    contexto: 'más al principio',
    sesion_id: SESION,
    payload: {
      asignatura_id: ASIGNATURA,
      asignatura_nombre: 'Cálculo I',
      unidades: temario,
      unidad_id: 'u-2',
    },
  })

  assertEquals(
    interpretarSalida(unidad, {
      decision: 'aplicar',
      resultado: { posicion: 5, unidad_destino_id: null },
      motivo: null,
    }).tipo,
    'incoherente',
  )
  assertEquals(
    interpretarSalida(unidad, {
      decision: 'aplicar',
      resultado: { posicion: 1, unidad_destino_id: 'u-1' },
      motivo: null,
    }),
    { tipo: 'aplicar', resultado: { posicion: 1, unidad_destino_id: null } },
    'una unidad no cambia de contenedor: el destino se normaliza a null',
  )

  const tema = peticion({
    accion: 'reubicar_unidad',
    ambito: AMBITO_ASIGNATURA,
    contexto: 'a derivadas',
    sesion_id: SESION,
    payload: {
      asignatura_id: ASIGNATURA,
      asignatura_nombre: 'Cálculo I',
      unidades: temario,
      unidad_id: 'u-1',
      tema_id: 't-1-0',
    },
  })

  assertEquals(
    interpretarSalida(tema, {
      decision: 'aplicar',
      resultado: { posicion: 1, unidad_destino_id: 'u-2' },
      motivo: null,
    }),
    { tipo: 'aplicar', resultado: { posicion: 1, unidad_destino_id: 'u-2' } },
  )
  assertEquals(
    interpretarSalida(tema, {
      decision: 'aplicar',
      resultado: { posicion: 3, unidad_destino_id: 'u-2' },
      motivo: null,
    }).tipo,
    'incoherente',
    'la unidad de destino sólo tiene sitio para un tema más',
  )
})
