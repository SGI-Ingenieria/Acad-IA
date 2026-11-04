/** Local, authenticated cross-client Realtime contract. Never uses service-role. */
import { createClient } from '@supabase/supabase-js'

const status = Bun.spawnSync(['bunx', 'supabase', 'status', '-o', 'json'], {
  stdout: 'pipe',
  stderr: 'pipe',
})
if (status.exitCode) throw new Error('Inicia Supabase local.')
const { API_URL: url, ANON_KEY: key } = JSON.parse(status.stdout.toString())
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error('Solo Supabase local.')
const email = process.env.ANDROID_TEST_EMAIL
const password = process.env.ANDROID_TEST_PASSWORD
if (!email || !password)
  throw new Error('Define ANDROID_TEST_EMAIL y ANDROID_TEST_PASSWORD.')
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const session = await client.auth.signInWithPassword({ email, password })
if (session.error) throw session.error
const plan = await client
  .from('planes_estudio')
  .select('id,estructura_id')
  .limit(1)
  .single()
if (plan.error) throw plan.error
const structure = await client
  .from('estructuras_asignatura')
  .select('id')
  .eq('estructura_plan_id', plan.data.estructura_id)
  .limit(1)
  .single()
if (structure.error) throw structure.error
const id = crypto.randomUUID()
const commentId = crypto.randomUUID()
const channel = client.channel(`android-qa-${id}`)
const received = Promise.withResolvers<void>()
try {
  const inserted = await client.from('asignaturas').insert({
    id,
    plan_estudio_id: plan.data.id,
    estructura_id: structure.data.id,
    nombre: `Realtime QA ${id}`,
    creado_por: session.data.user.id,
  })
  if (inserted.error) throw inserted.error
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Realtime no confirmó la suscripción.')),
      15000,
    )
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comentarios_asignatura' },
        (event) => {
          if ('id' in event.new && event.new.id === commentId)
            received.resolve()
        },
      )
      .on('system', {}, (event) => {
        console.log('Postgres Changes:', event.status, event.message)
      })
      .subscribe((state, error) => {
        if (state === 'SUBSCRIBED') {
          clearTimeout(timer)
          resolve()
        }
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          clearTimeout(timer)
          reject(error ?? new Error(state))
        }
      })
  })
  const comment = await client.from('comentarios_asignatura').insert({
    id: commentId,
    asignatura_id: id,
    autor_id: session.data.user.id,
    cuerpo: 'Verificación Realtime aislada',
  })
  if (comment.error) throw comment.error
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('No llegó el INSERT por Realtime.')),
      10000,
    )
    void received.promise.then(() => {
      clearTimeout(timer)
      resolve()
    })
  })
  console.log(
    'PASS: comentario recibido por WebSocket autenticado, sin invalidación local.',
  )
} finally {
  await client.removeChannel(channel)
  const deleted = await client.from('asignaturas').delete().eq('id', id)
  if (deleted.error) {
    console.error(`No se pudo limpiar la asignatura de prueba ${id}.`)
    process.exitCode = 1
  }
  await client.auth.signOut({ scope: 'local' })
  client.realtime.disconnect()
}
process.exit(process.exitCode ?? 0)
