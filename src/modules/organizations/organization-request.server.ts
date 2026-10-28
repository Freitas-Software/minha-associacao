import 'server-only'
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm'
import { db } from '@/db'
import {
  memberships,
  organizationRequests,
  organizations,
  roles,
  users,
} from '@/db/schema'
import { getDatabaseErrorConstraint, isDatabaseError } from '@/lib/errors'
import { recordAuditEvent } from '@/modules/audit/audit.server'
import { isPlatformAdmin } from '@/modules/authorization/authorize.server'
import { isValidCnpj, normalizeCnpj } from './cnpj'
import { lookupCnpj } from './cnpj.server'
import {
  ORGANIZATION_REQUEST_DOCUMENT_TYPES,
  ORGANIZATION_REQUEST_MAX_DOCUMENT_BYTES,
} from './organization-request-limits'

export type OrganizationRequestStatus = 'pending' | 'approved' | 'rejected'

export type RequestOrganizationInput = {
  actorUserId: string
  cnpj: string
  acronym: string
  documentName: string
  documentType: string
  documentSize: number
  documentData: Buffer
}

export type RequestOrganizationResult =
  | { status: 'created'; requestId: string }
  | { status: 'invalid-cnpj' }
  | { status: 'invalid-document' }
  | { status: 'duplicate-organization' }
  | { status: 'pending-request' }
  | { status: 'lookup-failed'; message: string }

export async function requestOrganization(
  input: RequestOrganizationInput,
  database: typeof db = db,
): Promise<RequestOrganizationResult> {
  const cnpj = normalizeCnpj(input.cnpj)

  if (!isValidCnpj(cnpj)) return { status: 'invalid-cnpj' }

  if (
    input.documentSize <= 0 ||
    input.documentSize > ORGANIZATION_REQUEST_MAX_DOCUMENT_BYTES ||
    !ORGANIZATION_REQUEST_DOCUMENT_TYPES.includes(
      input.documentType as (typeof ORGANIZATION_REQUEST_DOCUMENT_TYPES)[number],
    )
  ) {
    return { status: 'invalid-document' }
  }

  const [existingOrganization] = await database
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.cnpj, cnpj))
    .limit(1)

  if (existingOrganization) return { status: 'duplicate-organization' }

  const [existingRequest] = await database
    .select({ id: organizationRequests.id })
    .from(organizationRequests)
    .where(
      and(
        eq(organizationRequests.cnpj, cnpj),
        eq(organizationRequests.status, 'pending'),
      ),
    )
    .limit(1)

  if (existingRequest) return { status: 'pending-request' }

  let lookup: Awaited<ReturnType<typeof lookupCnpj>>

  try {
    lookup = await lookupCnpj(cnpj)
  } catch (error) {
    return {
      status: 'lookup-failed',
      message:
        error instanceof Error
          ? error.message
          : 'Não foi possível consultar o CNPJ.',
    }
  }

  try {
    return await database.transaction(async tx => {
      const [request] = await tx
        .insert(organizationRequests)
        .values({
          requesterUserId: input.actorUserId,
          cnpj: lookup.cnpj,
          legalName: lookup.legalName,
          acronym: input.acronym,
          documentName: input.documentName,
          documentType: input.documentType,
          documentSize: input.documentSize,
          documentData: input.documentData,
        })
        .returning({ id: organizationRequests.id })

      if (!request) {
        throw new Error('A solicitação não retornou um ID.')
      }

      await recordAuditEvent(tx, {
        actorUserId: input.actorUserId,
        organizationId: null,
        action: 'organization.requested',
        entityType: 'organization_request',
        entityId: request.id,
        metadata: { cnpj: lookup.cnpj },
      })

      return { status: 'created' as const, requestId: request.id }
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      const constraint = getDatabaseErrorConstraint(error)

      if (constraint?.includes('organization_requests_pending_cnpj_unique')) {
        return { status: 'pending-request' }
      }
    }

    throw error
  }
}

export type UserOrganizationRequest = {
  id: string
  cnpj: string
  legalName: string
  acronym: string
  status: OrganizationRequestStatus
  rejectionReason: string | null
  organizationId: string | null
  createdAt: Date
  reviewedAt: Date | null
}

export async function listUserOrganizationRequests(
  userId: string,
  database: typeof db = db,
): Promise<UserOrganizationRequest[]> {
  return database
    .select({
      id: organizationRequests.id,
      cnpj: organizationRequests.cnpj,
      legalName: organizationRequests.legalName,
      acronym: organizationRequests.acronym,
      status: organizationRequests.status,
      rejectionReason: organizationRequests.rejectionReason,
      organizationId: organizationRequests.organizationId,
      createdAt: organizationRequests.createdAt,
      reviewedAt: organizationRequests.reviewedAt,
    })
    .from(organizationRequests)
    .where(eq(organizationRequests.requesterUserId, userId))
    .orderBy(desc(organizationRequests.createdAt))
}

export type AdminOrganizationRequest = {
  id: string
  cnpj: string
  legalName: string
  acronym: string
  status: OrganizationRequestStatus
  documentName: string
  documentType: string
  documentSize: number
  requesterName: string
  requesterEmail: string
  organizationId: string | null
  rejectionReason: string | null
  reviewedAt: Date | null
  createdAt: Date
}

export type ListOrganizationRequestsOptions = {
  query?: string
  limit?: number
  offset?: number
}

export async function listOrganizationRequests(
  adminUserId: string,
  status: OrganizationRequestStatus,
  options: ListOrganizationRequestsOptions = {},
  database: typeof db = db,
): Promise<
  | { status: 'ok'; requests: AdminOrganizationRequest[] }
  | { status: 'forbidden' }
> {
  if (!(await isPlatformAdmin(adminUserId, database))) {
    return { status: 'forbidden' }
  }

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100)
  const offset = Math.max(options.offset ?? 0, 0)
  const search = options.query?.trim()
  const documentDigits = search?.replaceAll(/\D/g, '') ?? ''
  const searchCondition = search
    ? or(
        ilike(organizationRequests.legalName, `%${search}%`),
        ilike(organizationRequests.acronym, `%${search}%`),
        ilike(users.name, `%${search}%`),
        ilike(users.email, `%${search}%`),
        ...(documentDigits
          ? [ilike(organizationRequests.cnpj, `%${documentDigits}%`)]
          : []),
      )
    : undefined

  const requests = await database
    .select({
      id: organizationRequests.id,
      cnpj: organizationRequests.cnpj,
      legalName: organizationRequests.legalName,
      acronym: organizationRequests.acronym,
      status: organizationRequests.status,
      documentName: organizationRequests.documentName,
      documentType: organizationRequests.documentType,
      documentSize: organizationRequests.documentSize,
      requesterName: users.name,
      requesterEmail: users.email,
      organizationId: organizationRequests.organizationId,
      rejectionReason: organizationRequests.rejectionReason,
      reviewedAt: organizationRequests.reviewedAt,
      createdAt: organizationRequests.createdAt,
    })
    .from(organizationRequests)
    .innerJoin(users, eq(users.id, organizationRequests.requesterUserId))
    .where(and(eq(organizationRequests.status, status), searchCondition))
    .orderBy(
      status === 'pending'
        ? asc(organizationRequests.createdAt)
        : desc(organizationRequests.createdAt),
    )
    .limit(limit)
    .offset(offset)

  return { status: 'ok', requests }
}

export async function listPendingOrganizationRequests(
  adminUserId: string,
  database: typeof db = db,
): Promise<
  | { status: 'ok'; requests: AdminOrganizationRequest[] }
  | { status: 'forbidden' }
> {
  return listOrganizationRequests(adminUserId, 'pending', {}, database)
}

export type ApproveOrganizationRequestResult =
  | { status: 'approved'; organizationId: string }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'already-reviewed' }
  | { status: 'duplicate-organization' }

export async function approveOrganizationRequest(
  adminUserId: string,
  requestId: string,
  database: typeof db = db,
): Promise<ApproveOrganizationRequestResult> {
  if (!(await isPlatformAdmin(adminUserId, database))) {
    return { status: 'forbidden' }
  }

  try {
    return await database.transaction(async tx => {
      const [request] = await tx
        .select()
        .from(organizationRequests)
        .where(eq(organizationRequests.id, requestId))
        .limit(1)
        .for('update')

      if (!request) return { status: 'not-found' as const }
      if (request.status !== 'pending') {
        return { status: 'already-reviewed' as const }
      }

      const [existingOrganization] = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.cnpj, request.cnpj))
        .limit(1)

      if (existingOrganization) {
        return { status: 'duplicate-organization' as const }
      }

      const now = new Date()
      const [organization] = await tx
        .insert(organizations)
        .values({
          cnpj: request.cnpj,
          legalName: request.legalName,
          acronym: request.acronym,
          status: 'provisioning',
          cnpjVerifiedAt: now,
          createdByUserId: request.requesterUserId,
        })
        .returning({ id: organizations.id })

      if (!organization) {
        throw new Error('A criação da organização não retornou um ID.')
      }

      const [defaultRole] = await tx
        .insert(roles)
        .values({
          organizationId: organization.id,
          name: 'Associado',
          isDefault: true,
        })
        .returning({ id: roles.id })

      const [presidentRole] = await tx
        .insert(roles)
        .values({
          organizationId: organization.id,
          name: 'Presidente',
          isDirector: true,
          hasFullAccess: true,
        })
        .returning({ id: roles.id })

      if (!defaultRole || !presidentRole) {
        throw new Error('A criação dos cargos iniciais falhou.')
      }

      const [membership] = await tx
        .insert(memberships)
        .values({
          organizationId: organization.id,
          userId: request.requesterUserId,
          roleId: presidentRole.id,
          status: 'active',
          joinedAt: now,
        })
        .returning({ id: memberships.id })

      if (!membership) {
        throw new Error('A criação do vínculo do presidente falhou.')
      }

      await tx
        .update(organizationRequests)
        .set({
          status: 'approved',
          reviewedByUserId: adminUserId,
          reviewedAt: now,
          organizationId: organization.id,
          updatedAt: now,
        })
        .where(eq(organizationRequests.id, request.id))

      await recordAuditEvent(tx, {
        actorUserId: adminUserId,
        organizationId: organization.id,
        action: 'organization.request_approved',
        entityType: 'organization_request',
        entityId: request.id,
        metadata: {
          requesterUserId: request.requesterUserId,
          cnpj: request.cnpj,
        },
      })

      await recordAuditEvent(tx, {
        actorUserId: request.requesterUserId,
        organizationId: organization.id,
        action: 'organization.created',
        entityType: 'organization',
        entityId: organization.id,
      })

      return { status: 'approved' as const, organizationId: organization.id }
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return { status: 'duplicate-organization' }
    }

    throw error
  }
}

export type RejectOrganizationRequestResult =
  | { status: 'rejected' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'already-reviewed' }

export async function rejectOrganizationRequest(
  adminUserId: string,
  requestId: string,
  reason: string,
  database: typeof db = db,
): Promise<RejectOrganizationRequestResult> {
  if (!(await isPlatformAdmin(adminUserId, database))) {
    return { status: 'forbidden' }
  }

  return database.transaction(async tx => {
    const [request] = await tx
      .select({
        id: organizationRequests.id,
        status: organizationRequests.status,
      })
      .from(organizationRequests)
      .where(eq(organizationRequests.id, requestId))
      .limit(1)
      .for('update')

    if (!request) return { status: 'not-found' as const }
    if (request.status !== 'pending') {
      return { status: 'already-reviewed' as const }
    }

    const now = new Date()

    await tx
      .update(organizationRequests)
      .set({
        status: 'rejected',
        reviewedByUserId: adminUserId,
        reviewedAt: now,
        rejectionReason: reason,
        updatedAt: now,
      })
      .where(eq(organizationRequests.id, request.id))

    await recordAuditEvent(tx, {
      actorUserId: adminUserId,
      organizationId: null,
      action: 'organization.request_rejected',
      entityType: 'organization_request',
      entityId: request.id,
      metadata: { reason },
    })

    return { status: 'rejected' as const }
  })
}

export type OrganizationRequestDocument =
  | {
      status: 'ok'
      name: string
      type: string
      data: Buffer
    }
  | { status: 'forbidden' }
  | { status: 'not-found' }

export async function getOrganizationRequestDocument(
  adminUserId: string,
  requestId: string,
  database: typeof db = db,
): Promise<OrganizationRequestDocument> {
  if (!(await isPlatformAdmin(adminUserId, database))) {
    return { status: 'forbidden' }
  }

  const [request] = await database
    .select({
      documentName: organizationRequests.documentName,
      documentType: organizationRequests.documentType,
      documentData: organizationRequests.documentData,
    })
    .from(organizationRequests)
    .where(eq(organizationRequests.id, requestId))
    .limit(1)

  if (!request) return { status: 'not-found' }

  return {
    status: 'ok',
    name: request.documentName,
    type: request.documentType,
    data: request.documentData,
  }
}
