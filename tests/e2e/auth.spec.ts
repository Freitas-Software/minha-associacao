import { expect, test } from '@playwright/test'
import { PRESIDENT } from '../support/fixtures'
import { loginAsPresident } from './support/auth'

test('redirects an anonymous visitor to the login page', async ({ page }) => {
  await page.goto('/app')

  await expect(page).toHaveURL(/\/app\/entrar/)
  await expect(page.getByLabel('CPF', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Senha', { exact: true })).toBeVisible()
})

test('keeps the visitor on the login page when credentials are invalid', async ({
  page,
}) => {
  await page.goto('/app/entrar')

  await page.getByLabel('CPF', { exact: true }).fill(PRESIDENT.cpf)
  await page.getByLabel('Senha', { exact: true }).fill('senha-incorreta')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()

  await expect(
    page.getByRole('group', { name: 'Entre na sua conta' }).getByRole('alert'),
  ).toContainText('CPF ou senha inválidos.')
  await expect(page).toHaveURL(/\/app\/entrar/)
})

test('logs in, shows the account home and logs out', async ({ page }) => {
  await loginAsPresident(page)

  await expect(
    page.getByText('Minhas organizações', { exact: true }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Sair', exact: true }).click()

  await expect(page).toHaveURL(/\/app\/entrar/)
  await expect(page.getByLabel('CPF', { exact: true })).toBeVisible()
})

test('validates the login form before submitting', async ({ page }) => {
  await page.goto('/app/entrar')

  await page.getByRole('button', { name: 'Entrar', exact: true }).click()

  await expect(page.getByText('Informe os 11 dígitos do CPF.')).toBeVisible()
  await expect(page.getByText('Informe sua senha.')).toBeVisible()
})

test('formats a CPF typed only with digits', async ({ page }) => {
  await page.goto('/app/entrar')

  await page.getByLabel('CPF', { exact: true }).fill(PRESIDENT.cpf)

  await expect(page.getByLabel('CPF', { exact: true })).toHaveValue(
    '529.982.247-25',
  )
})
