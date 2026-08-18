export {}

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
      return [[match[1], match[2].replace(/^['"]|['"]$/g, '')]]
    }),
)

const localApiUrl = localEnvironment.API_URL
const anonKey = localEnvironment.ANON_KEY
const serviceRoleKey = localEnvironment.SERVICE_ROLE_KEY
if (!localApiUrl || !anonKey || !serviceRoleKey) {
  console.error('No se pudo leer la configuración del Supabase local.')
  process.exit(1)
}

const parsedApiUrl = new URL(localApiUrl)
const containerHost = 'host.docker.internal'
const containerApiUrl = `${parsedApiUrl.protocol}//${containerHost}:${parsedApiUrl.port}`
const localAppUrl = 'http://127.0.0.1:3100'
const containerAppUrl = `http://${containerHost}:3100`
const cliArguments = Bun.argv.slice(2)
const compareOnly = cliArguments.includes('--compare')
const playwrightArguments = cliArguments.filter(
  (argument) => argument !== '--compare',
)

const vite = Bun.spawn({
  cmd: ['bunx', 'vite', '--host', '0.0.0.0', '--port', '3100'],
  cwd: process.cwd(),
  env: {
    ...process.env,
    ACADIA_DISABLE_DEVTOOLS: '1',
    ACADIA_VISUAL_DOCKER: '1',
    VITE_DISABLE_DEVTOOLS: '1',
    VITE_SUPABASE_URL: containerApiUrl,
    VITE_SUPABASE_ANON_KEY: anonKey,
  },
  stdout: 'inherit',
  stderr: 'inherit',
})

async function waitForVite() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(localAppUrl)
      if (response.ok) return
    } catch {
      // El servidor todavía está iniciando.
    }
    await Bun.sleep(250)
  }
  throw new Error('Vite no inició para generar las referencias de Linux.')
}

try {
  await waitForVite()
  const docker = Bun.spawn({
    cmd: [
      'docker',
      'run',
      '--rm',
      '--ipc=host',
      `--add-host=${containerHost}:host-gateway`,
      '-v',
      `${process.cwd()}:/work`,
      '-w',
      '/work',
      '-e',
      `PLAYWRIGHT_BASE_URL=${containerAppUrl}`,
      '-e',
      'PLAYWRIGHT_EXTERNAL_SERVER=1',
      '-e',
      'ACADIA_VISUAL_DOCKER=1',
      '-e',
      `VITE_SUPABASE_URL=${containerApiUrl}`,
      '-e',
      `VITE_SUPABASE_ANON_KEY=${anonKey}`,
      '-e',
      `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
      'mcr.microsoft.com/playwright:v1.62.1-noble',
      'node',
      'node_modules/@playwright/test/cli.js',
      'test',
      ...(compareOnly ? [] : ['--update-snapshots']),
      ...playwrightArguments,
    ],
    cwd: process.cwd(),
    stdout: 'inherit',
    stderr: 'inherit',
  })
  process.exitCode = await docker.exited
} finally {
  if (process.platform === 'win32') {
    Bun.spawnSync({
      cmd: ['taskkill', '/PID', String(vite.pid), '/T', '/F'],
      stdout: 'ignore',
      stderr: 'ignore',
    })
  } else {
    vite.kill()
    await vite.exited
  }
}
