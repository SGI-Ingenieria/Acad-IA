import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function androidSdkPath(
  env: NodeJS.ProcessEnv = process.env,
  platform = process.platform,
): string {
  return (
    env.ANDROID_HOME ||
    env.ANDROID_SDK_ROOT ||
    (platform === 'win32'
      ? join(
          env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
          'Android',
          'Sdk',
        )
      : platform === 'darwin'
        ? join(homedir(), 'Library', 'Android', 'sdk')
        : join(homedir(), 'Android', 'Sdk'))
  )
}

export function requirePreviewTools(
  sdk: string,
  windows = process.platform === 'win32',
  exists: (path: string) => boolean = existsSync,
) {
  const missing = [
    join(sdk, 'platform-tools', windows ? 'adb.exe' : 'adb'),
    join(sdk, 'emulator', windows ? 'emulator.exe' : 'emulator'),
  ].filter((path) => !exists(path))
  if (missing.length)
    throw new Error(
      `SDK Android incompleto en esta terminal. Faltan:\n${missing.join('\n')}\n` +
        (windows
          ? 'Ejecuta bun run android:instalar y después bun run android:preview.'
          : 'Instala Android SDK Platform-Tools y Android Emulator en el SDK configurado.'),
    )
}
