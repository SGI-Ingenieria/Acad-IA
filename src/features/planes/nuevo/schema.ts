import { formOptions } from '@tanstack/react-form'
import { z } from 'zod'

import type { NuevoPlanFormValues } from './types'
import type { UploadedFile } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'
import type { TipoOrigen } from '@/data/types/domain'

import { isFechaCurricularPasada } from '@/lib/plan-curricular'

/* ------------------------------------------------------------------ */
/* Valores iniciales y formOptions compartidas (withForm)              */
/* ------------------------------------------------------------------ */

export function valoresInicialesNuevoPlan(): NuevoPlanFormValues {
  return {
    tipoOrigen: null,
    datosBasicos: {
      nombrePlan: '',
      facultad: { id: '', nombre: '' },
      carrera: { id: '', nombre: '' },
      tipoCiclo: '',
      numCiclos: null,
      tipoEstructura: null,
      estructuraPlanId: null,
      fechaInicioImparticion: null,
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
  id: z.string().min(1, 'Selecciona una facultad.'),
  nombre: z.string(),
})

export const carreraSeleccionadaSchema = z.object({
  id: z.string().min(1, 'Selecciona una carrera.'),
  nombre: z.string(),
})

export const numCiclosSchema = z
  .number({ error: 'Indica el número de ciclos.' })
  .int('El número de ciclos debe ser entero.')
  .min(1, 'Indica al menos un ciclo.')

export const estructuraPlanSchema = z
  .string({ error: 'Selecciona una estructura de plan de estudios.' })
  .min(1, 'Selecciona una estructura de plan de estudios.')

export const tipoEstructuraPlanSchema = z.enum(
  ['CURRICULAR', 'NO_CURRICULAR'],
  { error: 'Indica si el plan es curricular o no curricular.' },
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
        numCiclos: numCiclosSchema,
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

/** Configuración — archivo fuente de CLONADO_TRADICIONAL. */
export const pasoDetallesClonadoTradicionalSchema = z.object({
  clonTradicional: z.object({
    archivoPlanId: archivoPlanSchema,
  }),
})

/* ------------------------------------------------------------------ */
/* Campos a validar al pulsar "Siguiente" (por paso y modo)            */
/* ------------------------------------------------------------------ */

export type PasoWizardId = 'modo' | 'basicos' | 'detalles' | 'resumen'

export type CampoValidable =
  | 'tipoOrigen'
  | 'datosBasicos.nombrePlan'
  | 'datosBasicos.facultad'
  | 'datosBasicos.carrera'
  | 'datosBasicos.numCiclos'
  | 'datosBasicos.tipoEstructura'
  | 'datosBasicos.estructuraPlanId'
  | 'datosBasicos.fechaInicioImparticion'
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
function camposBasicosGeneral(esCurricular: boolean): Array<CampoValidable> {
  return [
    'datosBasicos.facultad',
    'datosBasicos.carrera',
    'datosBasicos.tipoEstructura',
    ...(esCurricular
      ? (['datosBasicos.fechaInicioImparticion'] as const)
      : (['datosBasicos.nombrePlan'] as const)),
    'datosBasicos.numCiclos',
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
): Array<CampoValidable> {
  if (paso === 'modo') return ['tipoOrigen']

  if (paso === 'basicos') {
    if (tipoOrigen === 'CLONADO_INTERNO') return ['clonInterno.planOrigenId']
    if (tipoOrigen === 'CLONADO_TRADICIONAL') {
      return [
        'datosBasicos.tipoEstructura',
        ...(esCurricular
          ? (['datosBasicos.fechaInicioImparticion'] as const)
          : []),
      ]
    }
    return camposBasicosGeneral(esCurricular)
  }

  if (paso === 'detalles') {
    if (tipoOrigen === 'CLONADO_INTERNO') {
      return camposBasicosGeneral(esCurricular)
    }
    if (tipoOrigen === 'IA') return ['iaConfig.descripcionEnfoqueAcademico']
    if (tipoOrigen === 'CLONADO_TRADICIONAL') {
      return ['clonTradicional.archivoPlanId']
    }
  }

  return []
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
      return [pasoBasicosSchema(esCurricular), pasoDetallesIASchema]
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
