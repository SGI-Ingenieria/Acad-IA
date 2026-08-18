import { expect, test } from '@playwright/test'

import { prepareAuthenticatedPage, prepareTheme, settlePage } from './helpers'

const PLAN_ID = '11111111-1111-4111-8111-111111111111'
const TEST_PACKAGE_ID = '99999999-9999-4999-8999-999999999991'

const surfaces = [
  {
    name: 'planes',
    path: '/planes?q=Doctorado',
    text: 'Planes de estudio',
    readyText: 'Doctorado en Ingeniería',
  },
  {
    name: 'asignaturas',
    path: '/asignaturas?q=Matemáticas',
    text: 'Catálogo de Asignaturas',
    readyText: 'Matemáticas para ingeniería',
  },
  {
    name: 'detalle-plan',
    path: `/planes/${PLAN_ID}`,
    text: 'Datos Generales',
  },
  {
    name: 'facultades',
    path: '/administracion/facultades',
    text: 'Facultades y carreras',
  },
  {
    name: 'estructuras',
    path: `/administracion/estructuras/paquetes/${TEST_PACKAGE_ID}?q=Paquete%20de%20revisi%C3%B3n%20visual&orden=nombre_asc&estado=vigentes&version=todas`,
    text: 'Plan',
    readyText: 'Sin plantillas',
  },
  {
    name: 'archivos',
    path: '/administracion/referencias/archivos',
    text: 'Archivos',
  },
] as const

test.beforeEach(async ({ page }, testInfo) => {
  await prepareAuthenticatedPage(page)
  await prepareTheme(page, testInfo)
})

for (const surface of surfaces) {
  test(`${surface.name} mantiene el ritmo de proximidad`, async ({ page }) => {
    await page.goto(surface.path)
    await expect(page).not.toHaveURL(/\/login/)
    await expect(
      page.getByText(surface.text, { exact: false }).first(),
    ).toBeVisible({
      timeout: 20_000,
    })
    if ('readyText' in surface) {
      await expect(
        page.getByText(surface.readyText, { exact: false }).first(),
      ).toBeVisible({ timeout: 20_000 })
    }
    await settlePage(page)

    await expect(page).toHaveScreenshot(`${surface.name}.png`, {
      fullPage: true,
    })
  })
}

test('lista vacía conserva la misma geometría de página', async ({ page }) => {
  await page.goto('/planes?q=__sin_resultados_visuales__')
  await expect(
    page.getByText('No se encontraron planes con estos filtros.'),
  ).toBeVisible({ timeout: 20_000 })
  await settlePage(page)

  await expect(page).toHaveScreenshot('planes-vacio.png', { fullPage: true })
})

test('filtros conservan cabecera, cuerpo y acciones como grupos', async ({
  page,
}) => {
  await page.goto('/planes')
  await page.getByRole('button', { name: 'Filtrar planes' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await settlePage(page)

  await expect(page).toHaveScreenshot('dialogo-filtros.png')
})

test('asistente de creación conserva regiones estables', async ({ page }) => {
  await page.goto('/planes?q=Doctorado')
  await expect(
    page.getByText('Doctorado en Ingeniería', { exact: false }).first(),
  ).toBeVisible({ timeout: 20_000 })
  await page.getByRole('link', { name: 'Nuevo plan de estudios' }).click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 })
  await settlePage(page)

  await expect(page).toHaveScreenshot('asistente-plan.png')
})

test('popover de filtros conserva controles relacionados', async ({ page }) => {
  await page.goto(
    '/administracion/estructuras/paquetes?q=&orden=nombre_asc&estado=vigentes',
  )
  await page.getByRole('button', { name: 'Filtrar paquetes' }).click()
  await expect(page.getByText('Estado', { exact: true })).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  await settlePage(page)

  await expect(page).toHaveScreenshot('popover-filtros.png')
})

test('panel de flujo no desplaza el contenido principal', async ({ page }) => {
  await page.goto(`/planes/${PLAN_ID}`)
  await settlePage(page)
  const title = page.getByRole('heading', { level: 1 }).first()
  const titleBefore = await title.boundingBox()
  if (!titleBefore) throw new Error('No se pudo medir el encabezado del plan.')
  const scrollBefore = await page.evaluate(() => window.scrollY)

  await page
    .getByRole('button', { name: 'Abrir acciones disponibles' })
    .click({ force: true })
  await page.getByRole('button', { name: 'Flujo y Estados' }).click()
  await expect(page.getByText('Flujo y etapas', { exact: true })).toBeVisible()
  await settlePage(page)

  const titleAfter = await title.boundingBox()
  if (!titleAfter)
    throw new Error('El encabezado desapareció al abrir el panel.')
  const scrollAfter = await page.evaluate(() => window.scrollY)
  expect(Math.abs(titleAfter.x - titleBefore.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(titleAfter.y - titleBefore.y)).toBeLessThanOrEqual(1)
  expect(scrollAfter).toBe(scrollBefore)

  await expect(page).toHaveScreenshot('panel-flujo.png')
})

test('confirmación destructiva usa el ritmo estándar', async ({ page }) => {
  await page.goto(
    `/administracion/estructuras/paquetes/${TEST_PACKAGE_ID}?q=Paquete%20de%20revisi%C3%B3n%20visual&orden=nombre_asc&estado=vigentes&version=todas`,
  )
  await expect(
    page.getByText('Sin plantillas', { exact: true }).first(),
  ).toBeVisible({ timeout: 20_000 })
  const trigger = page.getByRole('button', {
    name: /Archivar paquete|Eliminar paquete/,
  })
  await expect(trigger).toBeVisible({ timeout: 20_000 })
  await trigger.click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await settlePage(page)

  await expect(page).toHaveScreenshot('alerta-retiro-paquete.png')
})
