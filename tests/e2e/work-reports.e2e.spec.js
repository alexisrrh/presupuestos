import { expect, test } from '@playwright/test'

test('admin consulta y descarga un informe de tiempo completo', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Correo').fill('admin.e2e@example.test')
  await page.getByLabel('Contraseña').fill('E2e-Admin-Password-2026!')
  await page.getByRole('button', { name: 'Iniciar sesion' }).click()
  await expect(page.getByRole('button', { name: 'Informes' })).toBeVisible()
  await page.getByRole('button', { name: 'Informes' }).click()
  await expect(page.getByRole('heading', { name: 'Informes de tiempo' })).toBeVisible()
  await page.locator('input[type="date"]').first().fill('2026-11-01')
  await page.locator('input[type="date"]').nth(1).fill('2026-11-30')
  await page.getByRole('button', { name: 'Consultar' }).click()
  await expect(page.getByText(/Periodo inclusivo:/)).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  await expect((await download).suggestedFilename()).toBe('informe-tiempo-2026-11-01-2026-11-30.csv')
})
