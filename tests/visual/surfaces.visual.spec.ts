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
    path: `/asignaturas?q=Matemáticas&plan=${PLAN_ID}`,
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

    if (surface.name === 'estructuras') {
      await expect(page.locator('main')).toHaveScreenshot(`${surface.name}.png`)
    } else {
      await expect(page).toHaveScreenshot(`${surface.name}.png`, {
        fullPage: true,
      })
    }
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

  await expect(page.getByRole('dialog')).toHaveScreenshot('dialogo-filtros.png')
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

  await expect(page.locator('[data-slot="popover-content"]')).toHaveScreenshot(
    'popover-filtros.png',
  )
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
  await expect(page.getByText('Etapa 1 de 10', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Aprobado por SEP', { exact: true }),
  ).toBeVisible()
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

test('acciones del plan permanecen ancladas al viewport', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.endsWith('-dark'),
    'La posición no depende del tema visual.',
  )
  await page.goto(`/planes/${PLAN_ID}`)
  const trigger = page.getByRole('button', {
    name: 'Abrir acciones disponibles',
  })
  await expect(trigger).toBeVisible({ timeout: 20_000 })
  await settlePage(page)

  const medirMargenInferior = async () => {
    const caja = await trigger.boundingBox()
    const viewport = page.viewportSize()
    if (!caja || !viewport) {
      throw new Error('No se pudo medir el botón de acciones del plan.')
    }
    return viewport.height - caja.y - caja.height
  }

  expect(await medirMargenInferior()).toBeCloseTo(20, 0)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0)
  expect(await medirMargenInferior()).toBeCloseTo(20, 0)
})

test('modo agente se detiene al salir del plan', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-light',
    'El ciclo de vida del agente no depende del tema ni del viewport.',
  )
  await page.goto(`/planes/${PLAN_ID}`)
  await page.getByRole('button', { name: 'Abrir acciones disponibles' }).click()
  await page.getByRole('button', { name: 'Modo agente', exact: true }).click()

  const dock = page.getByRole('toolbar', {
    name: 'Modo agente de inteligencia artificial',
  })
  await expect(dock).toBeVisible()

  // Cambiar de sección dentro del mismo plan conserva la sesión.
  await page.goto(`/planes/${PLAN_ID}/asignaturas`)
  await expect(dock).toBeVisible()

  // Perder el plan en la URL sí equivale a detener el modo.
  await page.goto('/planes')
  await expect(
    page.getByText('Planes de estudio', { exact: true }),
  ).toBeVisible({ timeout: 20_000 })
  await expect(dock).toBeHidden()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const crudo = window.sessionStorage.getItem('acadia.agente.v1')
        return crudo ? (JSON.parse(crudo) as { activo?: boolean }).activo : null
      }),
    )
    .toBe(false)

  await page.goto(`/planes/${PLAN_ID}`)
  await expect(dock).toBeHidden()
  await expect(
    page.getByRole('button', { name: 'Abrir acciones disponibles' }),
  ).toBeVisible({ timeout: 20_000 })
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

  await expect(page.getByRole('alertdialog')).toHaveScreenshot(
    'alerta-retiro-paquete.png',
  )
})
