import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'

import { androidSdkPath, requirePreviewTools } from './android-toolchain'

describe('Android console setup', () => {
  test('uses the explicitly configured SDK before the legacy variable', () => {
    expect(
      androidSdkPath({ ANDROID_HOME: 'chosen', ANDROID_SDK_ROOT: 'old' }),
    ).toBe('chosen')
    expect(androidSdkPath({ ANDROID_SDK_ROOT: 'legacy' })).toBe('legacy')
  })
  test('resolves the current Windows user SDK', () => {
    expect(androidSdkPath({ LOCALAPPDATA: 'local' }, 'win32')).toBe(
      join('local', 'Android', 'Sdk'),
    )
  })
  test('reports both missing executables with an actionable install command', () => {
    expect(() => requirePreviewTools('missing', true, () => false)).toThrow(
      'bun run android:instalar',
    )
    expect(() => requirePreviewTools('missing', true, () => false)).toThrow(
      'adb.exe',
    )
    expect(() => requirePreviewTools('missing', true, () => false)).toThrow(
      'emulator.exe',
    )
  })
  test('detects partially installed SDKs and accepts complete SDKs', () => {
    expect(() =>
      requirePreviewTools('partial', true, (path) => path.endsWith('adb.exe')),
    ).toThrow('emulator.exe')
    expect(() =>
      requirePreviewTools('complete', true, () => true),
    ).not.toThrow()
  })
})
