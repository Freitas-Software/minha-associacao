/** Deterministic data shared by Playwright specs and the seed helper. */
export const TEST_PASSWORD = 'Associae@Teste2026'

export const PRESIDENT_USER_ID = '0199a6a0-0000-7000-8000-000000000001'
export const PRESIDENT_ACCOUNT_ID = '0199a6a0-0000-7000-8000-000000000002'
export const PRESIDENT_MEMBERSHIP_ID = '0199a6a0-0000-7000-8000-000000000003'
export const ADMIN_USER_ID = '0199a6a0-0000-7000-8000-000000000004'
export const ADMIN_ACCOUNT_ID = '0199a6a0-0000-7000-8000-000000000005'
export const ORGANIZATION_ID = '0199a6a0-0000-7000-8000-000000000006'
export const PRESIDENT_ROLE_ID = '0199a6a0-0000-7000-8000-000000000007'
export const DEFAULT_ROLE_ID = '0199a6a0-0000-7000-8000-000000000008'

export const PRESIDENT = {
  cpf: '52998224725',
  email: 'presidente.e2e@example.test',
  name: 'Presidente E2E',
  phone: '11999990001',
  birthDate: '1985-05-05',
} as const

export const ADMIN = {
  cpf: '11144477735',
  email: 'admin.e2e@example.test',
  name: 'Administrador E2E',
  phone: '11999990002',
  birthDate: '1980-01-01',
} as const

export const ORGANIZATION = {
  cnpj: '11222333000181',
  legalName: 'Associação Teste E2E',
  acronym: 'ATE',
  presidentRoleName: 'Presidente',
  defaultRoleName: 'Associado',
} as const
