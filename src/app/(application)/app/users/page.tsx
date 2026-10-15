import { CreateUserForm } from './components/form'

export default async function UsersPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2">
      <CreateUserForm />
    </main>
  )
}
