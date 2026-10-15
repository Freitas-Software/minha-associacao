import z from 'zod'

function isValidCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false
  const digits = [...value].map(Number)
  for (const length of [9, 10]) {
    const sum = digits
      .slice(0, length)
      .reduce((total, digit, index) => total + digit * (length + 1 - index), 0)
    const remainder = (sum * 10) % 11
    if ((remainder === 10 ? 0 : remainder) !== digits[length]) return false
  }
  return true
}

export const createUserFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, { error: 'Informe seu nome completo' })
    .max(255),
  documentNumber: z
    .string()
    .transform(value => value.replaceAll(/\D/g, ''))
    .pipe(
      z.string().regex(/^\d{11}$/, { error: 'Informe os 11 dígitos do CPF' }),
    )
    .refine(isValidCpf, { error: 'Informe um CPF válido' }),
  email: z.email({ error: 'Informe um email válido' }).max(55),
  phone: z
    .string()
    .transform(value => value.replaceAll(/\D/g, ''))
    .pipe(
      z.string().regex(/^\d{11}$/, {
        error: 'Informe os 11 dígitos do seu telefone. 95912345678',
      }),
    ),
  birthDate: z.iso
    .date({ error: 'Informe uma data de nascimento válida' })
    .refine(
      value => {
        const now = new Date()
        const today = [
          String(now.getFullYear()).padStart(4, '0'),
          String(now.getMonth() + 1).padStart(2, '0'),
          String(now.getDate()).padStart(2, '0'),
        ].join('-')

        return value <= today
      },
      { error: 'A data de nascimento não pode estar no futuro' },
    ),
})

export type CreateUserData = z.infer<typeof createUserFormSchema>

export type CreateUserField = keyof CreateUserData
export type CreateUserResult =
  | { success: true }
  | {
      success: false
      message: string
      fieldErrors?: Partial<Record<CreateUserField, string[]>>
    }
