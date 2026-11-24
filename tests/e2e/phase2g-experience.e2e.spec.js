import { expect, test } from '@playwright/test'

const users = {
  admin: { email: 'admin.e2e@example.test', password: 'E2e-Admin-Password-2026!' },
  employee: { email: 'employee.e2e@example.test', password: 'E2e-Employee-Password-2026!' },
}

async function signIn(page, user) {
  await page.goto('/')
  await page.getByLabel('Correo').fill(user.email)
  await page.getByLabel('Contraseña').fill(user.password)
  await page.getByRole('button', { name: 'Iniciar sesion' }).click()
  const transientError = page.getByText('Failed to fetch')
  for (let attempt = 0; attempt < 5 && await transientError.isVisible({ timeout: 200 }).catch(() => false); attempt += 1) {
    await page.waitForTimeout(1_000)
    await page.getByRole('button', { name: 'Iniciar sesion' }).click()
  }
  await expect(page.locator('h1, h2').filter({ hasText: /Fichaje|Presupuestos/ }).first()).toBeVisible()
}

test('2G: panel administrativo resume trabajadores y calendario sin clasificar días vacíos', async ({ page }) => {
  await signIn(page, users.admin)
  await page.getByRole('button', { name: 'Jornadas' }).click()
  await expect(page.getByRole('heading', { name: 'Jornadas', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Control por trabajador y calendario' })).toBeVisible()
  await expect(page.getByLabel('Buscar trabajador')).toBeVisible()
  await expect(page.getByText('Solicitudes pendientes', { exact: true })).toBeVisible()
  const workerButtons = page.getByLabel('Lista de trabajadores').locator('button')
  if (await workerButtons.count()) {
    await page.getByLabel('Buscar trabajador').fill('')
    await workerButtons.first().click()
  } else {
    await expect(page.getByText('No hay trabajadores con jornadas en el periodo.')).toBeVisible()
  }
  const calendarDay = page.locator('[aria-labelledby="workers-calendar-title"] button').first()
  await calendarDay.click()
  await expect(page.getByText('Sin registro para esta fecha', { exact: false }).last()).toBeVisible()
  await page.screenshot({ path: '/evidence/phase2g-admin-desktop.png', fullPage: true })
})

test('2G: jornada excepcionalmente corta exige confirmación explícita', async ({ page }) => {
  await signIn(page, users.employee)
  await page.getByRole('button', { name: 'Registrar entrada' }).click()
  await expect(page.getByRole('button', { name: 'Registrar salida' })).toBeVisible()
  await page.evaluate(() => {
    const started = Date.now()
    Date.now = () => started + 120_000
  })
  let confirmed = false
  page.once('dialog', async (dialog) => {
    confirmed = dialog.type() === 'confirm' && dialog.message().includes('excepcionalmente corta')
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Registrar salida' }).click()
  expect(confirmed).toBe(true)
  await expect(page.getByRole('status')).toContainText('Salida registrada.')
})

test.describe('2G móvil', () => {
  for (const width of [360, 375, 390, 430]) {
    test(`${width}px: fichaje y perfil sin desbordamiento`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 360 ? 800 : width === 375 ? 812 : width === 390 ? 844 : 932 })
      await signIn(page, users.employee)
      await expect(page.getByRole('heading', { name: 'Fichaje', exact: true })).toBeVisible()
      await expect(page.getByText(/Duración:/)).toHaveCount(0)
      await page.getByRole('button', { name: 'Perfil' }).click()
      await expect(page.getByRole('heading', { name: 'Perfil y seguridad' })).toBeVisible()
      const passwordBox = await page.getByLabel('Nueva contraseña').boundingBox()
      const navigationBox = await page.getByRole('navigation', { name: 'Navegación personal' }).boundingBox()
      expect(passwordBox).not.toBeNull()
      expect(navigationBox).not.toBeNull()
      expect(passwordBox.y + passwordBox.height).toBeLessThanOrEqual(navigationBox.y)
      await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
      await page.screenshot({ path: `/evidence/phase2g-worker-${width}.png`, fullPage: true })
    })
  }
})
