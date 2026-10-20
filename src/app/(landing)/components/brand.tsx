import { UsersRound } from 'lucide-react'
import Link from 'next/link'

export function LandingBrand() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-3 rounded-sm text-lg font-bold leading-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <UsersRound className="size-10 text-primary" aria-hidden="true" />
      <span>
        Minha
        <br />
        Associação
      </span>
    </Link>
  )
}
