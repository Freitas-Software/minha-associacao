import { expect, type Page } from '@playwright/test'
import { PRESIDENT, TEST_PASSWORD } from '../../support/fixtures'

export async function loginAsPresident(page: Page) {
  await page.goto('/app/entrar')
  await page.getByLabel('CPF', { exact: true }).fill(PRESIDENT.cpf)
  await page.getByLabel('Senha', { exact: true }).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()

  await expect(page).toHaveURL(/\/app$/)
  await expect(
    page.getByRole('heading', { name: `Olá, ${PRESIDENT.name}` }),
  ).toBeVisible()
}
