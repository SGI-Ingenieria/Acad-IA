import { expect, test } from '@playwright/test'

import { prepareAuthenticatedPage, prepareTheme } from './helpers'

import type { CatalogoAsignaturaRow } from '@/data/types/domain'

const PLAN_ID = '11111111-1111-4111-8111-111111111111'
const ASIGNATURA_ID = '22222222-2222-4222-8222-000000000001'

test('reintenta desde el catálogo sin navegar y conserva la acción ante un rechazo', async ({
  page,
}, testInfo) => {
  await prepareAuthenticatedPage(page)
  await prepareTheme(page, testInfo)
  await page.route(
    '**/rest/v1/rpc/catalogo_asignaturas_buscar',
    async (route) => {
      const response = await route.fetch()
      const rows = (await response.json()) as Array<CatalogoAsignaturaRow>
      await route.fulfill({
        response,
        json: rows.map((row) => ({
          ...row,
          estado: row.asignatura_id === ASIGNATURA_ID ? 'fallida' : row.estado,
        })),
      })
    },
  )
  const solicitudes: Array<unknown> = []
  let liberar: () => void = () => {}
  const espera = new Promise<void>((resolve) => {
    liberar = resolve
  })
  await page.route('**/functions/v1/ai-generate-subject', async (route) => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
    }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 200, headers })
      return
    }
    solicitudes.push(route.request().postDataJSON())
    await espera
    await route.fulfill({
      status: 403,
      headers,
      json: {
        error: {
          code: 'AI_RETRY_FORBIDDEN',
          message:
            'No tienes permiso para reintentar la generación en este plan.',
        },
      },
    })
  })

  await page.goto(`/asignaturas?q=Matemáticas&plan=${PLAN_ID}`)
  const boton = page.getByRole('button', {
    name: 'Reintentar generación de Matemáticas para ingeniería',
  })
  await expect(boton).toBeVisible({ timeout: 20_000 })
  const captura = testInfo.outputPath('reintentar-asignatura.png')
  await page.screenshot({ path: captura, fullPage: true })
  await testInfo.attach('Reintentar en catálogo', {
    path: captura,
    contentType: 'image/png',
  })
  await boton.focus()
  await boton.press('Enter')
  await expect(boton).toBeDisabled()
  await expect(boton).toHaveText('Reintentando…')
  await expect.poll(() => solicitudes.length).toBe(1)
  expect(solicitudes[0]).toEqual({ reintentarAsignaturaId: ASIGNATURA_ID })
  await expect(page).toHaveURL(/\/asignaturas\?/)
  liberar()
  await expect(
    page.getByText(
      'No tienes permiso para reintentar la generación en este plan.',
      { exact: true },
    ),
  ).toBeVisible()
  await expect(boton).toBeEnabled()
  await expect(boton).toHaveText('Reintentar')
  await expect(page).toHaveURL(/\/asignaturas\?/)
})
