export {}

type SupabaseTestEnvironment = {
  apiUrl: string
  anonKey: string
  serviceRoleKey: string
}

function resolveRemoteEnvironment(): SupabaseTestEnvironment | undefined {
  if (process.env.ACADIA_SUPABASE_REMOTE_TESTS !== '1') return undefined

  const apiUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!apiUrl || !anonKey || !serviceRoleKey) {
    console.error(
      'La branch Supabase remota no entrego todas las credenciales requeridas.',
    )
    process.exit(1)
  }

  return { apiUrl, anonKey, serviceRoleKey }
}

function resolveLocalEnvironment(): SupabaseTestEnvironment {
  const supabaseStatus = Bun.spawnSync({
    cmd: ['supabase', 'status', '-o', 'env'],
    stdout: 'pipe',
    stderr: 'pipe',
  })

  if (supabaseStatus.exitCode !== 0) {
    console.error('Supabase local debe estar activo para las pruebas visuales.')
    console.error(supabaseStatus.stderr.toString())
    process.exit(supabaseStatus.exitCode)
  }

  const localEnvironment = Object.fromEntries(
    supabaseStatus.stdout
      .toString()
      .split(/\r?\n/)
      .flatMap((line) => {
        const match = line.match(/^([A-Z_]+)=(.*)$/)
        if (!match) return []
        const value = match[2].replace(/^['"]|['"]$/g, '')
        return [[match[1], value]]
      }),
  )

  const apiUrl = localEnvironment.API_URL
  const anonKey = localEnvironment.ANON_KEY
  const serviceRoleKey = localEnvironment.SERVICE_ROLE_KEY

  if (!apiUrl || !anonKey || !serviceRoleKey) {
    console.error('No se pudieron leer las credenciales del Supabase local.')
    process.exit(1)
  }

  return { apiUrl, anonKey, serviceRoleKey }
}

const { apiUrl, anonKey, serviceRoleKey } =
  resolveRemoteEnvironment() ?? resolveLocalEnvironment()

const playwright = Bun.spawnSync({
  cmd: ['bunx', 'playwright', 'test', ...Bun.argv.slice(2)],
  cwd: process.cwd(),
  env: {
    ...process.env,
    ACADIA_DISABLE_DEVTOOLS: '1',
    VITE_DISABLE_DEVTOOLS: '1',
    VITE_SUPABASE_URL: apiUrl,
    VITE_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  },
  stdout: 'inherit',
  stderr: 'inherit',
})

process.exit(playwright.exitCode)
