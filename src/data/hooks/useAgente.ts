import { useMutation } from '@tanstack/react-query'

import { agente_accion } from '../api/agente.api'
import { mk } from '../query/keys'
import { getEdgeFunctionErrorCode } from '../supabase/invokeEdge'

import type { AgenteAccionInput, AgenteAccionOutput } from '../api/agente.api'

/** Códigos que la Edge Function devuelve y que tienen un mensaje propio. */
const MENSAJES_POR_CODIGO: Record<string, string> = {
  IA_NO_AUTORIZADA: 'No tienes permiso para usar la IA en este plan.',
  PLAN_CONGELADO: 'El plan está en una etapa que ya no admite cambios de IA.',
  CONTEXTO_VACIO: 'Escribe unas palabras de contexto en el dock del agente.',
  ACCION_NO_SOPORTADA: 'Esa acción todavía no está disponible.',
  SCHEMA_INVALIDO: 'La IA devolvió una respuesta que no se pudo interpretar.',
  PROVEEDOR_NO_DISPONIBLE:
    'El proveedor de IA no respondió. Vuelve a intentarlo en un momento.',
}

export function mensajeErrorAgente(error: unknown): string {
  const codigo = getEdgeFunctionErrorCode(error)
  if (codigo && MENSAJES_POR_CODIGO[codigo]) return MENSAJES_POR_CODIGO[codigo]
  if (error instanceof Error && error.message) return error.message
  return 'No se pudo completar la acción del agente.'
}

/** Códigos que nunca deben reintentarse: el resultado no cambiaría. */
const CODIGOS_PERMANENTES = new Set([
  'IA_NO_AUTORIZADA',
  'PLAN_CONGELADO',
  'CONTEXTO_VACIO',
  'ACCION_NO_SOPORTADA',
  'VALIDATION_ERROR',
  'METHOD_NOT_ALLOWED',
])

/**
 * Ejecuta una acción del modo agente contra `ai-agente-accion`.
 *
 * No hace escrituras de caché: quien decide cómo aplicar el resultado es la
 * acción concreta (`AccionAgente.aplicar`), que reutiliza los hooks optimistas
 * ya existentes del dominio. Este hook sólo cubre el viaje de ida y vuelta y la
 * traducción del error.
 *
 * `meta.errorMessage: false` porque el dock del agente muestra el fallo en el
 * propio elemento afectado; un toast global además sería ruido duplicado.
 */
export function useAgenteAccion() {
  return useMutation<AgenteAccionOutput, Error, AgenteAccionInput>({
    mutationKey: mk.agenteAccion(),
    mutationFn: agente_accion,
    meta: { errorMessage: false },
    retry: (intento, error) => {
      const codigo = getEdgeFunctionErrorCode(error)
      if (codigo && CODIGOS_PERMANENTES.has(codigo)) return false
      return intento < 1
    },
    retryDelay: 800,
  })
}
