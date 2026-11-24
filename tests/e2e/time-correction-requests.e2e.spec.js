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
  if (await transientError.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await page.waitForTimeout(1_000)
    await page.getByRole('button', { name: 'Iniciar sesion' }).click()
  }
  await expect(page.locator('h1, h2').filter({ hasText: /Fichaje|Presupuestos/ }).first()).toBeVisible()
}

test('2F: empleado solicita y administrador resuelve un fichaje olvidado', async ({ browser }) => {
  const employeeContext = await browser.newContext()
  const employeePage = await employeeContext.newPage()
  await signIn(employeePage, users.employee)
  await expect(employeePage.getByRole('heading', { name: 'Fichaje', exact: true })).toBeVisible()
  await employeePage.getByRole('button', { name: 'Solicitar' }).click()
  await employeePage.getByLabel('Tipo').selectOption('full_day_forgotten')
  await employeePage.getByLabel('Entrada propuesta').fill('2026-11-29T08:00')
  await employeePage.getByLabel('Salida propuesta (opcional)').fill('2026-11-29T16:00')
  await employeePage.getByLabel('Motivo').fill('Jornada completa olvidada en la obra E2E')
  await employeePage.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(employeePage.getByRole('status')).toContainText('Solicitud enviada para revisión.')
  await expect(employeePage.getByText('Pendiente')).toBeVisible()
  await employeePage.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(employeePage.getByRole('heading', { name: 'Iniciar sesion' })).toBeVisible()

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await signIn(adminPage, users.admin)
  await adminPage.getByRole('button', { name: 'Jornadas' }).click()
  await expect(adminPage.getByRole('heading', { name: 'Jornadas' })).toBeVisible()
  await expect(adminPage.getByRole('heading', { name: 'Solicitudes de fichaje' })).toBeVisible()
  await expect(adminPage.getByText('full_day_forgotten')).toBeVisible()
  await adminPage.getByLabel('Resolución').fill('Aprobada tras comprobar la jornada')
  await adminPage.getByRole('button', { name: 'Aprobar' }).click()
  await expect(adminPage.getByRole('status')).toContainText('Solicitud aprobada.')
  await expect(adminPage.getByText('No hay solicitudes pendientes.')).toBeVisible()
  await adminPage.getByRole('button', { name: 'Cerrar sesión' }).click()

  await signIn(employeePage, users.employee)
  await expect(employeePage.getByText('Aprobada')).toBeVisible()
  await employeePage.screenshot({ path: '/evidence/phase2f-employee-approved.png', fullPage: true })
  await employeeContext.close()
  await adminContext.close()
})

test('2F: una respuesta perdida conserva la solicitud pendiente y se reconcilia al recargar', async ({ page }) => {
  await signIn(page, users.employee)
  await page.getByRole('button', { name: 'Solicitar' }).click()
  await page.getByLabel('Tipo').selectOption('entry_forgotten')
  await page.getByLabel('Entrada propuesta').fill('2026-12-01T08:00')
  await page.getByLabel('Motivo').fill('Respuesta perdida E2E')
  await page.route('**/rest/v1/rpc/submit_work_session_correction_request', async (route) => {
    await route.fetch()
    await route.abort('failed')
  })
  await page.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(page.getByRole('alert')).toContainText('No se pudo confirmar la operación')
  await page.unroute('**/rest/v1/rpc/submit_work_session_correction_request')
  await page.reload()
  await expect(page.getByText('Pendiente')).toBeVisible()
})

for (const viewport of [
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`2F móvil ${viewport.width}×${viewport.height}: solicitud sin desbordamiento`, async ({ browser }) => {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await signIn(page, users.employee)
    await expect(page.getByRole('heading', { name: 'Fichaje', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Solicitar' }).click()
    await expect(page.getByLabel('Entrada propuesta')).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `/evidence/phase2f-request-${viewport.width}x${viewport.height}.png`, fullPage: true })
    await context.close()
  })
}
