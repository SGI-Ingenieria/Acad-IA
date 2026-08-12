import { expect, test } from '@playwright/test'

import { prepareTheme, settlePage } from './helpers'

test.use({ storageState: { cookies: [], origins: [] } })

test('autenticación conserva una jerarquía estable', async ({
  page,
}, testInfo) => {
  await prepareTheme(page, testInfo)
  await page.goto('/login')
  await settlePage(page)

  await expect(
    page.getByRole('button', { name: 'Iniciar sesión' }),
  ).toBeVisible()
  await expect(page).toHaveScreenshot('autenticacion.png', { fullPage: true })
})
