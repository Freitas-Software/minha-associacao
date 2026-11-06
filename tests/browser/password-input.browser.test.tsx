import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { PasswordInput } from '@/components/ui/password-input'

test('toggles the password visibility and accessible label', async () => {
  const screen = await render(
    <PasswordInput id="senha" aria-label="Senha" defaultValue="segredo" />,
  )

  const input = screen.getByLabelText('Senha')

  expect((input.element() as HTMLInputElement).type).toBe('password')
  expect(input.element().getAttribute('aria-label')).toBe('Senha')

  const showButton = screen.getByRole('button', { name: 'Mostrar senha' })
  const showButtonElement = showButton.element()

  await showButton.click()

  await expect
    .poll(() => (input.element() as HTMLInputElement).type)
    .toBe('text')

  await expect
    .poll(() => showButtonElement.getAttribute('aria-pressed'))
    .toBe('true')

  const hideButton = screen.getByRole('button', { name: 'Ocultar senha' })

  await hideButton.click()

  await expect
    .poll(() => (input.element() as HTMLInputElement).type)
    .toBe('password')
})
