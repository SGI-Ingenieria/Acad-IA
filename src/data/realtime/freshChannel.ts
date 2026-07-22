import type {
  RealtimeChannelOptions,
  SupabaseClient,
} from '@supabase/supabase-js'

/**
 * Devuelve un canal Realtime nuevo y sin suscribir para `name`.
 *
 * `supabase.channel(name)` reutiliza el canal existente cuando ya hay uno con
 * el mismo topic (realtime-js v2.110, `RealtimeClient.channel`). Si ese canal
 * ya está suscrito, volver a registrar `.on('postgres_changes', ...)` lanza
 * «cannot add postgres_changes callbacks after subscribe()». Esto ocurre al
 * remontar rápido un efecto (StrictMode o cambio de id) antes de que la baja
 * asíncrona del canal previo termine, o con dos consumidores del mismo topic.
 *
 * Al eliminar cualquier canal previo con ese topic garantizamos que
 * `.channel()` cree una instancia limpia sobre la que sí se pueden registrar
 * callbacks antes de `subscribe()`.
 */
export function freshChannel(
  supabase: SupabaseClient,
  name: string,
  opts?: RealtimeChannelOptions,
) {
  const existing = supabase
    .getChannels()
    .find((channel) => channel.topic === `realtime:${name}`)
  if (existing) supabase.removeChannel(existing)
  return opts ? supabase.channel(name, opts) : supabase.channel(name)
}
