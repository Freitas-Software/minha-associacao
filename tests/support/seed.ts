import { hash } from '@node-rs/argon2'
import { createPool } from './database'
import {
  ADMIN,
  ADMIN_ACCOUNT_ID,
  ADMIN_USER_ID,
  DEFAULT_ROLE_ID,
  ORGANIZATION,
  ORGANIZATION_ID,
  PRESIDENT,
  PRESIDENT_ACCOUNT_ID,
  PRESIDENT_MEMBERSHIP_ID,
  PRESIDENT_ROLE_ID,
  PRESIDENT_USER_ID,
  TEST_PASSWORD,
} from './fixtures'

export async function hashTestPassword(password: string = TEST_PASSWORD) {
  return hash(password, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  })
}

/**
 * Inserts a platform admin plus an active association led by a full-access
 * president. Both accounts share the same known password.
 */
export async function seedTestData(databaseUrl: string) {
  const pool = createPool(databaseUrl)
  const passwordHash = await hashTestPassword()

  try {
    await pool.query(
      `INSERT INTO accounts (id, login, password_hash)
       VALUES ($1, $2, $3), ($4, $5, $3)`,
      [
        PRESIDENT_ACCOUNT_ID,
        PRESIDENT.cpf,
        passwordHash,
        ADMIN_ACCOUNT_ID,
        ADMIN.cpf,
      ],
    )

    await pool.query(
      `INSERT INTO users
         (id, "accountId", name, document_number, email, email_verified_at, phone, birth_date)
       VALUES
         ($1, $2, $3, $4, $5, now(), $6, $7),
         ($8, $9, $10, $11, $12, now(), $13, $14)`,
      [
        PRESIDENT_USER_ID,
        PRESIDENT_ACCOUNT_ID,
        PRESIDENT.name,
        PRESIDENT.cpf,
        PRESIDENT.email,
        PRESIDENT.phone,
        PRESIDENT.birthDate,
        ADMIN_USER_ID,
        ADMIN_ACCOUNT_ID,
        ADMIN.name,
        ADMIN.cpf,
        ADMIN.email,
        ADMIN.phone,
        ADMIN.birthDate,
      ],
    )

    await pool.query(
      `INSERT INTO platform_admins (user_id, granted_by_user_id)
       VALUES ($1, $1)`,
      [ADMIN_USER_ID],
    )

    await pool.query(
      `INSERT INTO organizations
         (id, cnpj, legal_name, acronym, status, cnpj_verified_at,
          created_by_user_id, activated_at)
       VALUES ($1, $2, $3, $4, 'active', now(), $5, now())`,
      [
        ORGANIZATION_ID,
        ORGANIZATION.cnpj,
        ORGANIZATION.legalName,
        ORGANIZATION.acronym,
        ADMIN_USER_ID,
      ],
    )

    await pool.query(
      `INSERT INTO roles
         (id, organization_id, name, is_director, has_full_access, is_default)
       VALUES
         ($1, $2, $3, true, true, false),
         ($4, $2, $5, false, false, true)`,
      [
        PRESIDENT_ROLE_ID,
        ORGANIZATION_ID,
        ORGANIZATION.presidentRoleName,
        DEFAULT_ROLE_ID,
        ORGANIZATION.defaultRoleName,
      ],
    )

    await pool.query(
      `INSERT INTO memberships
         (id, organization_id, user_id, role_id, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [
        PRESIDENT_MEMBERSHIP_ID,
        ORGANIZATION_ID,
        PRESIDENT_USER_ID,
        PRESIDENT_ROLE_ID,
      ],
    )
  } finally {
    await pool.end()
  }
}
