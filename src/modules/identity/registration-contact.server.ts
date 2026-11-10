import 'server-only'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '@/db'
import {
  organizations,
  registrationContactConflicts,
  registrationRequests,
  roles,
} from '@/db/schema'
import { maskCpf } from '@/lib/formatters'
import { hashRegistrationToken } from './registration-token.server'

export type RegistrationContactConflict = {
  id: string
  organizationName: string
  email: string
  phone: string
}

export type RegistrationContactContext = {
  currentEmail: string
  currentPhone: string
  conflicts: RegistrationContactConflict[]
  documentNumberMasked: string
  organization: {
    legalName: string
    acronym: string
  } | null
  roleName: string | null
}

export async function getRegistrationContactContext(
  token: string,
  database: typeof db = db,
): Promise<RegistrationContactContext | null> {
  const tokenHash = hashRegistrationToken(token)

  const [request] = await database
    .select({
      userId: registrationRequests.userId,
      email: registrationRequests.email,
      phone: registrationRequests.phone,
      documentNumber: registrationRequests.documentNumber,
      organizationLegalName: organizations.legalName,
      organizationAcronym: organizations.acronym,
      roleName: roles.name,
    })
    .from(registrationRequests)
    .leftJoin(
      organizations,
      eq(organizations.id, registrationRequests.organizationId),
    )
    .leftJoin(
      roles,
      and(
        eq(roles.id, registrationRequests.roleId),
        eq(roles.organizationId, registrationRequests.organizationId),
      ),
    )
    .where(
      and(
        eq(registrationRequests.tokenHash, tokenHash),
        isNull(registrationRequests.consumedAt),
        isNull(registrationRequests.invalidatedAt),
        gt(registrationRequests.expiresAt, new Date()),
      ),
    )
    .limit(1)

  if (!request) return null

  const conflicts = request.userId
    ? await database
        .select({
          id: registrationContactConflicts.id,
          organizationName: organizations.legalName,
          email: registrationContactConflicts.email,
          phone: registrationContactConflicts.phone,
        })
        .from(registrationContactConflicts)
        .innerJoin(
          organizations,
          eq(organizations.id, registrationContactConflicts.organizationId),
        )
        .where(
          and(
            eq(registrationContactConflicts.userId, request.userId),
            isNull(registrationContactConflicts.resolvedAt),
          ),
        )
        .orderBy(registrationContactConflicts.createdAt)
    : []

  return {
    currentEmail: request.email,
    currentPhone: request.phone,
    conflicts,
    documentNumberMasked: maskCpf(request.documentNumber),
    organization:
      request.organizationLegalName !== null &&
      request.organizationAcronym !== null
        ? {
            legalName: request.organizationLegalName,
            acronym: request.organizationAcronym,
          }
        : null,
    roleName: request.roleName,
  }
}
