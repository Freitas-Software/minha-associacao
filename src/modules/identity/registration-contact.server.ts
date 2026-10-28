import 'server-only'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '@/db'
import {
  organizations,
  registrationContactConflicts,
  registrationRequests,
} from '@/db/schema'
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
    })
    .from(registrationRequests)
    .where(
      and(
        eq(registrationRequests.tokenHash, tokenHash),
        isNull(registrationRequests.consumedAt),
        isNull(registrationRequests.invalidatedAt),
        gt(registrationRequests.expiresAt, new Date()),
      ),
    )
    .limit(1)

  if (!request?.userId) return null

  const conflicts = await database
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

  return {
    currentEmail: request.email,
    currentPhone: request.phone,
    conflicts,
  }
}
