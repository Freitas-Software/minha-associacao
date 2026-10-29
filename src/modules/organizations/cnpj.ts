export function normalizeCnpj(value: string): string {
  return value.replaceAll(/\D/g, '')
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value)

  if (!/^\d{14}$/.test(cnpj)) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false

  const digits = [...cnpj].map(Number)

  const calculateDigit = (length: number): number => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

    const sum = weights.reduce(
      (total, weight, index) => total + digits[index] * weight,
      0,
    )
    const remainder = sum % 11

    return remainder < 2 ? 0 : 11 - remainder
  }

  return calculateDigit(12) === digits[12] && calculateDigit(13) === digits[13]
}

export function isEligibleAssociationCnae(value: string | number): boolean {
  const digits = String(value).replaceAll(/\D/g, '')

  return digits.length === 7 && digits.startsWith('94')
}
