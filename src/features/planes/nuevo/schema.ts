import { formOptions } from '@tanstack/react-form'
import { z } from 'zod'

import type { NuevoPlanFormValues } from './types'
import type { UploadedFile } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'
import type { TipoOrigen } from '@/data/types/domain'

import {
  isFechaCurricularPasada,
  toMonthStartDateString,
} from '@/lib/plan-curricular'

/* ------------------------------------------------------------------ */
/* Valores iniciales y formOptions compartidas (withForm)              */
/* ------------------------------------------------------------------ */

export function valoresInicialesNuevoPlan(): NuevoPlanFormValues {
  const ahora = new Date()

  return {
    tipoOrigen: null,
    datosBasicos: {
      nombrePlan: '',
      facultad: { id: '', nombre: '' },
      carrera: { id: '', nombre: '' },
      tipoCiclo: '',
      numCiclos: 1,
      semanasPorCiclo: null,
      tipoEstructura: null,
      estructuraPlanId: null,
      estructuraRecomendadaId: null,
      motivoEstructuraManual: '',
      fechaInicioImparticion: toMonthStartDateString(
        ahora.getFullYear(),
        ahora.getMonth(),
      ),
    },
    clonInterno: {
      planOrigenId: null,
      planOrigenNombre: null,
      facultadId: null,
      carreraId: null,
      search: '',
    },
    clonTradicional: {
      archivoPlanId: null,
    },
    iaConfig: {
      descripcionEnfoqueAcademico: '',
      instruccionesAdicionalesIA: '',
      archivosReferencia: [],
      coleccionesReferencia: [],
      archivosAdjuntos: [],
      webSearchEnabled: false,
      reasoningEffort: 'auto',
      alcance: {
        lineasCurriculares: true,
        asignaturas: false,
        acomodarAsignaturas: true,
        ordenarAsignaturas: true,
        horasAsignaturas: true,
        bibliografia: false,
      },
    },
    iaBrief: {
      borradorId: null,
      ronda: 0,
      estado: 'SIN_ANALIZAR',
      firma: null,
      fundamentos: {
        perfilIngreso: '',
        perfilEgreso: '',
        finesAprendizaje: '',
      },
      contradicciones: [],
      oportunidades: [],
      referentes: [],
      preguntas: [],
      respuestas: {},
      supuestos: [],
      explicacion: '',
    },
    confirmarFechaPasada: false,
    archivosAdjuntosDedupePending: 0,
  }
}

/**
 * Opciones compartidas del form del wizard. Los `defaultValues` de aquí solo
 * fijan el tipo para `withForm`; el contenedor pasa los valores reales
 * (incluido el borrador restaurado de una generación cancelada).
 */
export const nuevoPlanFormOpts = formOptions({
  defaultValues: valoresInicialesNuevoPlan(),
})

/* ------------------------------------------------------------------ */
/* Métodos de creación válidos (hojas seleccionables)                  */
/* ------------------------------------------------------------------ */

export const TIPOS_ORIGEN_FINALES = [
  'MANUAL',
  'IA',
  'CLONADO_INTERNO',
  'CLONADO_TRADICIONAL',
] as const

export type TipoOrigenFinal = (typeof TIPOS_ORIGEN_FINALES)[number]

export function esTipoOrigenFinal(
  valor: TipoOrigen | null | undefined,
): valor is TipoOrigenFinal {
  return (TIPOS_ORIGEN_FINALES as ReadonlyArray<string>).includes(valor ?? '')
}

/* ------------------------------------------------------------------ */
/* Schemas de campo reutilizables (mensajes en español)                */
/* ------------------------------------------------------------------ */

export const tipoOrigenPlanSchema = z.enum(TIPOS_ORIGEN_FINALES, {
  error: 'Selecciona un método de creación para continuar.',
})

export const nombrePlanSchema = z
  .string()
  .trim()
  .min(1, 'El nombre del plan es requerido.')
  .max(200, 'El nombre no puede exceder 200 caracteres.')

export const facultadSeleccionadaSchema = z.object({
  id: z.string().min(1, 'Selecciona una facultad para continuar.'),
  nombre: z.string(),
})

export const carreraSeleccionadaSchema = z.object({
  id: z.string().min(1, 'Selecciona una carrera para continuar.'),
  nombre: z.string(),
})

export const numCiclosSchema = z
  .number({ error: 'Indica el número de ciclos.' })
  .int('El número de ciclos debe ser entero.')
  .min(1, 'Indica al menos un ciclo.')

/**
 * Duración del ciclo. Sólo se exige con ciclos de tipo «Otro»: sin ella, un
 * ciclo con nombre propio no permite calcular la carga horaria del plan.
 */
export const semanasPorCicloSchema = z
  .number({ error: 'Indica cuántas semanas dura cada ciclo.' })
  .int('Las semanas deben ser un número entero.')
  .min(1, 'Indica al menos una semana.')
  .max(104, 'Un ciclo no puede durar más de 104 semanas.')

export const estructuraPlanSchema = z
  .string({ error: 'Selecciona una estructura de plan de estudios.' })
  .min(1, 'Selecciona una estructura de plan de estudios.')

export const tipoEstructuraPlanSchema = z.enum(
  ['CURRICULAR', 'NO_CURRICULAR'],
  { error: 'Selecciona el tipo de plan de estudios para continuar.' },
)

export const enfoqueAcademicoPlanSchema = z
  .string()
  .trim()
  .min(1, 'Describe el enfoque académico para la IA.')
  .max(7000, 'El enfoque no puede exceder 7000 caracteres.')

export const planFuenteSchema = z
  .string({ error: 'Selecciona el plan de estudios que quieres clonar.' })
  .min(1, 'Selecciona el plan de estudios que quieres clonar.')

export const archivoPlanSchema = z
  .custom<UploadedFile>(
    (v) => typeof v === 'object' && v !== null,
    'Sube el Word o PDF del plan de estudios antes de continuar.',
  )
  .refine(
    (v) => v.uploadStatus === 'exito',
    'El archivo aún no ha terminado de subirse. Espera a que esté en éxito.',
  )

/**
 * Regla condicional del inicio de impartición (solo estructuras CURRICULAR):
 * es requerido y, si el mes es pasado, exige la confirmación explícita.
 * Se comparte entre el validador del campo y la validación final por modo.
 */
export function errorFechaImparticion(
  esCurricular: boolean,
  fecha: string | null,
  confirmarFechaPasada: boolean,
): string | undefined {
  if (!esCurricular) return undefined
  if (!fecha) return 'Selecciona el mes de inicio de impartición.'
  if (isFechaCurricularPasada(fecha) && !confirmarFechaPasada) {
    return 'El inicio seleccionado es pasado: confirma que el mes es correcto para continuar.'
  }
  return undefined
}

/**
 * Devuelve el primer mensaje de error de un schema, o `undefined` si es
 * válido. Útil como validador de campo de TanStack Form cuando el tipo del
 * campo admite `null` y el schema no (p. ej. selects requeridos).
 */
export function primerError(
  schema: z.ZodType<unknown, unknown>,
  valor: unknown,
): string | undefined {
  const result = schema.safeParse(valor)
  if (result.success) return undefined
  return result.error.issues[0]?.message ?? 'Valor inválido.'
}

/* ------------------------------------------------------------------ */
/* Schemas por paso                                                    */
/* ------------------------------------------------------------------ */

/** Paso 1 — Método. */
export const pasoModoSchema = z.object({
  tipoOrigen: tipoOrigenPlanSchema,
})

/**
 * Naturaleza del plan. Incluye la versión normativa porque elegir el tipo es
 * justo lo que la selecciona: un tipo sin plantilla publicada no permite
 * continuar, y el motivo debe decir eso y no «selecciona una estructura».
 */
export const pasoTipoPlanSchema = z.object({
  datosBasicos: z.object({
    tipoEstructura: tipoEstructuraPlanSchema,
    estructuraPlanId: z
      .string({
        error:
          'No hay una versión normativa disponible para este tipo de plan.',
      })
      .min(
        1,
        'No hay una versión normativa disponible para este tipo de plan.',
      ),
  }),
})

/** Paso — facultad en la que vivirá el plan. */
export const pasoFacultadSchema = z.object({
  datosBasicos: z.object({
    facultad: facultadSeleccionadaSchema,
  }),
})

/** Paso — carrera a la que pertenece el plan. */
export const pasoCarreraSchema = z.object({
  datosBasicos: z.object({
    carrera: carreraSeleccionadaSchema,
  }),
})

/**
 * Configuración — datos básicos generales (MANUAL, IA y datos básicos de
 * CLONADO_INTERNO). El nombre solo es exigible cuando la estructura no es
 * curricular: en planes curriculares se deriva de carrera + inicio de
 * impartición.
 */
export function pasoBasicosSchema(esCurricular: boolean) {
  return z
    .object({
      datosBasicos: z.object({
        nombrePlan: esCurricular ? z.string() : nombrePlanSchema,
        facultad: facultadSeleccionadaSchema,
        carrera: carreraSeleccionadaSchema,
        tipoCiclo: z.string(),
        numCiclos: numCiclosSchema,
        semanasPorCiclo: z.number().nullable(),
        tipoEstructura: tipoEstructuraPlanSchema,
        estructuraPlanId: estructuraPlanSchema,
        estructuraRecomendadaId: z.string().nullable(),
        motivoEstructuraManual: z.string(),
        fechaInicioImparticion: z.string().nullable(),
      }),
      confirmarFechaPasada: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (v.datosBasicos.tipoCiclo === 'Otro') {
        const resultado = semanasPorCicloSchema.safeParse(
          v.datosBasicos.semanasPorCiclo,
        )
        if (!resultado.success) {
          ctx.addIssue({
            code: 'custom',
            message:
              resultado.error.issues[0]?.message ??
              'Indica cuántas semanas dura cada ciclo.',
            path: ['datosBasicos', 'semanasPorCiclo'],
          })
        }
      }
      const error = errorFechaImparticion(
        esCurricular,
        v.datosBasicos.fechaInicioImparticion,
        v.confirmarFechaPasada,
      )
      if (error) {
        ctx.addIssue({
          code: 'custom',
          message: error,
          path: ['datosBasicos', 'fechaInicioImparticion'],
        })
      }
      if (
        v.datosBasicos.estructuraRecomendadaId &&
        v.datosBasicos.estructuraPlanId !==
          v.datosBasicos.estructuraRecomendadaId &&
        !v.datosBasicos.motivoEstructuraManual.trim()
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Explica por qué se aplicará una versión distinta.',
          path: ['datosBasicos', 'motivoEstructuraManual'],
        })
      }
    })
}

/** Configuración — CLONADO_TRADICIONAL requiere estructura destino y fecha curricular. */
export function pasoBasicosClonadoTradicionalSchema(esCurricular: boolean) {
  return z
    .object({
      datosBasicos: z.object({
        tipoEstructura: tipoEstructuraPlanSchema,
        estructuraPlanId: estructuraPlanSchema,
        fechaInicioImparticion: z.string().nullable(),
      }),
      confirmarFechaPasada: z.boolean(),
    })
    .superRefine((v, ctx) => {
      const error = errorFechaImparticion(
        esCurricular,
        v.datosBasicos.fechaInicioImparticion,
        v.confirmarFechaPasada,
      )
      if (error) {
        ctx.addIssue({
          code: 'custom',
          message: error,
          path: ['datosBasicos', 'fechaInicioImparticion'],
        })
      }
    })
}

/** Configuración — selección del plan fuente interno. */
export const pasoFuenteClonadoSchema = z.object({
  clonInterno: z.object({
    planOrigenId: planFuenteSchema,
  }),
})

/** Configuración — solicitud para IA. */
export const pasoDetallesIASchema = z.object({
  iaConfig: z.object({
    descripcionEnfoqueAcademico: enfoqueAcademicoPlanSchema,
  }),
})

export const pasoEncuadreIASchema = z.object({
  iaBrief: z.object({
    estado: z.literal('LISTO', {
      error:
        'Confirma el encuadre curricular y responde las aclaraciones antes de crear el plan.',
    }),
  }),
})

/** Configuración — archivo fuente de CLONADO_TRADICIONAL. */
export const pasoDetallesClonadoTradicionalSchema = z.object({
  clonTradicional: z.object({
    archivoPlanId: archivoPlanSchema,
  }),
})

/* ------------------------------------------------------------------ */
/* Campos a validar al pulsar "Siguiente" (por paso y modo)            */
/* ------------------------------------------------------------------ */

export type PasoWizardId =
  | 'modo'
  | 'tipo'
  | 'facultad'
  | 'carrera'
  | 'basicos'
  | 'detalles'
  | 'aclaraciones'
  | 'resumen'

export type CampoValidable =
  | 'tipoOrigen'
  | 'datosBasicos.nombrePlan'
  | 'datosBasicos.facultad'
  | 'datosBasicos.carrera'
  | 'datosBasicos.numCiclos'
  | 'datosBasicos.semanasPorCiclo'
  | 'datosBasicos.tipoEstructura'
  | 'datosBasicos.estructuraPlanId'
  | 'datosBasicos.fechaInicioImparticion'
  | 'datosBasicos.motivoEstructuraManual'
  | 'clonInterno.planOrigenId'
  | 'iaConfig.descripcionEnfoqueAcademico'
  | 'clonTradicional.archivoPlanId'

/**
 * Datos básicos generales según la estructura elegida: en planes curriculares
 * el nombre se deriva (no se valida como campo) y el inicio de impartición es
 * obligatorio; en no curriculares es al revés. Solo se devuelven campos cuyo
 * control está montado en ese momento: validar un campo desmontado con
 * `form.validateField` no ejecuta su validador y podría devolver errores
 * obsoletos de un montaje anterior.
 */
/**
 * Campos que sólo existen bajo cierta condición del formulario. Se pasan como
 * objeto y no como booleanos posicionales porque ya son varios y en el punto de
 * llamada no se distinguirían.
 */
export type CondicionesBasicos = {
  /** Se aplica una versión normativa distinta de la recomendada. */
  requiereMotivoEstructura?: boolean
  /** El tipo de ciclo es «Otro», que no declara su duración. */
  requiereSemanas?: boolean
}

function camposBasicosGeneral(
  esCurricular: boolean,
  { requiereMotivoEstructura, requiereSemanas }: CondicionesBasicos,
): Array<CampoValidable> {
  // Ni facultad, ni carrera, ni tipo de plan: cada decisión se resuelve en una
  // vista interna y su control no está montado aquí. Validar un campo desmontado no ejecuta su
  // validador y devolvería el error obsoleto del montaje anterior.
  return [
    ...(esCurricular
      ? (['datosBasicos.fechaInicioImparticion'] as const)
      : (['datosBasicos.nombrePlan'] as const)),
    'datosBasicos.numCiclos',
    ...(requiereSemanas ? (['datosBasicos.semanasPorCiclo'] as const) : []),
    // Solo está montado —y solo es obligatorio— cuando se aplica una versión
    // normativa distinta de la recomendada para el inicio de impartición.
    ...(requiereMotivoEstructura
      ? (['datosBasicos.motivoEstructuraManual'] as const)
      : []),
  ]
}

/**
 * Campos del paso actual que deben validarse antes de `stepper.next()`.
 * Refleja los antiguos booleans `canContinue*` de `useNuevoPlanWizard`,
 * incluida la inversión de pasos del flujo CLONADO_INTERNO (fuente primero,
 * datos básicos después). `esCurricular` viene de los catálogos (tipo de la
 * estructura elegida), que no viven en el form.
 */
export function camposPorPaso(
  paso: PasoWizardId,
  tipoOrigen: TipoOrigen | null,
  esCurricular: boolean,
  condiciones: CondicionesBasicos = {},
): Array<CampoValidable> {
  if (paso === 'modo') return ['tipoOrigen']
  if (paso === 'tipo') return ['datosBasicos.tipoEstructura']
  if (paso === 'facultad') return ['datosBasicos.facultad']
  if (paso === 'carrera') return ['datosBasicos.carrera']

  if (paso === 'basicos') {
    if (tipoOrigen === 'CLONADO_INTERNO') return ['clonInterno.planOrigenId']
    if (tipoOrigen === 'CLONADO_TRADICIONAL') {
      return esCurricular ? ['datosBasicos.fechaInicioImparticion'] : []
    }
    return camposBasicosGeneral(esCurricular, condiciones)
  }

  if (paso === 'detalles') {
    if (tipoOrigen === 'CLONADO_INTERNO') {
      return camposBasicosGeneral(esCurricular, condiciones)
    }
    if (tipoOrigen === 'IA') return ['iaConfig.descripcionEnfoqueAcademico']
    if (tipoOrigen === 'CLONADO_TRADICIONAL') {
      return ['clonTradicional.archivoPlanId']
    }
  }

  return []
}

/* ------------------------------------------------------------------ */
/* Estado de completitud del paso (para desactivar la acción principal) */
/* ------------------------------------------------------------------ */

/**
 * Preguntas del encuadre que siguen sin respuesta. Se usa tanto para bloquear
 * el avance como para explicar por qué está bloqueado.
 */
export function preguntasSinResponder(
  values: NuevoPlanFormValues,
): Array<string> {
  return values.iaBrief.preguntas
    .filter(
      (pregunta) => !(values.iaBrief.respuestas[pregunta.id] ?? '').trim(),
    )
    .map((pregunta) => pregunta.id)
}

/**
 * Primer motivo por el que el paso actual todavía no puede completarse, o
 * `null` si está listo. Alimenta el mensaje contextual y la acción principal:
 * sin esto el usuario pulsa y sólo entonces descubre que falta un dato.
 *
 * Evalúa el mismo schema que se aplicaría al avanzar (o al crear, en el
 * resumen), de modo que el motivo mostrado y el error de validación coinciden.
 */
export function errorPasoActual(
  paso: PasoWizardId,
  values: NuevoPlanFormValues,
  esCurricular: boolean,
): string | null {
  const evaluar = (schema: z.ZodType<unknown, unknown>) =>
    primerError(schema, values) ?? null

  if (paso === 'modo') return evaluar(pasoModoSchema)
  if (paso === 'tipo') return evaluar(pasoTipoPlanSchema)
  if (paso === 'facultad') return evaluar(pasoFacultadSchema)
  if (paso === 'carrera') return evaluar(pasoCarreraSchema)

  if (paso === 'basicos') {
    if (!values.tipoOrigen) return evaluar(pasoModoSchema)
    if (values.tipoOrigen === 'CLONADO_INTERNO') {
      return evaluar(pasoFuenteClonadoSchema)
    }
    if (values.tipoOrigen === 'CLONADO_TRADICIONAL') {
      return evaluar(pasoBasicosClonadoTradicionalSchema(esCurricular))
    }
    return evaluar(pasoBasicosSchema(esCurricular))
  }

  if (paso === 'detalles') {
    if (values.tipoOrigen === 'CLONADO_INTERNO') {
      return evaluar(pasoBasicosSchema(esCurricular))
    }
    if (values.tipoOrigen === 'IA') return evaluar(pasoDetallesIASchema)
    if (values.tipoOrigen === 'CLONADO_TRADICIONAL') {
      return evaluar(pasoDetallesClonadoTradicionalSchema)
    }
    return null
  }

  if (paso === 'aclaraciones') {
    if (values.iaBrief.estado === 'SIN_ANALIZAR') {
      return 'Todavía no se ha analizado el encuadre curricular.'
    }
    const pendientes = preguntasSinResponder(values)
    if (pendientes.length === 1) {
      return 'Falta responder una pregunta del encuadre.'
    }
    if (pendientes.length > 1) {
      return `Faltan ${pendientes.length} preguntas del encuadre por responder.`
    }
    return null
  }

  return validarCreacion(values, esCurricular)
}

/* ------------------------------------------------------------------ */
/* Resumen: schemas completos por modo para el submit final            */
/* ------------------------------------------------------------------ */

export function esquemaCreacionPorModo(
  tipoOrigen: TipoOrigenFinal,
  esCurricular: boolean,
): Array<z.ZodType<unknown, unknown>> {
  switch (tipoOrigen) {
    case 'MANUAL':
      return [pasoBasicosSchema(esCurricular)]
    case 'IA':
      return [
        pasoBasicosSchema(esCurricular),
        pasoDetallesIASchema,
        pasoEncuadreIASchema,
      ]
    case 'CLONADO_INTERNO':
      return [pasoFuenteClonadoSchema, pasoBasicosSchema(esCurricular)]
    case 'CLONADO_TRADICIONAL':
      return [
        pasoBasicosClonadoTradicionalSchema(esCurricular),
        pasoDetallesClonadoTradicionalSchema,
      ]
  }
}

/**
 * Valida los valores completos del modo elegido antes de crear.
 * Devuelve el primer mensaje de error en español, o `null` si todo es válido.
 * `esCurricular` viene de los catálogos (tipo de la estructura elegida), que
 * no viven en el form.
 */
export function validarCreacion(
  values: NuevoPlanFormValues,
  esCurricular: boolean,
): string | null {
  if (!esTipoOrigenFinal(values.tipoOrigen)) {
    return 'Selecciona un método de creación para continuar.'
  }
  for (const schema of esquemaCreacionPorModo(
    values.tipoOrigen,
    esCurricular,
  )) {
    const result = schema.safeParse(values)
    if (!result.success) {
      return (
        result.error.issues[0]?.message ?? 'Revisa los datos del formulario.'
      )
    }
  }
  return null
}
