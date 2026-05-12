import { handleCrearAsignaturaResponse } from './crear.ts'

import type { ResponseMetadata } from '../../_shared/utils.ts'
import type { OpenAI } from 'openai'

async function marcarAsignaturaFallidaPorWebhook(
  response: OpenAI.Responses.Response,
): Promise<void> {
  const metadata = response.metadata as ResponseMetadata | null
  const asignaturaId = metadata?.id
  if (!asignaturaId) {
    console.warn('No se recibió metadata.id para marcar asignatura fallida')
    return
  }

  // Reutilizamos el mismo handler de "crear" para registrar error de forma consistente
  // (parseará output_text si existe; si no, dejará meta_origen.error y estado fallida).
  await handleCrearAsignaturaResponse({
    ...response,
    output_text: '',
  } as unknown as OpenAI.Responses.Response)
}

export async function handleAsignaturasResponse(
  response: OpenAI.Responses.Response,
): Promise<void> {
  const metadata = response.metadata as ResponseMetadata | null
  const accion = metadata?.accion

  if (!accion) {
    console.warn('No se recibió metadata.accion para asignaturas')
    return
  }

  switch (accion) {
    case 'crear':
    case 'actualizar':
      await handleCrearAsignaturaResponse(response)
      return
    default:
      console.warn('Acción no reconocida para asignaturas:', accion)
      return
  }
}

export async function handleAsignaturasUnsuccesfulResponse(
  response: OpenAI.Responses.Response,
): Promise<void> {
  await marcarAsignaturaFallidaPorWebhook(response)
}
