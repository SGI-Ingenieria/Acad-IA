import { expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

import { VISUAL_TEST_EMAIL, VISUAL_TEST_PASSWORD } from './credentials'

import type { Page, TestInfo } from '@playwright/test'

type VisualSessionPayload = {
  storageKey: string
  session: unknown
}

let visualSession: Promise<VisualSessionPayload> | undefined

async function createVisualSession(): Promise<VisualSessionPayload> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Falta la configuración de autenticación visual.')
  }

  const auth = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const signedIn = await auth.auth.signInWithPassword({
    email: VISUAL_TEST_EMAIL,
    password: VISUAL_TEST_PASSWORD,
  })
  if (signedIn.error) throw signedIn.error

  return {
    storageKey: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`,
    session: signedIn.data.session,
  }
}

export async function prepareAuthenticatedPage(page: Page) {
  visualSession ??= createVisualSession()
  const payload = await visualSession

  await page.addInitScript(({ storageKey, session }) => {
    window.localStorage.setItem(storageKey, JSON.stringify(session))
  }, payload)
}

export async function prepareTheme(page: Page, testInfo: TestInfo) {
  const theme = testInfo.project.name.endsWith('dark') ? 'dark' : 'light'
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem('acad-ia-theme', selectedTheme)
    document.documentElement.classList.toggle('dark', selectedTheme === 'dark')
  }, theme)
}

export async function settlePage(page: Page) {
  await expect(page.locator('body')).toBeVisible()
  await page.evaluate(async () => document.fonts.ready)
  await page
    .waitForLoadState('networkidle', { timeout: 10_000 })
    .catch(() => {})
  await page.waitForTimeout(250)
}
