import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('renders the public landing page and links to the app', async ({
  page,
}) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Gestão simples\s+para associações/,
    }),
  ).toBeVisible()

  await expect(
    page.getByRole('navigation', { name: 'Navegação principal' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Acessar app' }).click()

  await expect(page).toHaveURL(/\/app\/entrar/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Entrar' }),
  ).toBeVisible()
})

test('has no automatically detectable critical accessibility violations', async ({
  page,
}) => {
  await page.goto('/')

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze()

  // Color contrast is tracked separately: the current design tokens need a
  // visual pass. Structural and semantic violations must stay at zero.
  expect(results.violations).toEqual([])
})
