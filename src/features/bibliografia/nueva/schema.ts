import { formOptions } from '@tanstack/react-form'
import { z } from 'zod'

import type {
  BibliografiaRef,
  IASugerencia,
  NuevaBibliografiaFormValues,
} from './types'

/* ------------------------------------------------------------------ */
/* Valores iniciales y formOptions compartidas (withForm)              */
/* ------------------------------------------------------------------ */

export function valoresInicialesNuevaBibliografia(): NuevaBibliografiaFormValues {
  return {
    metodo: null,
    fuenteBusqueda: 'EN_LINEA',
    tipoBusqueda: 'BASICA',
    ia: {
      q: '',
      idioma: 'ALL',
      sugerencias: [],
    },
    manual: {
      draft: {
        title: '',
        authorsText: '',
        publisher: '',
        yearText: '',
        isbn: '',
      },
      refs: [],
    },
    biblioteca: {
      q: '',
      refs: [],
    },
    formato: null,
    refs: [],
    citaEdits: {
      apa: {},
      ieee: {},
      chicago: {},
      vancouver: {},
    },
  }
}

/** Opciones compartidas del form del wizard (fijan el tipo para `withForm`). */
export const nuevaBibliografiaFormOpts = formOptions({
  defaultValues: valoresInicialesNuevaBibliografia(),
})

/* ------------------------------------------------------------------ */
/* Schemas de campo reutilizables (mensajes en español)                */
/* ------------------------------------------------------------------ */

/** Mismo mensaje que mostraba el antiguo `validateBeforeNext` del paso Detalles. */
export const tituloReferenciaSchema = z
  .string()
  .refine((v) => v.trim().length > 0, 'El título es requerido')

const sugerenciaSchema = z.custom<IASugerencia>(
  (v) => typeof v === 'object' && v !== null,
)

const referenciaSchema = z.custom<BibliografiaRef>(
  (v) => typeof v === 'object' && v !== null,
)

export const formatoCitaSchema = z.enum(
  ['apa', 'ieee', 'vancouver', 'chicago'],
  { error: 'Selecciona un formato' },
)

/**
 * Una comparación con biblioteca está resuelta cuando ya cargaron sus
 * alternativas y, de existir, el usuario eligió mantener o sustituir.
 */
export function sugerenciaBibliotecaResuelta(s: IASugerencia): boolean {
  const b = s.biblioteca
  if (!b || !Array.isArray(b.options)) return false
  if (b.options.length === 0) return true
  return Boolean(b.choiceId)
}

/**
 * Devuelve el primer mensaje de error de un schema, o `undefined` si es
 * válido. Útil como validador de campo de TanStack Form.
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
  metodo: z.enum(['MANUAL', 'BUSCAR'], {
    error: 'Selecciona un método para continuar.',
  }),
})

/** Paso 2 — búsqueda: al menos una referencia externa o institucional. */
export const pasoSugerenciasSchema = z
  .object({
    ia: z.object({
      sugerencias: z.array(sugerenciaSchema),
    }),
    biblioteca: z.object({
      refs: z.array(referenciaSchema),
    }),
  })
  .refine(
    (values) =>
      values.ia.sugerencias.some((s) => s.selected) ||
      values.biblioteca.refs.length > 0,
    {
      message: 'Selecciona al menos una referencia.',
    },
  )

/** Paso 2 — captura manual: al menos una referencia en la lista. */
export const pasoReferenciasSchema = z.object({
  manual: z.object({
    refs: z.array(referenciaSchema).min(1, 'Agrega al menos una referencia.'),
  }),
})

/** Verificación de referencias externas: todas las comparaciones resueltas. */
export const pasoBibliotecaSchema = z.object({
  ia: z.object({
    sugerencias: z
      .array(sugerenciaSchema)
      .refine(
        (sugerencias) =>
          sugerencias
            .filter((s) => s.selected)
            .every(sugerenciaBibliotecaResuelta),
        'Resuelve las comparaciones pendientes con la biblioteca.',
      ),
  }),
})

/** Paso 3 — Detalles: formato elegido y títulos completos. */
export const pasoDetallesSchema = z.object({
  formato: formatoCitaSchema,
  refs: z
    .array(
      referenciaSchema.refine(
        (r) => r.title.trim().length > 0,
        'El título es requerido',
      ),
    )
    .min(1, 'No hay referencias'),
})

/* ------------------------------------------------------------------ */
/* Derivaciones de avance (equivalentes a los antiguos `canContinue*`) */
/* ------------------------------------------------------------------ */

export function puedeContinuarDesdeMetodo(
  values: NuevaBibliografiaFormValues,
): boolean {
  return pasoMetodoSchema.safeParse(values).success
}

export function puedeContinuarDesdePaso2(
  values: NuevaBibliografiaFormValues,
): boolean {
  return values.metodo === 'BUSCAR'
    ? pasoSugerenciasSchema.safeParse(values).success
    : pasoReferenciasSchema.safeParse(values).success
}

/** Formato elegido y una cita no vacía por cada referencia. */
export function puedeContinuarDesdePaso3(
  values: NuevaBibliografiaFormValues,
): boolean {
  const formato = values.formato
  if (!formato) return false
  if (values.refs.length === 0) return false
  const map = values.citaEdits[formato]
  return values.refs.every(
    (r) => typeof map[r.id] === 'string' && map[r.id].trim().length > 0,
  )
}
