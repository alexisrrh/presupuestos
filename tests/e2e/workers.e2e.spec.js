import { expect, test } from '@playwright/test'
import process from 'node:process'

const users = {
  owner: { email: 'owner.e2e@example.test', password: 'E2e-Owner-Password-2026!' },
  admin: { email: 'admin.e2e@example.test', password: 'E2e-Admin-Password-2026!' },
  employee: { email: 'employee.e2e@example.test', password: 'E2e-Employee-Password-2026!' },
  ownerB: { email: 'owner-b.e2e@example.test', password: 'E2e-Owner-B-Password-2026!' },
}

async function expectEmployeeReady(page, label = /Registrar (entrada|salida)/) {
  await expect(page.getByRole('heading', { name: 'Fichaje' })).toBeVisible()
  await expect(page.getByRole('button', { name: label })).toBeVisible()
}

async function signIn(page, user) {
  await page.goto('/')
  await page.getByLabel('Correo').fill(user.email)
  await page.getByLabel('Contraseña').fill(user.password)
  await page.getByRole('button', { name: 'Iniciar sesion' }).click()
  // GoTrue can still be finishing its internal startup when the isolated
  // runner begins. Retry only the observable transient transport error.
  const transientError = page.getByText('Failed to fetch')
  if (await transientError.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await page.waitForTimeout(1_000)
    await page.getByRole('button', { name: 'Iniciar sesion' }).click()
  }
}

async function openWorkers(page, { mobile = false } = {}) {
  if (mobile) {
    await page.getByRole('navigation', { name: 'Navegacion móvil' }).getByRole('button', { name: 'Trabajadores' }).click()
  } else {
    await page.getByRole('button', { name: 'Trabajadores' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Trabajadores' })).toBeVisible()
}

async function openBaseWorker(page) {
  await page.getByRole('button', { name: 'Detalle de Base Trabajador' }).click()
  await expect(page.getByRole('heading', { name: 'Detalle de la ficha' })).toBeVisible()
}

async function openWorkSessions(page, { mobile = false } = {}) {
  if (mobile) {
    await page.getByRole('navigation', { name: 'Navegacion móvil' }).getByRole('button', { name: 'Jornadas' }).click()
  } else {
    await page.getByRole('button', { name: 'Jornadas' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Jornadas' })).toBeVisible()
}

test('owner: CRUD disponible, persistencia real tras recarga e historial', async ({ page }) => {
  await signIn(page, users.owner)
  await openWorkers(page)

  await page.getByRole('button', { name: 'Nuevo trabajador' }).click()
  await page.locator('#worker-employeeCode').fill('E2E-UI-001')
  await page.locator('#worker-firstName').fill('Nuevo')
  await page.locator('#worker-lastName').fill('Navegador')
  await page.locator('#worker-document').fill('00000009D')
  await page.locator('#worker-email').fill('nuevo.e2e@example.test')
  await page.locator('#worker-phone').fill('600444444')
  await page.locator('#worker-position').fill('Oficial E2E')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('status')).toContainText('Ficha guardada correctamente.')
  const history = page.locator('.worker-panel').filter({ has: page.getByRole('heading', { name: 'Historial de la ficha' }) })
  await expect(history).toContainText('Ficha creada')

  await page.reload()
  await openWorkers(page)
  await expect(page.getByRole('rowheader', { name: /Nuevo Navegador/ })).toBeVisible()
  await page.getByRole('button', { name: 'Detalle de Nuevo Navegador' }).click()
  await page.locator('#worker-phone').fill('600444445')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('status')).toContainText('Ficha guardada correctamente.')
  await expect(history).toContainText('Datos modificados')

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByRole('heading', { name: 'Iniciar sesion' })).toBeVisible()
})

test('RLS real: employee no accede al panel y owner de B no ve trabajadores de A', async ({ browser }) => {
  const employeeContext = await browser.newContext()
  const employeePage = await employeeContext.newPage()
  await signIn(employeePage, users.employee)
  await expect(employeePage.getByRole('heading', { name: 'Fichaje' })).toBeVisible()
  await expect(employeePage.getByRole('button', { name: 'Trabajadores' })).toHaveCount(0)
  await employeeContext.close()

  const otherContext = await browser.newContext()
  const otherPage = await otherContext.newPage()
  await signIn(otherPage, users.ownerB)
  await openWorkers(otherPage)
  await expect(otherPage.getByRole('rowheader', { name: /Externo E2E/ })).toBeVisible()
  await expect(otherPage.getByText('Base Trabajador')).toHaveCount(0)
  await otherContext.close()
})

test('employee: entrada, recarga, salida y persistencia real de jornada', async ({ page }) => {
  await signIn(page, users.employee)
  await expect(page.getByRole('heading', { name: 'Fichaje' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrar entrada' })).toBeVisible()
  await page.getByRole('button', { name: 'Registrar entrada' }).click()
  await expect(page.getByRole('status')).toContainText('Entrada registrada.')
  await expect(page.getByRole('button', { name: 'Registrar salida' })).toBeVisible()
  await page.screenshot({ path: '/evidence/time-tracking-open.png', fullPage: true })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Registrar salida' })).toBeVisible()
  await page.getByRole('button', { name: 'Registrar salida' }).click()
  await expect(page.getByRole('status')).toContainText('Salida registrada.')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Registrar entrada' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Últimas jornadas' }).locator('..')).toContainText('Finalizada')
  await page.screenshot({ path: '/evidence/time-tracking-closed-history.png', fullPage: true })
})

test('fichaje: una respuesta perdida se recupera desde PostgreSQL sin repetir la entrada', async ({ page }) => {
  await signIn(page, users.employee)
  await expect(page.getByRole('button', { name: 'Registrar entrada' })).toBeVisible()

  await page.route('**/rest/v1/rpc/clock_in_current_worker', async (route) => {
    // The real request reaches PostgreSQL first. Only its response is hidden
    // from the browser, modelling a transport interruption after commit.
    await route.fetch()
    await route.abort('failed')
  })
  await page.getByRole('button', { name: 'Registrar entrada' }).click()
  await expect(page.getByRole('alert')).toContainText('No se pudo confirmar el resultado')
  await page.screenshot({ path: '/evidence/time-tracking-pending-verification.png', fullPage: true })

  await page.unroute('**/rest/v1/rpc/clock_in_current_worker')
  await page.getByRole('button', { name: 'Actualizar estado' }).click()
  await expect(page.getByRole('button', { name: 'Registrar salida' })).toBeVisible()
  await page.getByRole('button', { name: 'Registrar salida' }).click()
  await expect(page.getByRole('status')).toContainText('Salida registrada.')
})

test('fichaje: doble pulsación real durante la entrada solo envía una mutación', async ({ page }) => {
  await signIn(page, users.employee); await expectEmployeeReady(page, 'Registrar entrada')
  let calls = 0; let release
  const responseGate = new Promise((resolve) => { release = resolve })
  await page.route('**/rest/v1/rpc/clock_in_current_worker', async (route) => {
    calls += 1
    const response = await route.fetch()
    await responseGate
    await route.fulfill({ response })
  })
  const button = page.getByRole('button', { name: 'Registrar entrada' })
  const box = await button.boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect.poll(() => calls).toBe(1)
  release()
  await expect(page.getByRole('button', { name: 'Registrar salida' })).toBeVisible()
  await page.unroute('**/rest/v1/rpc/clock_in_current_worker')
  await page.getByRole('button', { name: 'Registrar salida' }).click()
})

test('fichaje: dos sesiones desactualizadas se reconcilian tras una entrada concurrente', async ({ browser }) => {
  const a = await browser.newContext(); const b = await browser.newContext()
  const pageA = await a.newPage(); const pageB = await b.newPage()
  await Promise.all([signIn(pageA, users.employee), signIn(pageB, users.employee)])
  await Promise.all([expectEmployeeReady(pageA, 'Registrar entrada'), expectEmployeeReady(pageB, 'Registrar entrada')])
  await Promise.all([pageA.getByRole('button', { name: 'Registrar entrada' }).click(), pageB.getByRole('button', { name: 'Registrar entrada' }).click()])
  await expect(pageA.getByRole('button', { name: 'Registrar salida' })).toBeVisible()
  await expect(pageB.getByRole('button', { name: 'Registrar salida' })).toBeVisible()
  await pageA.getByRole('button', { name: 'Registrar salida' }).click()
  await a.close(); await b.close()
})

test('fichaje: foco y reconexión recuperan el estado sin recarga ni mutación', async ({ browser }) => {
  const stale = await browser.newContext(); const live = await browser.newContext()
  const pageStale = await stale.newPage(); const pageLive = await live.newPage()
  await Promise.all([signIn(pageStale, users.employee), signIn(pageLive, users.employee)])
  await expectEmployeeReady(pageStale, 'Registrar entrada')
  await stale.setOffline(true)
  await pageLive.getByRole('button', { name: 'Registrar entrada' }).click()
  await expect(pageLive.getByRole('button', { name: 'Registrar salida' })).toBeVisible()
  await stale.setOffline(false)
  await pageStale.bringToFront()
  await expect(pageStale.getByRole('button', { name: 'Registrar salida' })).toBeVisible()
  await pageLive.getByRole('button', { name: 'Registrar salida' }).click()
  await stale.close(); await live.close()
})

test('fichaje: salida persistida con respuesta perdida se reconcilia sin cerrar otra jornada', async ({ page }) => {
  await signIn(page, users.employee); await expectEmployeeReady(page, 'Registrar entrada')
  await page.getByRole('button', { name: 'Registrar entrada' }).click()
  await expect(page.getByRole('button', { name: 'Registrar salida' })).toBeVisible()
  await page.route('**/rest/v1/rpc/clock_out_current_worker', async (route) => { await route.fetch(); await route.abort('failed') })
  await page.getByRole('button', { name: 'Registrar salida' }).click()
  await expect(page.getByRole('alert')).toContainText('No se pudo confirmar el resultado')
  await page.unroute('**/rest/v1/rpc/clock_out_current_worker')
  await page.getByRole('button', { name: 'Actualizar estado' }).click()
  await expect(page.getByRole('button', { name: 'Registrar entrada' })).toBeVisible()
})

test('fichaje: cerrar sesión elimina datos del trabajador anterior', async ({ page }) => {
  await signIn(page, users.employee); await expectEmployeeReady(page, 'Registrar entrada')
  await page.getByRole('button', { name: 'Actualizar jornada' }).click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await signIn(page, users.ownerB)
  await page.getByRole('button', { name: 'Mi fichaje' }).click()
  await expectEmployeeReady(page, 'Registrar entrada')
  await expect(page.getByText('Externo E2E')).toBeVisible()
  await expect(page.getByText('Empleado E2E')).toHaveCount(0)
  await page.getByRole('button', { name: 'Registrar entrada' }).click()
  await expect(page.getByRole('button', { name: 'Registrar salida' })).toBeVisible()
})

if (process.env.E2E_PREVIOUS_DAY === '1') {
  test('fichaje: jornada abierta iniciada ayer permanece identificada y cerrable', async ({ page }) => {
    await signIn(page, users.employee); await expectEmployeeReady(page, 'Registrar salida')
    await expect(page.getByText('Jornada en curso')).toBeVisible()
    await expect(page.getByText('Entrada:')).toBeVisible()
    await page.getByRole('button', { name: 'Registrar salida' }).click()
    await expect(page.getByRole('button', { name: 'Registrar entrada' })).toBeVisible()
  })
}

for (const viewport of [
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`fichaje móvil ${viewport.width}×${viewport.height}: jornada sin desplazamiento horizontal`, async ({ browser }) => {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await signIn(page, users.employee)
    await expect(page.getByRole('heading', { name: 'Fichaje' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Registrar (entrada|salida)/ })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `/evidence/time-tracking-${viewport.width}x${viewport.height}.png`, fullPage: true })
    await context.close()
  })
}

test('dos sesiones con la misma revisión: el segundo guardado recibe conflicto', async ({ browser }) => {
  const ownerContext = await browser.newContext()
  const adminContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  const adminPage = await adminContext.newPage()

  await Promise.all([signIn(ownerPage, users.owner), signIn(adminPage, users.admin)])
  await Promise.all([openWorkers(ownerPage), openWorkers(adminPage)])
  await Promise.all([openBaseWorker(ownerPage), openBaseWorker(adminPage)])

  await ownerPage.locator('#worker-position').fill('Coordinador E2E confirmado')
  await adminPage.locator('#worker-phone').fill('600555555')
  await ownerPage.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(ownerPage.getByRole('status')).toContainText('Ficha guardada correctamente.')
  await adminPage.getByRole('button', { name: 'Guardar cambios' }).click()

  await expect(adminPage.getByRole('alert')).toContainText('La ficha ha cambiado.')
  await expect(adminPage.locator('#worker-phone')).toHaveValue('600555555')
  await ownerContext.close()
  await adminContext.close()
})

test('fallo de conexión al cargar trabajadores muestra un error recuperable', async ({ page }) => {
  await signIn(page, users.owner)
  await expect(page.getByRole('button', { name: 'Trabajadores' })).toBeVisible()
  await page.route('**/rest/v1/workers**', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Gateway local no disponible' }),
  }))
  await openWorkers(page)
  await expect(page.getByRole('alert')).toContainText('No se pudo conectar con el servicio')
})

test('owner: archiva y recupera una ficha mediante RPC, con historial persistente', async ({ page }) => {
  await signIn(page, users.owner)
  await openWorkers(page)

  await page.getByRole('button', { name: 'Archivar a Base Trabajador' }).click()
  await page.locator('#archive-reason').fill('Fin temporal de la asignación E2E')
  await page.getByRole('button', { name: 'Confirmar archivo' }).click()
  await expect(page.getByRole('status')).toContainText('Ficha archivada con motivo e historial')
  await expect(page.getByRole('button', { name: 'Recuperar a Base Trabajador' })).toBeVisible()

  await page.getByRole('button', { name: 'Recuperar a Base Trabajador' }).click()
  await page.locator('#archive-reason').fill('Reincorporación E2E autorizada')
  await page.getByRole('button', { name: 'Confirmar recuperación' }).click()
  await expect(page.getByRole('status')).toContainText('Ficha recuperada con su estado anterior')

  await openBaseWorker(page)
  const history = page.locator('.worker-panel').filter({ has: page.getByRole('heading', { name: 'Historial de la ficha' }) })
  await expect(history).toContainText('Ficha archivada')
  await expect(history).toContainText('Ficha recuperada')
})

test('fallo de red al archivar no comunica un éxito engañoso', async ({ page }) => {
  await signIn(page, users.owner)
  await openWorkers(page)
  await page.route('**/rest/v1/rpc/archive_worker_with_revision', (route) => route.abort('failed'))
  await page.getByRole('button', { name: 'Archivar a Base Trabajador' }).click()
  await page.locator('#archive-reason').fill('Prueba de red no persistente')
  await page.getByRole('button', { name: 'Confirmar archivo' }).click()
  await expect(page.getByRole('alert')).toContainText('No se pudo conectar con el servicio')
  await expect(page.getByRole('heading', { name: 'Archivar ficha' })).toBeVisible()
  await expect(page.getByRole('status')).not.toContainText('Ficha archivada')
})

test('administración: owner corrige y cierra una jornada persistida con motivo e historial', async ({ browser }) => {
  const employeeContext = await browser.newContext()
  const employeePage = await employeeContext.newPage()
  await signIn(employeePage, users.employee)
  await expectEmployeeReady(employeePage, 'Registrar entrada')
  await employeePage.getByRole('button', { name: 'Registrar entrada' }).click()
  await expect(employeePage.getByRole('button', { name: 'Registrar salida' })).toBeVisible()

  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  await signIn(ownerPage, users.owner)
  await openWorkSessions(ownerPage)
  await ownerPage.getByRole('button', { name: /Empleado E2E E2E-EMP Abierta/ }).click()
  await expect(ownerPage.getByRole('heading', { name: 'Detalle de jornada' })).toBeVisible()
  await ownerPage.getByLabel('Operación').selectOption('correct')
  const clockIn = ownerPage.getByLabel('Entrada propuesta')
  await clockIn.fill('2026-11-23T08:30')
  await ownerPage.getByLabel('Motivo').fill('Corrección administrativa E2E de entrada')
  await ownerPage.getByRole('button', { name: 'Confirmar operación' }).click()
  await expect(ownerPage.getByRole('status')).toContainText('Jornada actualizada y trazada.')
  await ownerPage.getByRole('button', { name: /Empleado E2E E2E-EMP Abierta/ }).click()
  await expect(ownerPage.getByText('admin_corrected')).toBeVisible()
  await ownerPage.getByLabel('Operación').selectOption('close_forgotten')
  await ownerPage.getByLabel('Salida indicada').fill('2026-11-23T16:00')
  await ownerPage.getByLabel('Motivo').fill('Cierre de jornada olvidada E2E')
  await ownerPage.getByRole('button', { name: 'Confirmar operación' }).click()
  await expect(ownerPage.getByRole('status')).toContainText('Jornada actualizada y trazada.')
  await employeePage.getByRole('button', { name: 'Actualizar jornada' }).click()
  await expect(employeePage.getByRole('button', { name: 'Registrar entrada' })).toBeVisible()
  await employeeContext.close()
  await ownerContext.close()
})

test('administración: empleado no ve jornadas y una respuesta perdida no comunica éxito', async ({ page }) => {
  await signIn(page, users.employee)
  await expect(page.getByRole('button', { name: 'Jornadas' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Registrar entrada' }).click()
  await expect(page.getByRole('button', { name: 'Registrar salida' })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await signIn(page, users.owner)
  await openWorkSessions(page)
  await page.getByRole('button', { name: /Empleado E2E E2E-EMP Abierta/ }).click()
  await page.getByLabel('Operación').selectOption('void')
  await page.route('**/rest/v1/rpc/admin_update_work_session_with_revision', async (route) => { await route.fetch(); await route.abort('failed') })
  await page.getByLabel('Motivo').fill('Resultado pendiente E2E')
  await page.getByRole('button', { name: 'Confirmar operación' }).click()
  await expect(page.getByRole('alert')).toContainText('No se pudo confirmar el resultado')
  await page.unroute('**/rest/v1/rpc/admin_update_work_session_with_revision')
})

test('escritorio: la navegación inferior móvil no duplica el menú lateral', async ({ page }) => {
  await signIn(page, users.owner)
  await expect(page.getByRole('button', { name: 'Trabajadores' })).toBeVisible()
  await openWorkers(page)
  await expect(page.getByRole('navigation', { name: 'Navegacion móvil' })).toBeHidden()
  await page.screenshot({ path: '/evidence/workers-desktop.png', fullPage: true })
})

test('móvil 390×844: listado y detalle de jornadas no desbordan', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await signIn(page, users.owner)
  await openWorkSessions(page, { mobile: true })
  await expect(page.getByRole('navigation', { name: 'Navegacion móvil' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '/evidence/work-sessions-390x844.png', fullPage: true })
  await context.close()
})

for (const viewport of [
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`móvil ${viewport.width}×${viewport.height}: trabajadores sin desplazamiento horizontal`, async ({ browser }) => {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await signIn(page, users.owner)
    await openWorkers(page, { mobile: true })
    await expect(page.getByRole('navigation', { name: 'Navegacion móvil' })).toBeVisible()
    await expect(page.locator('.worker-mobile-cards')).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `/evidence/workers-${viewport.width}x${viewport.height}.png`, fullPage: true })
    await context.close()
  })
}
