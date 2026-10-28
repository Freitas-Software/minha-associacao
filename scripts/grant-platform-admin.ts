import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from '../src/db'
import { platformAdmins, users } from '../src/db/schema'

async function main(): Promise<void> {
  const email = process.argv[2] ?? process.env.PLATFORM_ADMIN_EMAIL

  if (!email) {
    throw new Error(
      'Informe o email do usuário: pnpm platform-admin:grant <email>',
    )
  }

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!user) {
    throw new Error('Usuário não encontrado com este email.')
  }

  await db
    .insert(platformAdmins)
    .values({ userId: user.id })
    .onConflictDoNothing()

  console.log(`Administrador da plataforma concedido a ${user.email}.`)
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Não foi possível conceder o acesso.',
  )

  process.exitCode = 1
})
