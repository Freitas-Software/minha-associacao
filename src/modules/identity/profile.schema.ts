import z from 'zod'

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, { error: 'Informe seu nome completo.' })
    .max(255, { error: 'O nome deve ter no máximo 255 caracteres.' }),
  phone: z
    .string()
    .trim()
    .transform(value => value.replaceAll(/[()\-\s]/g, ''))
    .pipe(
      z.string().regex(/^\d{11}$/, {
        error: 'Informe o telefone com DDD e 11 dígitos.',
      }),
    ),
})

export type UpdateProfileInput = z.input<typeof updateProfileSchema>
export type UpdateProfileData = z.output<typeof updateProfileSchema>
