import { expect, test } from '@playwright/test'
import { PRESIDENT } from '../support/fixtures'
import { loginAsPresident } from './support/auth'

test('shows the profile of the authenticated person', async ({ page }) => {
  await loginAsPresident(page)

  await page.goto('/app/perfil')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Meu perfil' }),
  ).toBeVisible()
  await expect(page.getByText('529.982.247-25')).toBeVisible()
  await expect(page.getByText(PRESIDENT.email)).toBeVisible()
  await expect(page.getByText('Verificado')).toBeVisible()
})

test('lists the current session on the active sessions page', async ({
  page,
}) => {
  await loginAsPresident(page)

  await page.goto('/app/perfil/sessoes')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Sessões ativas' }),
  ).toBeVisible()
  await expect(page.getByText('Este dispositivo')).toBeVisible()
  await expect(page.getByText('Atual')).toBeVisible()
})
