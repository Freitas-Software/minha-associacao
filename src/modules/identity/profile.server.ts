import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { getDatabaseErrorConstraint } from '@/lib/errors'
import type { UpdateProfileData } from './profile.schema'

export type Profile = {
  id: string
  name: string
  documentNumber: string
  email: string
  emailVerifiedAt: Date | null
  phone: string
  birthDate: string
}

export type UpdateProfileResult =
  | { status: 'updated' }
  | { status: 'not-found' }
  | { status: 'phone-in-use' }

export async function getProfile(
  userId: string,
  database: typeof db = db,
): Promise<Profile | null> {
  const [profile] = await database
    .select({
      id: users.id,
      name: users.name,
      documentNumber: users.documentNumber,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      phone: users.phone,
      birthDate: users.birthDate,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return profile ?? null
}

export async function updateProfile(
  input: {
    userId: string
    data: UpdateProfileData
  },
  database: typeof db = db,
): Promise<UpdateProfileResult> {
  try {
    const [updated] = await database
      .update(users)
      .set({
        name: input.data.name,
        phone: input.data.phone,
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId))
      .returning({ id: users.id })

    return updated ? { status: 'updated' } : { status: 'not-found' }
  } catch (error) {
    const constraint = getDatabaseErrorConstraint(error)

    if (constraint?.includes('users_phone_unique')) {
      return { status: 'phone-in-use' }
    }

    throw error
  }
}
