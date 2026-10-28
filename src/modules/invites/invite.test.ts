import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'
import {
  acceptInvite,
  createInvite,
  getInviteManagementData,
  resendInvite,
  revokeInvite,
  validateInviteToken,
} from './invite.server'

const connectionString = process.env.TEST_DATABASE_URL
const runDatabaseTests = process.env.RUN_DATABASE_TESTS === '1'

const DAY_MS = 24 * 60 * 60 * 1000

test('invite domain on PostgreSQL, using temporary tables', {
  skip: !connectionString || !runDatabaseTests,
}, async t => {
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 3000,
  })
  const database = drizzle({ client: pool, relations: defineRelations(schema) })

  try {
    await pool.query(`
      CREATE TEMP TABLE users (
        id uuid PRIMARY KEY,
        "accountId" uuid,
        name varchar(255) NOT NULL,
        document_number varchar(11) NOT NULL UNIQUE,
        email varchar(55) NOT NULL UNIQUE,
        email_verified_at timestamptz,
        phone varchar(11) NOT NULL UNIQUE,
        birth_date date NOT NULL,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      CREATE TEMP TABLE organizations (
        id uuid PRIMARY KEY,
        cnpj varchar(14) NOT NULL UNIQUE,
        legal_name varchar(255) NOT NULL,
        acronym varchar(32) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'provisioning',
        cnpj_verified_at timestamptz,
        created_by_user_id uuid NOT NULL,
        activated_at timestamptz,
        created_at timestamptz DEFAULT now() NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL
      );
      CREATE TEMP TABLE roles (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL,
        name varchar(100) NOT NULL,
        is_director boolean DEFAULT false NOT NULL,
        has_full_access boolean DEFAULT false NOT NULL,
        is_default boolean DEFAULT false NOT NULL,
        is_active boolean DEFAULT true NOT NULL,
        created_at timestamptz DEFAULT now() NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT roles_organization_id_name_unique UNIQUE (organization_id, name),
        CONSTRAINT roles_id_organization_id_unique UNIQUE (id, organization_id)
      );
      CREATE UNIQUE INDEX roles_organization_id_default_unique
        ON roles (organization_id) WHERE is_default and is_active;
      CREATE TEMP TABLE memberships (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL,
        user_id uuid NOT NULL,
        role_id uuid NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        joined_at timestamptz DEFAULT now() NOT NULL,
        deactivated_at timestamptz,
        deactivated_by_user_id uuid,
        deactivation_reason varchar(500),
        created_at timestamptz DEFAULT now() NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT memberships_organization_id_user_id_unique UNIQUE (organization_id, user_id)
      );
      CREATE TEMP TABLE invites (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL,
        role_id uuid,
        type varchar(20) NOT NULL,
        document_number varchar(11),
        token_hash varchar(64) NOT NULL UNIQUE,
        max_uses integer,
        uses_count integer DEFAULT 0 NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        created_by_user_id uuid NOT NULL,
        created_by_membership_id uuid,
        created_at timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT invites_type_document_check CHECK (
          (type = 'individual' and document_number is not null) or
          (type = 'shared' and document_number is null)
        ),
        CONSTRAINT invites_uses_check CHECK (
          uses_count >= 0 and (max_uses is null or (max_uses > 0 and uses_count <= max_uses))
        )
      );
      CREATE TEMP TABLE invite_redemptions (
        id uuid PRIMARY KEY,
        invite_id uuid NOT NULL,
        user_id uuid NOT NULL,
        membership_id uuid NOT NULL,
        redeemed_at timestamptz DEFAULT now() NOT NULL
      );
      CREATE TEMP TABLE audit_events (
        id uuid PRIMARY KEY,
        actor_user_id uuid,
        organization_id uuid,
        action varchar(100) NOT NULL,
        entity_type varchar(50) NOT NULL,
        entity_id varchar(100),
        metadata jsonb DEFAULT '{}' NOT NULL,
        created_at timestamptz DEFAULT now() NOT NULL
      )
    `)

    let userCounter = 0

    async function createUser(label: string) {
      userCounter += 1
      const id = randomUUID()
      const suffix = String(userCounter).padStart(6, '0')

      await pool.query(
        `INSERT INTO pg_temp.users
          (id, "accountId", name, document_number, email, email_verified_at, phone, birth_date)
         VALUES ($1, $2, $3, $4, $5, now(), $6, $7)`,
        [
          id,
          randomUUID(),
          label,
          `7${suffix}0000`,
          `${label}.${suffix}@example.test`,
          `118${suffix}00`,
          '1990-01-01',
        ],
      )

      return id
    }

    async function getDocument(userId: string) {
      const result = await pool.query<{ document_number: string }>(
        'SELECT document_number FROM pg_temp.users WHERE id = $1',
        [userId],
      )

      return result.rows[0].document_number
    }

    async function createOrganization() {
      const id = randomUUID()

      await pool.query(
        `INSERT INTO pg_temp.organizations
          (id, cnpj, legal_name, acronym, status, created_by_user_id)
         VALUES ($1, $2, $3, $4, 'active', $5)`,
        [id, '11222333000181', 'Association Test', 'AT', randomUUID()],
      )

      return id
    }

    async function createRole(
      organizationId: string,
      input: {
        name: string
        isDirector?: boolean
        hasFullAccess?: boolean
        isDefault?: boolean
      },
    ) {
      const id = randomUUID()

      await pool.query(
        `INSERT INTO pg_temp.roles
          (id, organization_id, name, is_director, has_full_access, is_default)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          organizationId,
          input.name,
          input.isDirector ?? false,
          input.hasFullAccess ?? false,
          input.isDefault ?? false,
        ],
      )

      return id
    }

    async function createMembership(
      organizationId: string,
      userId: string,
      roleId: string,
    ) {
      const id = randomUUID()

      await pool.query(
        `INSERT INTO pg_temp.memberships
          (id, organization_id, user_id, role_id, status)
         VALUES ($1, $2, $3, $4, 'active')`,
        [id, organizationId, userId, roleId],
      )

      return id
    }

    const actorId = await createUser('actor')
    const organizationId = await createOrganization()
    const fullAccessRoleId = await createRole(organizationId, {
      name: 'Presidente',
      hasFullAccess: true,
    })
    const defaultRoleId = await createRole(organizationId, {
      name: 'Associado',
      isDefault: true,
    })
    await createMembership(organizationId, actorId, fullAccessRoleId)

    await t.test('creates and accepts an individual invite', async () => {
      const inviteeId = await createUser('invitee')
      const documentNumber = await getDocument(inviteeId)

      const created = await createInvite(
        {
          actorUserId: actorId,
          organizationId,
          type: 'individual',
          roleId: defaultRoleId,
          documentNumber,
          expiresAt: new Date(Date.now() + 7 * DAY_MS),
        },
        database,
      )

      assert.equal(created.status, 'created')

      if (created.status !== 'created') throw new Error('Expected invite')

      const valid = await validateInviteToken(created.token, database)

      assert.ok(valid)
      assert.equal(valid.type, 'individual')
      assert.equal(valid.role?.id, defaultRoleId)

      const accepted = await acceptInvite(inviteeId, created.token, database)

      assert.equal(accepted.status, 'accepted')

      if (accepted.status !== 'accepted') throw new Error('Expected acceptance')

      const memberships = await pool.query<{ role_id: string; status: string }>(
        'SELECT role_id, status FROM pg_temp.memberships WHERE user_id = $1',
        [inviteeId],
      )

      assert.deepEqual(memberships.rows[0], {
        role_id: defaultRoleId,
        status: 'active',
      })

      const invites = await pool.query<{ uses_count: number }>(
        'SELECT uses_count FROM pg_temp.invites WHERE id = $1',
        [created.inviteId],
      )

      assert.equal(invites.rows[0].uses_count, 1)

      assert.deepEqual(await acceptInvite(inviteeId, created.token, database), {
        status: 'already-member',
      })

      const afterSecond = await pool.query<{ uses_count: number }>(
        'SELECT uses_count FROM pg_temp.invites WHERE id = $1',
        [created.inviteId],
      )

      assert.equal(afterSecond.rows[0].uses_count, 1)

      const redemptions = await pool.query(
        'SELECT id FROM pg_temp.invite_redemptions',
      )

      assert.equal(redemptions.rowCount, 1)
    })

    await t.test('rejects an individual invite for another CPF', async () => {
      const inviteeId = await createUser('wrong-target')
      const wrongUser = await createUser('wrong-user')
      const created = await createInvite(
        {
          actorUserId: actorId,
          organizationId,
          type: 'individual',
          roleId: defaultRoleId,
          documentNumber: await getDocument(inviteeId),
          expiresAt: new Date(Date.now() + DAY_MS),
        },
        database,
      )

      if (created.status !== 'created') throw new Error('Expected invite')

      assert.deepEqual(await acceptInvite(wrongUser, created.token, database), {
        status: 'forbidden',
      })

      const accepted = await acceptInvite(inviteeId, created.token, database)

      assert.equal(accepted.status, 'accepted')
    })

    await t.test(
      'shared invite consumes uses and uses the default role',
      async () => {
        const firstId = await createUser('shared-first')
        const secondId = await createUser('shared-second')
        const thirdId = await createUser('shared-third')

        const created = await createInvite(
          {
            actorUserId: actorId,
            organizationId,
            type: 'shared',
            maxUses: 2,
            expiresAt: new Date(Date.now() + 30 * DAY_MS),
          },
          database,
        )

        if (created.status !== 'created') throw new Error('Expected invite')

        const first = await acceptInvite(firstId, created.token, database)

        assert.equal(first.status, 'accepted')

        if (first.status !== 'accepted') throw new Error('Expected acceptance')

        const firstMembership = await pool.query<{ role_id: string }>(
          'SELECT role_id FROM pg_temp.memberships WHERE user_id = $1',
          [firstId],
        )

        assert.equal(firstMembership.rows[0].role_id, defaultRoleId)

        assert.equal(
          (await acceptInvite(secondId, created.token, database)).status,
          'accepted',
        )
        assert.deepEqual(await acceptInvite(thirdId, created.token, database), {
          status: 'invalid',
        })

        const uses = await pool.query<{ uses_count: number }>(
          'SELECT uses_count FROM pg_temp.invites WHERE id = $1',
          [created.inviteId],
        )

        assert.equal(uses.rows[0].uses_count, 2)
      },
    )

    await t.test('shared invite cannot target a privileged role', async () => {
      assert.deepEqual(
        await createInvite(
          {
            actorUserId: actorId,
            organizationId,
            type: 'shared',
            roleId: fullAccessRoleId,
            expiresAt: new Date(Date.now() + DAY_MS),
          },
          database,
        ),
        { status: 'invalid-role' },
      )
    })

    await t.test('revoked and expired invites are rejected', async () => {
      const inviteeId = await createUser('revoked-target')
      const created = await createInvite(
        {
          actorUserId: actorId,
          organizationId,
          type: 'individual',
          roleId: defaultRoleId,
          documentNumber: await getDocument(inviteeId),
          expiresAt: new Date(Date.now() + DAY_MS),
        },
        database,
      )

      if (created.status !== 'created') throw new Error('Expected invite')

      assert.deepEqual(
        await revokeInvite(actorId, created.inviteId, database),
        { status: 'revoked' },
      )
      assert.equal(await validateInviteToken(created.token, database), null)
      assert.deepEqual(await acceptInvite(inviteeId, created.token, database), {
        status: 'invalid',
      })
      assert.deepEqual(
        await revokeInvite(actorId, created.inviteId, database),
        { status: 'already-revoked' },
      )

      const secondId = await createUser('expired-target')
      const second = await createInvite(
        {
          actorUserId: actorId,
          organizationId,
          type: 'individual',
          roleId: defaultRoleId,
          documentNumber: await getDocument(secondId),
          expiresAt: new Date(Date.now() + DAY_MS),
        },
        database,
      )

      if (second.status !== 'created') throw new Error('Expected invite')

      await pool.query(
        "UPDATE pg_temp.invites SET expires_at = now() - interval '1 minute' WHERE id = $1",
        [second.inviteId],
      )

      assert.equal(await validateInviteToken(second.token, database), null)
    })

    await t.test('reactivation consumes a shared invite use', async () => {
      const userId = await createUser('reactivation')
      const created = await createInvite(
        {
          actorUserId: actorId,
          organizationId,
          type: 'shared',
          maxUses: 2,
          expiresAt: new Date(Date.now() + 30 * DAY_MS),
        },
        database,
      )

      if (created.status !== 'created') throw new Error('Expected invite')

      const first = await acceptInvite(userId, created.token, database)

      assert.equal(first.status, 'accepted')

      if (first.status !== 'accepted') throw new Error('Expected acceptance')

      await pool.query(
        "UPDATE pg_temp.memberships SET status = 'inactive' WHERE id = $1",
        [first.membershipId],
      )

      const second = await acceptInvite(userId, created.token, database)

      assert.equal(second.status, 'accepted')

      if (second.status !== 'accepted') throw new Error('Expected reactivation')

      assert.equal(second.membershipId, first.membershipId)

      const membership = await pool.query<{ status: string }>(
        'SELECT status FROM pg_temp.memberships WHERE id = $1',
        [first.membershipId],
      )

      assert.equal(membership.rows[0].status, 'active')

      const uses = await pool.query<{ uses_count: number }>(
        'SELECT uses_count FROM pg_temp.invites WHERE id = $1',
        [created.inviteId],
      )

      assert.equal(uses.rows[0].uses_count, 2)

      const audit = await pool.query<{ action: string }>(
        "SELECT action FROM pg_temp.audit_events WHERE action = 'membership.reactivated'",
      )

      assert.equal(audit.rowCount, 1)
    })
    await t.test(
      'resends an invite and invalidates the previous link',
      async () => {
        const inviteeId = await createUser('resend-target')
        const documentNumber = await getDocument(inviteeId)

        const created = await createInvite(
          {
            actorUserId: actorId,
            organizationId,
            type: 'individual',
            roleId: defaultRoleId,
            documentNumber,
            expiresAt: new Date(Date.now() + 7 * DAY_MS),
          },
          database,
        )

        if (created.status !== 'created') throw new Error('Expected invite')

        assert.deepEqual(
          await resendInvite(
            { actorUserId: actorId, inviteId: created.inviteId },
            database,
          ),
          { status: 'rate-limited' },
        )

        await pool.query(
          "UPDATE pg_temp.invites SET created_at = now() - interval '2 minutes' WHERE id = $1",
          [created.inviteId],
        )

        const resent = await resendInvite(
          { actorUserId: actorId, inviteId: created.inviteId },
          database,
        )

        assert.equal(resent.status, 'resent')

        if (resent.status !== 'resent') throw new Error('Expected resend')

        assert.equal(await validateInviteToken(created.token, database), null)
        assert.ok(await validateInviteToken(resent.token, database))

        const previous = await pool.query<{ revoked_at: Date | null }>(
          'SELECT revoked_at FROM pg_temp.invites WHERE id = $1',
          [created.inviteId],
        )

        assert.notEqual(previous.rows[0].revoked_at, null)

        const audit = await pool.query<{ action: string }>(
          "SELECT action FROM pg_temp.audit_events WHERE action = 'invite.resent'",
        )

        assert.equal(audit.rowCount, 1)
      },
    )
    await t.test('filters and paginates invite management', async () => {
      const filterRoleId = await createRole(organizationId, {
        name: 'Filtro',
      })
      const targetId = await createUser('filter-target')
      const documentNumber = await getDocument(targetId)

      const active = await createInvite(
        {
          actorUserId: actorId,
          organizationId,
          type: 'individual',
          roleId: filterRoleId,
          documentNumber,
          expiresAt: new Date(Date.now() + DAY_MS),
        },
        database,
      )

      const expired = await createInvite(
        {
          actorUserId: actorId,
          organizationId,
          type: 'individual',
          roleId: filterRoleId,
          documentNumber,
          expiresAt: new Date(Date.now() + DAY_MS),
        },
        database,
      )

      const exhausted = await createInvite(
        {
          actorUserId: actorId,
          organizationId,
          type: 'individual',
          roleId: filterRoleId,
          documentNumber,
          expiresAt: new Date(Date.now() + DAY_MS),
        },
        database,
      )

      const revoked = await createInvite(
        {
          actorUserId: actorId,
          organizationId,
          type: 'individual',
          roleId: filterRoleId,
          documentNumber,
          expiresAt: new Date(Date.now() + DAY_MS),
        },
        database,
      )

      if (
        active.status !== 'created' ||
        expired.status !== 'created' ||
        exhausted.status !== 'created' ||
        revoked.status !== 'created'
      ) {
        throw new Error('Expected invites')
      }

      await pool.query(
        "UPDATE pg_temp.invites SET expires_at = now() - interval '1 day' WHERE id = $1",
        [expired.inviteId],
      )
      await pool.query(
        'UPDATE pg_temp.invites SET uses_count = 1 WHERE id = $1',
        [exhausted.inviteId],
      )
      await revokeInvite(actorId, revoked.inviteId, database)

      const all = await getInviteManagementData(
        actorId,
        organizationId,
        { query: 'Filtro' },
        database,
      )

      assert.equal(all.status, 'ok')

      if (all.status !== 'ok') throw new Error('Expected invites')

      assert.equal(all.invites.length, 4)

      for (const [status, expectedId] of [
        ['active', active.inviteId],
        ['expired', expired.inviteId],
        ['exhausted', exhausted.inviteId],
        ['revoked', revoked.inviteId],
      ] as const) {
        const filtered = await getInviteManagementData(
          actorId,
          organizationId,
          { query: 'Filtro', status },
          database,
        )

        assert.equal(filtered.status, 'ok')

        if (filtered.status !== 'ok') throw new Error('Expected invites')

        assert.equal(filtered.invites.length, 1)
        assert.equal(filtered.invites[0].id, expectedId)
      }

      const page = await getInviteManagementData(
        actorId,
        organizationId,
        { query: 'Filtro', limit: 2 },
        database,
      )

      assert.equal(page.status, 'ok')

      if (page.status !== 'ok') throw new Error('Expected invites')

      assert.equal(page.invites.length, 2)

      const outsiderId = await createUser('filter-outsider')

      assert.deepEqual(
        await getInviteManagementData(outsiderId, organizationId, {}, database),
        { status: 'forbidden' },
      )
    })
  } finally {
    await pool.end()
  }
})
