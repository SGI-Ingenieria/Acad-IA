// document.api.ts

import { invokeEdge } from '../supabase/invokeEdge'

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
  // El armado de `data` ahora vive en la edge function (carbone-io-wrapper),
  // que lee la asignatura desde la BD y siempre inyecta contenido temático,
  // evaluación, bibliografía y nivel. Aquí solo disparamos la generación.
  return await invokeEdge<Blob>(
    EDGE.carbone_io_wrapper,
    {
      action: 'downloadReport',
      asignatura_id,
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

export type FieldMeta = {
  key: string
  title: string
  isAlways: boolean
  isRichtext: boolean
}

type PreviewPayloadSuccess = {
  success: true
  data: unknown
  fields: Array<FieldMeta>
}
type PreviewPayloadFailure = { success: false; error: string }
type PreviewPayloadResponse = PreviewPayloadSuccess | PreviewPayloadFailure

export async function fetchPreviewPayload(
  params: { plan_estudio_id: string } | { asignatura_id: string },
): Promise<{ data: unknown; fields: Array<FieldMeta> }> {
  const result = await invokeEdge<PreviewPayloadResponse>(
    EDGE.carbone_io_wrapper,
    { action: 'previewPayload', ...params },
    { headers: { 'Content-Type': 'application/json' } },
  )
  if (!result.success) throw new Error(result.error)
  const { data, fields } = result
  return { data, fields }
}

type DownloadTemplateResponse = {
  base64: string
  contentType: string
  filename: string | null
}

export async function fetchPlantillaDocx(templateId: string): Promise<Blob> {
  const result = await invokeEdge<DownloadTemplateResponse>(
    EDGE.carbone_io_wrapper,
    { action: 'downloadTemplate', templateId },
    { headers: { 'Content-Type': 'application/json' } },
  )
  const raw = atob(result.base64)
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: result.contentType })
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
