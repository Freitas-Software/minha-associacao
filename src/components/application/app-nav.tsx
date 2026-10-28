'use client'

import { cn } from 'cn'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  {
    href: '/app',
    label: 'Início',
    isActive: (path: string) => path === '/app',
  },
  {
    href: '/app/organizacoes',
    label: 'Organizações',
    isActive: (path: string) => path.startsWith('/app/organizacoes'),
  },
  {
    href: '/app/perfil',
    label: 'Perfil',
    isActive: (path: string) => path.startsWith('/app/perfil'),
  },
]

function navLinkClass(active: boolean): string {
  return cn(
    'inline-block rounded-sm px-1 py-1.5 text-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none',
    active ? 'font-medium text-foreground' : 'text-muted-foreground',
  )
}

export function AppNavFallback() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map(item => (
        <li key={item.href}>
          <Link href={item.href} className={navLinkClass(false)}>
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function AppNav() {
  const pathname = usePathname()

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map(item => {
        const active = item.isActive(pathname)

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={navLinkClass(active)}
            >
              {item.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
