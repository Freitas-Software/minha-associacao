export function focusFirstInvalidField(form: HTMLFormElement | null): void {
  requestAnimationFrame(() => {
    const target =
      form?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      form?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), select, textarea',
      )

    target?.focus()
  })
}
