import { requireData, throwIfError } from '@/data/api/_helpers'
import { supabaseBrowser } from '@/data/supabase/client'

export type ProgresoGuia = {
  ultimoPaso: number
  completada: boolean
  descartada: boolean
}

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>
}

export async function obtener_progreso_guia(
  clave: string,
  version: number,
): Promise<ProgresoGuia> {
  const { data, error } = await (supabaseBrowser() as unknown as RpcClient).rpc(
    'obtener_progreso_guia',
    {
      p_guia_clave: clave,
      p_guia_version: version,
    },
  )
  throwIfError(error as never)
  return requireData(data as ProgresoGuia | null, 'No se encontró la guía.')
}

export async function guardar_progreso_guia(input: {
  clave: string
  version: number
  ultimoPaso: number
  completada: boolean
  descartada: boolean
}) {
  const { error } = await (supabaseBrowser() as unknown as RpcClient).rpc(
    'guardar_progreso_guia',
    {
      p_guia_clave: input.clave,
      p_guia_version: input.version,
      p_ultimo_paso: input.ultimoPaso,
      p_completada: input.completada,
      p_descartada: input.descartada,
    },
  )
  throwIfError(error as never)
}
