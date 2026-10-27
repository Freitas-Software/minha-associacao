import z from 'zod'
import {
  cpfSchema,
  passwordSchema,
} from '@/modules/identity/registration.schema'

export const loginSchema = z.object({
  login: cpfSchema,
  password: z
    .string()
    .min(1, { error: 'Informe sua senha.' })
    .max(128, { error: 'A senha deve ter no máximo 128 caracteres.' }),
})

export type LoginInput = z.input<typeof loginSchema>
export type LoginData = z.output<typeof loginSchema>
export type LoginFields = keyof LoginData

export const requestPasswordResetSchema = z.object({
  documentNumber: cpfSchema,
})

export type RequestPasswordResetInput = z.input<
  typeof requestPasswordResetSchema
>
export type RequestPasswordResetData = z.output<
  typeof requestPasswordResetSchema
>
export type RequestPasswordResetFields = keyof RequestPasswordResetData

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, {
    error: 'O link de recuperação é inválido.',
  }),
  password: passwordSchema,
})

export type ResetPasswordInput = z.input<typeof resetPasswordSchema>
export type ResetPasswordData = z.output<typeof resetPasswordSchema>
export type ResetPasswordFields = keyof ResetPasswordData
