import z from 'zod'
import { PERMISSION_CODES } from '@/modules/authorization/permissions'
import { isValidCnpj, normalizeCnpj } from './cnpj'

export const cnpjSchema = z
  .string()
  .trim()
  .transform(value => normalizeCnpj(value))
  .pipe(
    z.string().length(14, {
      error: 'Informe os 14 dígitos do CNPJ.',
    }),
  )
  .refine(isValidCnpj, {
    error: 'Informe um CNPJ válido.',
  })

export const createOrganizationSchema = z.object({
  cnpj: cnpjSchema,
  acronym: z
    .string()
    .trim()
    .min(2, { error: 'Informe uma sigla com pelo menos 2 caracteres.' })
    .max(32, { error: 'A sigla deve ter no máximo 32 caracteres.' }),
})

export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>
export type CreateOrganizationData = z.output<typeof createOrganizationSchema>

const roleFields = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: 'Informe um nome com pelo menos 2 caracteres.' })
    .max(100, { error: 'O nome deve ter no máximo 100 caracteres.' }),
  isDirector: z.boolean().default(false),
  hasFullAccess: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  permissionCodes: z.array(z.enum(PERMISSION_CODES)).default([]),
})

function roleRefinement(value: {
  isDefault: boolean
  isDirector: boolean
  hasFullAccess: boolean
}): boolean {
  return !(value.isDefault && (value.isDirector || value.hasFullAccess))
}

const defaultRoleRefinementOptions = {
  error:
    'O cargo padrão de ingresso não pode ser de diretoria nem de acesso completo.',
  path: ['isDefault'],
}

export const createRoleSchema = roleFields.refine(
  roleRefinement,
  defaultRoleRefinementOptions,
)

export const updateRoleSchema = roleFields
  .extend({ isActive: z.boolean().default(true) })
  .refine(roleRefinement, defaultRoleRefinementOptions)

export type CreateRoleInput = z.input<typeof createRoleSchema>
export type CreateRoleData = z.output<typeof createRoleSchema>
export type UpdateRoleInput = z.input<typeof updateRoleSchema>
export type UpdateRoleData = z.output<typeof updateRoleSchema>

export const deactivateMembershipSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, { error: 'Informe o motivo da desativação.' })
    .max(500, { error: 'O motivo deve ter no máximo 500 caracteres.' }),
})

export type DeactivateMembershipData = z.output<
  typeof deactivateMembershipSchema
>
