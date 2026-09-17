/** Configure a local-only Android preview; never copies a service-role key into the APK. */
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import { androidSdkPath } from './android-toolchain'

const root = resolve(import.meta.dir, '..')
const result = Bun.spawnSync(['bunx', 'supabase', 'status', '-o', 'json'], {
  cwd: root,
  stdout: 'pipe',
  stderr: 'pipe',
})
if (result.exitCode !== 0)
  throw new Error(
    'Inicia Supabase local antes de configurar Android: bunx supabase start',
  )
const status = JSON.parse(result.stdout.toString()) as {
  API_URL: string
  ANON_KEY: string
}
const url = new URL(status.API_URL)
if (!['127.0.0.1', 'localhost'].includes(url.hostname))
  throw new Error('La configuración exige Supabase local.')
if (!status.ANON_KEY)
  throw new Error('Supabase local no devolvió la clave pública anónima.')
const sdk = androidSdkPath()
await mkdir(resolve(root, 'android'), { recursive: true })
await Bun.write(
  resolve(root, 'android/local.properties'),
  `sdk.dir=${sdk.replaceAll('\\', '/').replaceAll(':', '\\:')}\n`,
)
await Bun.write(
  resolve(root, 'android/preview.properties'),
  `supabase.url=http://10.0.2.2:${url.port || '54321'}\nsupabase.anonKey=${status.ANON_KEY}\n`,
)
console.log(
  `Android configurado para Supabase local en 10.0.2.2:${url.port}. Clave pública guardada en archivo ignorado por Git.`,
)
