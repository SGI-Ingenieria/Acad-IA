import { supabaseBrowser } from '../supabase/client'
import { invokeEdge } from '../supabase/invokeEdge'

import { requireData, throwIfError } from './_helpers'

import type { Database, Enums, Tables } from '@/types/supabase'

export type ImportacionAcademica = Tables<'importaciones_academicas'>
export type ImportacionArchivo = Tables<'importacion_archivos'>
export type TipoImportacionAcademica = Enums<'tipo_importacion_academica'>
export type RolArchivoImportacion = Enums<'rol_archivo_importacion'>

export type ArchivoImportacionDetalle = ImportacionArchivo & {
  file_versions:
    | (Pick<
        Tables<'file_versions'>,
        'id' | 'file_id' | 'original_filename' | 'version_number'
      > & {
        files: Pick<Tables<'files'>, 'id' | 'display_name' | 'status'> | null
      })
    | null
}

export type ImportacionAcademicaDetalle = ImportacionAcademica & {
  importacion_archivos: Array<ArchivoImportacionDetalle>
}

export type ResultadoAplicacionImportacion = {
  importacion_id: string
  antecedente_plan_id: string
  version_trabajo_plan_id: string
}

export type ResultadoImportacionProgramas = {
  importacion_id: string
  asignatura_ids: Array<string>
}

export type LinajePlanItem =
  Database['public']['Functions']['obtener_linaje_plan']['Returns'][number]

export async function importaciones_crear(input: {
  tipo: TipoImportacionAcademica
  carreraId?: string | null
  estructuraDestinoId?: string | null
  planDestinoId?: string | null
}): Promise<ImportacionAcademica> {
  const { data, error } = await supabaseBrowser().rpc(
    'crear_importacion_academica',
    {
      p_tipo: input.tipo,
      // PostgREST necesita el cuarto argumento explícito para distinguir esta
      // versión de la RPC de la firma histórica de tres argumentos. Los IDs
      // opcionales vacíos deben viajar como null, nunca como cadena vacía.
      p_carrera_id: input.carreraId || null,
      p_estructura_destino_id: input.estructuraDestinoId || null,
      p_plan_destino_id: input.planDestinoId || null,
    },
  )
  throwIfError(error)
  return requireData(data, 'No se pudo iniciar la importación.')
}

export async function importaciones_obtener(
  importacionId: string,
): Promise<ImportacionAcademicaDetalle> {
  const { data, error } = await supabaseBrowser()
    .from('importaciones_academicas')
    .select(
      `
        *,
        importacion_archivos(
          *,
          file_versions(
            id,
            file_id,
            original_filename,
            version_number,
            files!file_versions_file_id_fkey(id,display_name,status)
          )
        )
      `,
    )
    .eq('id', importacionId)
    .single()
  throwIfError(error)
  return requireData(data, 'No se encontró la importación.')
}

export async function importaciones_vincular_archivo(input: {
  importacionId: string
  fileId: string
  rol: RolArchivoImportacion
}): Promise<ImportacionArchivo> {
  const { data, error } = await supabaseBrowser().rpc(
    'vincular_archivo_importacion',
    {
      p_importacion_id: input.importacionId,
      p_file_id: input.fileId,
      p_rol: input.rol,
    },
  )
  throwIfError(error)
  return requireData(data, 'No se pudo vincular el archivo.')
}

export async function importaciones_actualizar_rol(input: {
  importacionArchivoId: string
  rol: RolArchivoImportacion
}): Promise<ImportacionArchivo> {
  const { data, error } = await supabaseBrowser().rpc(
    'actualizar_rol_archivo_importacion',
    {
      p_importacion_archivo_id: input.importacionArchivoId,
      p_rol: input.rol,
    },
  )
  throwIfError(error)
  return requireData(data, 'No se pudo reclasificar el archivo.')
}

export async function importaciones_analizar(
  importacionId: string,
): Promise<ImportacionAcademicaDetalle> {
  const result = await invokeEdge<{ data: ImportacionAcademicaDetalle }>(
    'academic-import-analyze',
    { importacionId },
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
  )
  return result.data
}

export async function importaciones_aplicar(
  importacionId: string,
): Promise<ResultadoAplicacionImportacion> {
  const { data, error } = await supabaseBrowser().rpc(
    'aplicar_importacion_expediente',
    { p_importacion_id: importacionId },
  )
  throwIfError(error)
  const result = requireData(
    data,
    'No se pudo aplicar la importación.',
  ) as Omit<ResultadoAplicacionImportacion, 'importacion_id'>
  return { ...result, importacion_id: importacionId }
}

export async function importaciones_aplicar_programas(input: {
  importacionId: string
  idsExternos: Array<string>
}): Promise<ResultadoImportacionProgramas> {
  const { data, error } = await supabaseBrowser().rpc(
    'aplicar_importacion_programas',
    {
      p_importacion_id: input.importacionId,
      p_ids_externos: input.idsExternos,
    },
  )
  throwIfError(error)
  const result = requireData(
    data,
    'No se pudieron importar los programas.',
  ) as Omit<ResultadoImportacionProgramas, 'importacion_id'>
  return { ...result, importacion_id: input.importacionId }
}

export async function importaciones_cancelar(
  importacionId: string,
): Promise<ImportacionAcademica> {
  const { data, error } = await supabaseBrowser().rpc(
    'cancelar_importacion_academica',
    { p_importacion_id: importacionId },
  )
  throwIfError(error)
  return requireData(data, 'No se pudo cancelar la importación.')
}

export async function planes_obtener_linaje(
  planId: string,
): Promise<Array<LinajePlanItem>> {
  const { data, error } = await supabaseBrowser().rpc('obtener_linaje_plan', {
    p_plan_id: planId,
  })
  throwIfError(error)
  return data ?? []
}

export async function planes_obtener_antecedente_raiz(
  planId: string,
): Promise<string | null> {
  const { data, error } = await supabaseBrowser().rpc(
    'obtener_plan_antecedente_raiz',
    { p_plan_id: planId },
  )
  throwIfError(error)
  return data
}
