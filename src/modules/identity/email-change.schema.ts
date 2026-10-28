import z from 'zod'
import { passwordSchema } from './registration.schema'

export const requestEmailChangeSchema = z.object({
  newEmail: z
    .string()
    .trim()
    .pipe(
      z.email({ error: 'Informe um email válido.' }).max(55, {
        error: 'O email deve ter no máximo 55 caracteres.',
      }),
    ),
  password: passwordSchema,
})

export const confirmEmailChangeSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, {
    error: 'O link de confirmação é inválido.',
  }),
})

export type RequestEmailChangeInput = z.input<typeof requestEmailChangeSchema>
export type RequestEmailChangeData = z.output<typeof requestEmailChangeSchema>
export type ConfirmEmailChangeData = z.output<typeof confirmEmailChangeSchema>
