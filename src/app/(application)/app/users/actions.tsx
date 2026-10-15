'use server'

import { revalidatePath } from 'next/cache'
import z from 'zod'
import { db } from '@/db'
import { users } from '@/db/schema'
import { type CreateUserResult, createUserFormSchema } from './schema'

export async function createUser(data: unknown): Promise<CreateUserResult> {
  const parsed = createUserFormSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      message: 'Confira os campos informados.',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  try {
    await db.insert(users).values(parsed.data)
  } catch (error) {
    // Drizzle wraps the PostgreSQL error in cause.
    const databaseError =
      error instanceof Error && error.cause ? error.cause : error
    if (
      typeof databaseError === 'object' &&
      databaseError !== null &&
      'code' in databaseError &&
      databaseError.code === '23505' &&
      'constraint' in databaseError
    ) {
      switch (databaseError.constraint) {
        case 'users_document_number_unique':
          return {
            success: false,
            message: 'CPF já cadastrado.',
            fieldErrors: { documentNumber: ['CPF já cadastrado.'] },
          }
        case 'users_email_unique':
          return {
            success: false,
            message: 'Email já cadastrado.',
            fieldErrors: { email: ['Email já cadastrado.'] },
          }
        case 'users_phone_unique':
          return {
            success: false,
            message: 'Telefone já cadastrado.',
            fieldErrors: { phone: ['Telefone já cadastrado.'] },
          }
      }
    }
    return {
      success: false,
      message: 'Não foi possível realizar o cadastro. Tente novamente.',
    }
  }

  revalidatePath('/users')
  return { success: true }
}
