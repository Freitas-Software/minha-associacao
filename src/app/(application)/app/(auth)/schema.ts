import z from 'zod'

function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false
  if (/^(\d)\1{10}$/.test(value)) return false

  const digits = [...value].map(Number)

  for (const length of [9, 10]) {
    const sum = digits
      .slice(0, length)
      .reduce((total, digit, index) => total + digit * (length + 1 - index), 0)

    const remainder = (sum * 10) % 11
    const expectedDigit = remainder === 10 ? 0 : remainder

    if (expectedDigit !== digits[length]) return false
  }

  return true
}

const cpfSchema = z
  .string()
  .trim()
  .transform(value => value.replaceAll(/[.\-\s]/g, ''))
  .pipe(
    z.string().regex(/^\d{11}$/, {
      error: 'Informe os 11 dígitos do CPF.',
    }),
  )
  .refine(isValidCpf, {
    error: 'Informe um CPF válido.',
  })

const emailSchema = z
  .string()
  .trim()
  .pipe(
    z.email({ error: 'Informe um email válido.' }).max(55, {
      error: 'O email deve ter no máximo 55 caracteres.',
    }),
  )

const phoneSchema = z
  .string()
  .trim()
  .transform(value => value.replaceAll(/[()\-\s]/g, ''))
  .pipe(
    z.string().regex(/^\d{11}$/, {
      error: 'Informe o telefone com DDD e 11 dígitos.',
    }),
  )

export const requestRegistrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, { error: 'Informe seu nome completo.' })
    .max(255, { error: 'O nome deve ter no máximo 255 caracteres.' }),
  documentNumber: cpfSchema,
  email: emailSchema,
  phone: phoneSchema,
  birthDate: z.iso.date({ error: 'Informe uma data de nascimento válida.' }),
})

export type RequestRegistrationInput = z.input<typeof requestRegistrationSchema>
export type RequestRegistrationData = z.output<typeof requestRegistrationSchema>
export type RequestRegistrationFields = keyof RequestRegistrationData

export const completeRegistrationSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, {
    error: 'O link de confirmação é inválido.',
  }),
  password: z
    .string()
    .min(15, {
      error: 'A senha deve ter pelo menos 15 caracteres.',
    })
    .max(128, {
      error: 'A senha deve ter no máximo 128 caracteres.',
    }),
})

export type CompleteRegistrationInput = z.input<
  typeof completeRegistrationSchema
>
export type CompleteRegistrationData = z.output<
  typeof completeRegistrationSchema
>
export type CompleteRegistrationFields = keyof CompleteRegistrationData

export const loginSchema = z.object({
  login: cpfSchema,
  password: z.string().min(1, { error: 'Informe sua senha.' }),
})

export type LoginInput = z.input<typeof loginSchema>
export type LoginData = z.output<typeof loginSchema>
export type LoginFields = keyof LoginData
