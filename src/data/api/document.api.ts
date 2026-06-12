// document.api.ts

import { supabaseBrowser } from '../supabase/client'
import { invokeEdge } from '../supabase/invokeEdge'

import { requireData, throwIfError } from './_helpers'

import type { Tables } from '@/types/supabase'

const EDGE = {
  carbone_io_wrapper: 'carbone-io-wrapper',
} as const

interface GenerateExcelParams {
  plan_estudio_id: string
  convertTo?: 'pdf' | 'xlsx'
}
interface GeneratePdfParams {
  plan_estudio_id: string
  convertTo?: 'pdf'
}
interface GeneratePdfParamsAsignatura {
  asignatura_id: string
  convertTo?: 'pdf'
}

export async function fetchPlanPdf({
  plan_estudio_id,
  convertTo,
}: GeneratePdfParams): Promise<Blob> {
  return await invokeEdge<Blob>(
    EDGE.carbone_io_wrapper,
    {
      action: 'downloadReport',
      plan_estudio_id,
      body: convertTo ? { convertTo } : {},
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
      responseType: 'blob',
    },
  )
}

export async function fetchAsignaturaPdf({
  asignatura_id,
  convertTo,
}: GeneratePdfParamsAsignatura): Promise<Blob> {
  const supabase = supabaseBrowser()

  const { data, error } = await supabase
    .from('asignaturas')
    .select('*')
    .eq('id', asignatura_id)
    .single()

  throwIfError(error)

  const row = requireData(
    data as Pick<
      Tables<'asignaturas'>,
      'datos' | 'contenido_tematico' | 'criterios_de_evaluacion'
    >,
    'Asignatura no encontrada',
  )

  const body: Record<string, unknown> = {
    data: row,
  }
  if (convertTo) body.convertTo = convertTo

  return await invokeEdge<Blob>(
    EDGE.carbone_io_wrapper,
    {
      action: 'downloadReport',
      asignatura_id,
      body: {
        ...body,
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
      responseType: 'blob',
    },
  )
}

export async function fetchPlanExcel({
  plan_estudio_id,
  convertTo,
}: GenerateExcelParams): Promise<Blob> {
  return await invokeEdge<Blob>(
    EDGE.carbone_io_wrapper,
    {
      action: 'downloadReport',
      plan_estudio_id,
      body: convertTo ? { convertTo } : {},
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
      responseType: 'blob',
    },
  )
}
