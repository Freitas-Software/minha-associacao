import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { FormMessage } from '@/components/ui/form-message'

test('renders an error message as an alert and moves focus to it', async () => {
  const screen = await render(
    <FormMessage status="error" message="Não foi possível continuar." />,
  )

  const alert = screen.getByRole('alert')

  await expect.element(alert).toHaveTextContent('Não foi possível continuar.')

  await expect.poll(() => document.activeElement === alert.element()).toBe(true)
})

test('renders a success message as a status and hides idle content', async () => {
  const screen = await render(
    <FormMessage status="success" message="Dados atualizados." />,
  )

  await expect
    .element(screen.getByRole('status'))
    .toHaveTextContent('Dados atualizados.')

  const { container } = await render(
    <FormMessage status="idle" message="Não deve aparecer." />,
  )

  expect(container.textContent).toBe('')
})
