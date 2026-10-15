import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AppPage() {
  return (
    <main className="max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">
        Sua aplicação começa aqui
      </h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        Área em desenvolvimento. A autenticação ainda não foi implementada.
      </p>
      <Button
        className="mt-6"
        nativeButton={false}
        render={<Link href="/app/users" />}
      >
        Usuários
      </Button>
    </main>
  )
}
