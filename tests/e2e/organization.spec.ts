import { expect, test } from '@playwright/test'
import { ORGANIZATION, ORGANIZATION_ID } from '../support/fixtures'
import { loginAsPresident } from './support/auth'

test('lists the active organization and opens its management pages', async ({
  page,
}) => {
  await loginAsPresident(page)

  await page.getByText('Minhas organizações', { exact: true }).click()

  await expect(page).toHaveURL(/\/app\/organizacoes$/)
  await expect(
    page.getByRole('heading', { name: 'Minhas organizações' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: ORGANIZATION.legalName }),
  ).toBeVisible()
  await expect(page.getByText('Ativa')).toBeVisible()

  await page.getByRole('link', { name: 'Abrir organização' }).click()

  await expect(page).toHaveURL(
    new RegExp(`/app/organizacoes/${ORGANIZATION_ID}$`),
  )
  await expect(
    page.getByRole('heading', { level: 1, name: ORGANIZATION.legalName }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Gerenciar membros' }).click()

  await expect(page).toHaveURL(/\/membros$/)
  await expect(
    page.getByRole('heading', { name: 'Membros da organização' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Presidente E2E' }),
  ).toBeVisible()
})

test('opens the roles page with the seeded roles', async ({ page }) => {
  await loginAsPresident(page)

  await page.goto(`/app/organizacoes/${ORGANIZATION_ID}`)
  await page.getByRole('link', { name: 'Gerenciar cargos' }).click()

  await expect(page).toHaveURL(/\/cargos$/)
  await expect(
    page.getByRole('heading', { name: 'Cargos e permissões' }),
  ).toBeVisible()
  await expect(page.getByText(ORGANIZATION.presidentRoleName)).toBeVisible()
  await expect(page.getByText(ORGANIZATION.defaultRoleName)).toBeVisible()
})
