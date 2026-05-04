import { supabase } from '../supabase.ts'

import { handleCrearPlanEstudio } from './crear.ts'

import type { Json } from '../../_shared/database.types.ts'
import type { ResponseMetadata } from '../../_shared/utils.ts'
import type { OpenAI } from 'openai'

type EstadoPlanDef = {
  clave: 'BORRADOR' | 'REVISION' | 'APROBADO' | 'GENERANDO' | 'FALLIDO'
  etiqueta: string
  orden: number
  es_final: boolean
  color: string
}

const ESTADOS_DEF: Record<EstadoPlanDef['clave'], EstadoPlanDef> = {
  BORRADOR: {
    clave: 'BORRADOR',
    etiqueta: 'Borrador',
    orden: 10,
    es_final: false,
    color: '#cccccc',
  },
  REVISION: {
    clave: 'REVISION',
    etiqueta: 'En revisión',
    orden: 30,
    es_final: false,
    color: '#ffcc00',
  },
  APROBADO: {
    clave: 'APROBADO',
    etiqueta: 'Aprobado',
    orden: 40,
    es_final: true,
    color: '#00cc66',
  },
  GENERANDO: {
    clave: 'GENERANDO',
    etiqueta: 'Generando',
    orden: 0,
    es_final: false,
    color: '#ff6600',
  },
  FALLIDO: {
    clave: 'FALLIDO',
    etiqueta: 'Fallido',
    orden: 20,
    es_final: true,
    color: '#ef4444',
  },
}

export async function getEstadoId(
  clave: EstadoPlanDef['clave'],
): Promise<string | null> {
  const { data, error } = await supabase
    .from('estados_plan')
    .select('id, clave')
    .eq('clave', clave)
    .maybeSingle()

  if (!error && data?.id) return String(data.id)

  // Crear estado si no existe, usando definiciones por defecto
  const def = ESTADOS_DEF[clave]

  const { data: inserted, error: insErr } = await supabase
    .from('estados_plan')
    .insert({
      clave: def.clave,
      etiqueta: def.etiqueta,
      orden: def.orden,
      es_final: def.es_final,
      color: def.color,
    })
    .select('id')
    .single()

  if (insErr) {
    console.warn('No se pudo crear estado:', clave, insErr)
    return null
  }
  return String(inserted.id)
}

export async function marcarFallido(
  planId: string,
  mensajeError: string = 'La generación del plan falló. Intenta más tarde o revisa los archivos adjuntos.',
): Promise<void> {
  const fallId = await getEstadoId('FALLIDO')
  if (!fallId) {
    console.warn('No se pudo obtener/crear estado FALLIDO', { planId })
    return
  }

  // obtener meta_origen actual para hacer merge
  const { data: planRow, error: getErr } = await supabase
    .from('planes_estudio')
    .select('meta_origen')
    .eq('id', planId)
    .maybeSingle()
  if (getErr) {
    console.warn('No se pudo obtener meta_origen actual', { planId, getErr })
  }

  const currentMeta = (planRow?.meta_origen ?? {}) as Record<string, unknown>
  const nextMetaObj = { ...currentMeta, error: mensajeError } as Record<
    string,
    unknown
  >
  const nextMeta: Json = nextMetaObj as unknown as Json

  const { error: updErr } = await supabase
    .from('planes_estudio')
    .update({ meta_origen: nextMeta, estado_actual_id: fallId })
    .eq('id', planId)

  if (updErr) {
    console.warn('No se pudo marcar plan como FALLIDO', { planId, updErr })
  }
}

export async function handlePlanesEstudioResponse(
  response: OpenAI.Responses.Response,
): Promise<void> {
  const metadata = response.metadata as ResponseMetadata | null
  if (!metadata || !metadata.accion) {
    console.warn('No se recibió acción en la metadata')
    return
  }

  switch (metadata.accion) {
    case 'crear':
      await handleCrearPlanEstudio(response)
      return
    case 'actualizar':
      // Lógica para actualizar un plan de estudio
      return
    case 'eliminar':
      // Lógica para eliminar un plan de estudio
      return
    default:
      console.warn('Acción no reconocida:', metadata.accion)
  }
}

export async function handlePlanesEstudioUnsuccesfulResponse(
  response: OpenAI.Responses.Response,
): Promise<void> {
  const metadata = response.metadata as ResponseMetadata | null
  if (!metadata || !metadata.accion) {
    console.warn('No se recibió acción en metadata para UNSUCCESSFUL')
    return
  }

  switch (metadata.accion) {
    case 'crear': {
      const planId = metadata.id
      if (!planId) {
        console.warn('No se recibió id en metadata para marcar FALLIDO')
        return
      }
      await marcarFallido(planId)
      return
    }
    case 'actualizar':
    case 'eliminar':
    default:
      // No-op para otros casos de momento
      return
  }
}
