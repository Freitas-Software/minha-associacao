const nonDigits = /\D/g

function onlyDigits(value: string): string {
  return value.replaceAll(nonDigits, '')
}

export function formatCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)
  const segments = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)]

  let formatted = segments[0]

  if (segments[1]) formatted += `.${segments[1]}`
  if (segments[2]) formatted += `.${segments[2]}`

  const last = digits.slice(9, 11)

  if (last) formatted += `-${last}`

  return formatted
}

export function formatCnpj(value: string): string {
  const digits = onlyDigits(value).slice(0, 14)
  const segments = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 8),
    digits.slice(8, 12),
  ]

  let formatted = segments[0]

  if (segments[1]) formatted += `.${segments[1]}`
  if (segments[2]) formatted += `.${segments[2]}`
  if (segments[3]) formatted += `/${segments[3]}`

  const last = digits.slice(12, 14)

  if (last) formatted += `-${last}`

  return formatted
}

export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)

  if (digits.length <= 2) return digits

  const areaCode = digits.slice(0, 2)
  const number = digits.slice(2)

  if (number.length <= 5) return `(${areaCode}) ${number}`

  return `(${areaCode}) ${number.slice(0, 5)}-${number.slice(5)}`
}

export function caretPositionForDigits(
  value: string,
  digitCount: number,
): number {
  if (digitCount <= 0) return 0

  let seen = 0

  for (const [index, character] of [...value].entries()) {
    if (!/\d/.test(character)) continue

    seen += 1

    if (seen === digitCount) return index + 1
  }

  return value.length
}
