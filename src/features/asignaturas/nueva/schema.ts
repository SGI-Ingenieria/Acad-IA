import { formOptions } from '@tanstack/react-form'
import { z } from 'zod'

import type {
  AsignaturaSugerida,
  NuevaAsignaturaFormValues,
  TipoOrigenCreacion,
} from './types'
import type { UploadedFile } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'

/* ------------------------------------------------------------------ */
/* Valores iniciales y formOptions compartidas (withForm)              */
/* ------------------------------------------------------------------ */

export function valoresInicialesNuevaAsignatura(
  planId: string,
): NuevaAsignaturaFormValues {
  return {
    plan_estudio_id: planId,
    estructuraId: null,
    tipoOrigen: null,
    datosBasicos: {
      nombre: '',
      codigo: '',
      tipo: null,
      horasAcademicas: null,
      horasIndependientes: null,
      estructuraId: null,
    },
    sugerencias: [],
    clonInterno: {
      facultadId: null,
      carreraId: null,
      planOrigenId: null,
      asignaturaOrigenId: null,
      search: '',
      page: 1,
    },
    clonTradicional: {
      archivosAdjuntos: [],
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
    iaMultiple: {
      enfoque: '',
      cantidadDeSugerencias: 10,
    },
    archivosAdjuntosDedupePending: 0,
  }
}

/**
 * Opciones compartidas del form del wizard. Los `defaultValues` de aquí solo
 * fijan el tipo para `withForm`; el contenedor pasa los valores reales
 * (incluido el borrador restaurado de una generación cancelada).
 */
export const nuevaAsignaturaFormOpts = formOptions({
  defaultValues: valoresInicialesNuevaAsignatura(''),
})

/* ------------------------------------------------------------------ */
/* Métodos de creación válidos (hojas seleccionables)                  */
/* ------------------------------------------------------------------ */

export const TIPOS_ORIGEN_FINALES = [
  'MANUAL',
  'IA_SIMPLE',
  'IA_MULTIPLE',
  'CLONADO_INTERNO',
  'CLONADO_TRADICIONAL',
] as const

export type TipoOrigenFinal = (typeof TIPOS_ORIGEN_FINALES)[number]

export function esTipoOrigenFinal(
  valor: TipoOrigenCreacion | null | undefined,
): valor is TipoOrigenFinal {
  return (TIPOS_ORIGEN_FINALES as ReadonlyArray<string>).includes(valor ?? '')
}

/* ------------------------------------------------------------------ */
/* Schemas de campo reutilizables (mensajes en español)                */
/* ------------------------------------------------------------------ */

export const nombreAsignaturaSchema = z
  .string()
  .trim()
  .min(1, 'El nombre de la asignatura es requerido.')
  .max(200, 'El nombre no puede exceder 200 caracteres.')

export const tipoAsignaturaSchema = z.enum(
  ['OBLIGATORIA', 'OPTATIVA', 'TRONCAL', 'OTRA'],
  { error: 'Selecciona el tipo de asignatura.' },
)

export const estructuraSchema = z
  .string({ error: 'Selecciona una estructura de asignatura.' })
  .min(1, 'Selecciona una estructura de asignatura.')

export const enfoqueAcademicoSchema = z
  .string()
  .trim()
  .min(1, 'Describe el enfoque académico para la IA.')
  .max(7000, 'El enfoque no puede exceder 7000 caracteres.')

export const asignaturaFuenteSchema = z
  .string({ error: 'Selecciona una asignatura fuente.' })
  .min(1, 'Selecciona una asignatura fuente.')

export const tipoOrigenSchema = z.enum(TIPOS_ORIGEN_FINALES, {
  error: 'Selecciona un método de creación para continuar.',
})

const sugerenciaSchema = z.custom<AsignaturaSugerida>(
  (v) => typeof v === 'object' && v !== null,
)

export const sugerenciasSeleccionadasSchema = z
  .array(sugerenciaSchema)
  .refine(
    (sugerencias) => sugerencias.some((s) => s.selected),
    'Selecciona al menos una sugerencia.',
  )

const archivoAdjuntoSchema = z.custom<UploadedFile>(
  (v) => typeof v === 'object' && v !== null,
)

export const archivosClonadoSchema = z
  .array(archivoAdjuntoSchema)
  .min(1, 'Sube al menos un Word o PDF para continuar.')
  .max(10, 'Máximo 10 archivos por carga.')

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
export const pasoMetodoSchema = z.object({
  tipoOrigen: tipoOrigenSchema,
})

/** Paso 2 — Datos básicos (MANUAL, IA_SIMPLE y datos básicos de CLONADO_INTERNO). */
export const pasoBasicosSchema = z.object({
  datosBasicos: z.object({
    nombre: nombreAsignaturaSchema,
    tipo: tipoAsignaturaSchema,
    estructuraId: estructuraSchema,
  }),
})

/** Paso 2 — CLONADO_TRADICIONAL solo requiere estructura destino. */
export const pasoBasicosClonadoTradicionalSchema = z.object({
  datosBasicos: z.object({
    estructuraId: estructuraSchema,
  }),
})

/** Paso 2 — IA_MULTIPLE: sugerencias generadas con al menos una selección. */
export const pasoSugerenciasSchema = z.object({
  sugerencias: sugerenciasSeleccionadasSchema,
})

/** Paso 2 — CLONADO_INTERNO: selección de la asignatura fuente. */
export const pasoFuenteClonadoSchema = z.object({
  clonInterno: z.object({
    asignaturaOrigenId: asignaturaFuenteSchema,
  }),
})

/** Paso 3 — Detalles IA_SIMPLE. */
export const pasoDetallesIASimpleSchema = z.object({
  iaConfig: z.object({
    descripcionEnfoqueAcademico: enfoqueAcademicoSchema,
  }),
})

/** Paso 3 — Detalles IA_MULTIPLE (estructura destino). */
export const pasoDetallesIAMultipleSchema = z.object({
  estructuraId: estructuraSchema,
})

/** Paso 3 — Detalles CLONADO_TRADICIONAL (archivos fuente). */
export const pasoDetallesClonadoTradicionalSchema = z.object({
  clonTradicional: z.object({
    archivosAdjuntos: archivosClonadoSchema,
  }),
})

/* ------------------------------------------------------------------ */
/* Campos a validar al pulsar "Siguiente" (por paso y modo)            */
/* ------------------------------------------------------------------ */

export type PasoWizardId = 'metodo' | 'basicos' | 'detalles' | 'resumen'

export type CampoValidable =
  | 'tipoOrigen'
  | 'datosBasicos.nombre'
  | 'datosBasicos.tipo'
  | 'datosBasicos.estructuraId'
  | 'sugerencias'
  | 'clonInterno.asignaturaOrigenId'
  | 'iaConfig.descripcionEnfoqueAcademico'
  | 'estructuraId'
  | 'clonTradicional.archivosAdjuntos'

const CAMPOS_BASICOS_GENERAL: Array<CampoValidable> = [
  'datosBasicos.nombre',
  'datosBasicos.tipo',
  'datosBasicos.estructuraId',
]

/**
 * Campos del paso actual que deben validarse antes de `stepper.next()`.
 * Refleja los antiguos booleans `canContinue*` de `useNuevaAsignaturaWizard`,
 * incluida la inversión de pasos del flujo CLONADO_INTERNO (fuente primero,
 * datos básicos después).
 */
export function camposPorPaso(
  paso: PasoWizardId,
  tipoOrigen: TipoOrigenCreacion | null,
): Array<CampoValidable> {
  if (paso === 'metodo') return ['tipoOrigen']

  if (paso === 'basicos') {
    if (tipoOrigen === 'CLONADO_INTERNO') {
      return ['clonInterno.asignaturaOrigenId']
    }
    if (tipoOrigen === 'IA_MULTIPLE') return ['sugerencias']
    if (tipoOrigen === 'CLONADO_TRADICIONAL') {
      return ['datosBasicos.estructuraId']
    }
    return CAMPOS_BASICOS_GENERAL
  }

  if (paso === 'detalles') {
    if (tipoOrigen === 'CLONADO_INTERNO') return CAMPOS_BASICOS_GENERAL
    if (tipoOrigen === 'IA_SIMPLE') {
      return ['iaConfig.descripcionEnfoqueAcademico']
    }
    if (tipoOrigen === 'IA_MULTIPLE') return ['estructuraId']
    if (tipoOrigen === 'CLONADO_TRADICIONAL') {
      return ['clonTradicional.archivosAdjuntos']
    }
    return []
  }

  return []
}

/* ------------------------------------------------------------------ */
/* Paso 4 — Resumen: schema completo por modo para el submit final     */
/* ------------------------------------------------------------------ */

const planRequeridoSchema = z.object({
  plan_estudio_id: z
    .string({ error: 'Plan de estudio inválido.' })
    .min(1, 'Plan de estudio inválido.'),
})

export const esquemaCreacionPorModo: Record<
  TipoOrigenFinal,
  z.ZodType<unknown, unknown>
> = {
  MANUAL: planRequeridoSchema.extend(pasoBasicosSchema.shape),
  IA_SIMPLE: planRequeridoSchema
    .extend(pasoBasicosSchema.shape)
    .extend(pasoDetallesIASimpleSchema.shape),
  IA_MULTIPLE: planRequeridoSchema
    .extend(pasoSugerenciasSchema.shape)
    .extend(pasoDetallesIAMultipleSchema.shape),
  CLONADO_INTERNO: planRequeridoSchema
    .extend(pasoFuenteClonadoSchema.shape)
    .extend(pasoBasicosSchema.shape),
  CLONADO_TRADICIONAL: planRequeridoSchema
    .extend(pasoBasicosClonadoTradicionalSchema.shape)
    .extend(pasoDetallesClonadoTradicionalSchema.shape),
}

/**
 * Valida los valores completos del modo elegido antes de crear.
 * Devuelve el primer mensaje de error en español, o `null` si todo es válido.
 */
export function validarCreacion(
  values: NuevaAsignaturaFormValues,
): string | null {
  if (!esTipoOrigenFinal(values.tipoOrigen)) {
    return 'Selecciona un método de creación para continuar.'
  }
  const result = esquemaCreacionPorModo[values.tipoOrigen].safeParse(values)
  if (result.success) return null
  return result.error.issues[0]?.message ?? 'Revisa los datos del formulario.'
}
