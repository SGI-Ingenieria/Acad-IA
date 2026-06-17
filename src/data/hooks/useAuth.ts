import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { throwIfError } from '../api/_helpers'
import { qk } from '../query/keys'
import { supabaseBrowser } from '../supabase/client'

export function useSession() {
  const supabase = supabaseBrowser()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: qk.session(),
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession()
      throwIfError(error)
      return data.session ?? null
    },
    staleTime: Infinity,
  })

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      qc.invalidateQueries({ queryKey: qk.session() })
      qc.invalidateQueries({ queryKey: qk.meProfile() })
      qc.invalidateQueries({ queryKey: qk.auth })
    })

    return () => data.subscription.unsubscribe()
  }, [supabase, qc])

  return query
}

export function useMeProfile() {
  const supabase = supabaseBrowser()

  return useQuery({
    queryKey: qk.meProfile(),
    queryFn: async () => {
      const { data: u, error: uErr } = await supabase.auth.getUser()
      throwIfError(uErr)
      const userId = u.user?.id
      if (!userId) return null

      const { data, error } = await supabase
        .from('usuarios_app')
        .select('id,nombre_completo,clave,externo,creado_en,actualizado_en')
        .eq('id', userId)
        .single()

      // si aún no existe perfil en usuarios_app, permite null (tu seed/trigger puede crearlo)
      if (error && (error as any).code === 'PGRST116') return null

      throwIfError(error)
      return data ?? null
    },
    staleTime: 60_000,
  })
}
