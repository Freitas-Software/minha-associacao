import z from 'zod'
import { passwordSchema } from './registration.schema'

export const changePasswordSchema = z
  .object({
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
    passwordConfirmation: passwordSchema,
  })
  .refine(value => value.newPassword === value.passwordConfirmation, {
    error: 'As senhas novas precisam ser iguais.',
    path: ['passwordConfirmation'],
  })

export type ChangePasswordInput = z.input<typeof changePasswordSchema>
export type ChangePasswordData = z.output<typeof changePasswordSchema>
