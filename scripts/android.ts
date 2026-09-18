/** Bun entry point for the native toolchain. No hosted backend or production release is touched. */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

import {
  androidSdkPath,
  emulatorArguments,
  requirePreviewTools,
} from './android-toolchain'

const root = resolve(import.meta.dir, '..')
const windows = process.platform === 'win32'
const sdk = androidSdkPath()
const command = process.argv[2] || 'build'
if (command === 'preview' || command === 'ui') requirePreviewTools(sdk)
const bundledJava = windows
  ? 'C:/Program Files/Android/Android Studio/jbr'
  : '/Applications/Android Studio.app/Contents/jbr/Contents/Home'
const javaHome = [
  process.env.ANDROID_JAVA_HOME,
  bundledJava,
  process.env.JAVA_HOME,
].find(
  (candidate) =>
    candidate &&
    existsSync(join(candidate, 'bin', windows ? 'javac.exe' : 'javac')),
)
if (!javaHome)
  throw new Error('Define JAVA_HOME al JDK incluido en Android Studio.')
const env: Record<string, string | undefined> = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: sdk,
}
const adb = join(sdk, 'platform-tools', windows ? 'adb.exe' : 'adb')

async function run(args: Array<string>, capture = false): Promise<string> {
  const child = Bun.spawn(args, {
    cwd: root,
    env,
    stdout: capture ? 'pipe' : 'inherit',
    stderr: 'inherit',
  })
  const output = capture
    ? await new Response(child.stdout as ReadableStream).text()
    : ''
  if ((await child.exited) !== 0) throw new Error(`Falló ${args[0]}`)
  return output
}
async function gradle(...tasks: Array<string>) {
  const wrapper = join(root, 'android', windows ? 'gradlew.bat' : 'gradlew')
  await run([
    ...(windows ? ['cmd.exe', '/d', '/c', wrapper] : [wrapper]),
    '-p',
    join(root, 'android'),
    ...tasks,
    '--console=plain',
  ])
}
async function emulator() {
  let devices = await run([adb, 'devices'], true)
  if (!/\tdevice\r?$/m.test(devices)) {
    const executable = join(
      sdk,
      'emulator',
      windows ? 'emulator.exe' : 'emulator',
    )
    const avd = process.env.ANDROID_AVD || 'Acad_IA_API_37_2'
    const available = await run([executable, '-list-avds'], true)
    if (!available.split(/\r?\n/).includes(avd))
      throw new Error(
        `Falta ${avd}. Ejecuta bun run android:instalar o define ANDROID_AVD.`,
      )
    spawn(executable, emulatorArguments(avd), {
      env,
      stdio: 'ignore',
      detached: true,
      windowsHide: false, // The emulator is the interactive preview, not a hidden helper.
    }).unref()
    console.log(`Iniciando ${avd}…`)
    for (let attempt = 0; attempt < 60; attempt++) {
      await Bun.sleep(2000)
      devices = await run([adb, 'devices'], true)
      if (/\tdevice\r?$/m.test(devices)) break
    }
  }
  const ids = devices
    .split(/\r?\n/)
    .filter((line) => /\tdevice$/.test(line))
    .map((line) => line.split('\t')[0])
  const selected =
    process.env.ANDROID_SERIAL || (ids.length === 1 ? ids[0] : undefined)
  if (!selected || !ids.includes(selected))
    throw new Error(
      'Selecciona un dispositivo autorizado con ANDROID_SERIAL (consulta adb devices).',
    )
  env.ANDROID_SERIAL = selected
  for (let attempt = 0; attempt < 60; attempt++) {
    if (
      (
        await run([adb, 'shell', 'getprop', 'sys.boot_completed'], true)
      ).trim() === '1'
    )
      return
    await Bun.sleep(2000)
  }
  throw new Error('El emulador no terminó de iniciar. Revisa Device Manager.')
}

if (command === 'build') await gradle(':app:assembleDebug')
else if (command === 'check')
  await gradle(':app:testDebugUnitTest', ':app:lintDebug')
else if (command === 'preview' || command === 'ui') {
  await emulator()
  const virtual =
    (await run([adb, 'shell', 'getprop', 'ro.kernel.qemu'], true)).trim() ===
    '1'
  env.ANDROID_LOCAL_HOST = virtual ? '10.0.2.2' : '127.0.0.1'
  await run(['bun', 'run', 'scripts/android-local.ts'])
  if (!virtual) {
    const properties = await Bun.file(
      join(root, 'android/preview.properties'),
    ).text()
    const endpoint = properties.match(/^supabase.url=(.+)$/m)?.[1]
    if (!endpoint) throw new Error('Falta la URL del preview local.')
    const port = new URL(endpoint.trim()).port
    await run([adb, 'reverse', `tcp:${port}`, `tcp:${port}`])
  }
  await gradle(
    ':app:assembleDebug',
    ...(command === 'ui' ? [':app:assembleDebugAndroidTest'] : []),
  )
  await run([
    adb,
    'install',
    '-r',
    join(root, 'android/app/build/outputs/apk/debug/app-debug.apk'),
  ])
  if (command === 'ui') {
    const email = process.env.ANDROID_TEST_EMAIL
    const password = process.env.ANDROID_TEST_PASSWORD
    if (!email || !password)
      throw new Error(
        'Define ANDROID_TEST_EMAIL y ANDROID_TEST_PASSWORD para una cuenta local.',
      )
    await run([
      adb,
      'install',
      '-r',
      join(
        root,
        'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
      ),
    ])
    const status = JSON.parse(
      await run(['bunx', 'supabase', 'status', '-o', 'json'], true),
    )
    if (!['127.0.0.1', 'localhost'].includes(new URL(status.API_URL).hostname))
      throw new Error('Las pruebas exigen Supabase local.')
    let token = status.ANON_KEY
    async function api(
      path: string,
      body?: unknown,
      method = body ? 'POST' : 'GET',
    ) {
      const response = await fetch(`${status.API_URL}/${path}`, {
        method,
        headers: {
          apikey: status.ANON_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000),
      })
      if (!response.ok)
        throw new Error(`Fixture local: HTTP ${response.status}`)
      return response.json()
    }
    const session = await api('auth/v1/token?grant_type=password', {
      email,
      password,
    })
    token = session.access_token
    const [plan] = await api(
      'rest/v1/planes_estudio?select=id,estructura_id&limit=1',
    )
    const [structure] = await api(
      `rest/v1/estructuras_asignatura?estructura_plan_id=eq.${plan.estructura_id}&select=id&limit=1`,
    )
    const subjectId = crypto.randomUUID()
    const createdPlanId = crypto.randomUUID()
    try {
      await api('rest/v1/asignaturas', {
        id: subjectId,
        plan_estudio_id: plan.id,
        estructura_id: structure.id,
        nombre: `Preview Android QA ${subjectId.slice(0, 8)}`,
        codigo: `QA-${subjectId.slice(0, 8)}`,
        numero_ciclo: 1,
        creado_por: session.user.id,
      })
      const output = await run(
        [
          adb,
          'shell',
          'am',
          'instrument',
          '-w',
          '-e',
          'previewEmail',
          email,
          '-e',
          'previewPassword',
          password,
          '-e',
          'previewSubjectId',
          subjectId,
          '-e',
          'previewCreatedPlanId',
          createdPlanId,
          'mx.sgi.acadia.preview.test/androidx.test.runner.AndroidJUnitRunner',
        ],
        true,
      )
      console.log(output)
      if (!/OK \(\d+ tests?\)/.test(output))
        throw new Error('Falló la prueba instrumentada.')
    } finally {
      await api(`rest/v1/asignaturas?id=eq.${subjectId}`, undefined, 'DELETE')
      await api(
        `rest/v1/planes_estudio?id=eq.${createdPlanId}`,
        undefined,
        'DELETE',
      )
      console.log(
        'Fixture Android eliminada; los registros previos no se modificaron.',
      )
    }
  }
  await run([
    adb,
    'shell',
    'am',
    'start',
    '-n',
    'mx.sgi.acadia.preview/mx.sgi.acadia.MainActivity',
  ])
} else throw new Error(`Comando Android desconocido: ${command}`)
