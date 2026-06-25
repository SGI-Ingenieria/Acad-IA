import { invokeEdge } from '../supabase/invokeEdge'

const EDGE = 'carbone-io-wrapper'

/** Tipo de plantilla: Word (.docx) o Excel (.xlsx). */
export type PlantillaKind = 'word' | 'excel'

/**
 * Categoría de Carbone usada para listar/subir plantillas. Las plantillas Word
 * se guardan bajo la categoría = estructuraId (comportamiento histórico). Las
 * Excel usan un namespace propio para que ambos listados no se mezclen, ya que
 * Carbone filtra por categoría exacta.
 */
export function plantillaCategory(
  estructuraId: string,
  kind: PlantillaKind = 'word',
): string {
  return kind === 'excel' ? `${estructuraId}::xlsx` : estructuraId
}

export type CarboneTemplate = {
  id: string
  versionId: string
  deployedAt: number
  createdAt: number
  expireAt?: number
  size: number
  type: string
  name?: string
  category?: string
  comment?: string
  tags?: Array<string>
}

type CarboneResp<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function plantillas_list(
  category?: string,
): Promise<Array<CarboneTemplate>> {
  const result = await invokeEdge<CarboneResp<Array<CarboneTemplate>>>(EDGE, {
    action: 'listTemplates',
    ...(category ? { category } : {}),
  })
  if (!result.success) throw new Error((result as { error: string }).error)
  return result.data
}

export async function plantilla_upload(input: {
  file: File
  estructuraId: string
  kind?: PlantillaKind
  nombre?: string
  comentario?: string
  existingId?: string
}): Promise<{ id?: string; versionId?: string; templateId?: string }> {
  const buffer = await input.file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const base64 = btoa(binary)

  const result = await invokeEdge<
    CarboneResp<{ id?: string; versionId?: string; templateId?: string }>
  >(EDGE, {
    action: 'uploadTemplate',
    template: base64,
    filename: input.file.name,
    name: input.nombre ?? input.file.name,
    category: plantillaCategory(input.estructuraId, input.kind),
    comment: input.comentario,
    existingId: input.existingId,
  })
  if (!result.success) throw new Error((result as { error: string }).error)
  return result.data
}

export async function plantilla_delete(templateId: string): Promise<void> {
  await invokeEdge(EDGE, { action: 'deleteTemplate', templateId })
}
