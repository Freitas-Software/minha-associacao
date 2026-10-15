import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LandingBrand } from './brand'
import { landingNavigation } from './navigation'
import { LandingThemeToggle } from './theme-toggle'

export function LandingHeader() {
  return (
    <header className="border-b border-border/40 bg-background">
      <div className="mx-auto flex max-w-[1376px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <LandingBrand />
        <nav
          aria-label="Navegação principal"
          className="order-3 w-full md:order-none md:w-auto"
        >
          <ul className="flex flex-wrap gap-x-6 gap-y-3">
            {landingNavigation.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="rounded-sm text-sm text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          <LandingThemeToggle />
          <Button
            nativeButton={false}
            variant="outline"
            className="rounded-full border-primary/40 px-5 shadow-none"
            render={<Link href="/app" />}
          >
            Acessar app
          </Button>
        </div>
      </div>
    </header>
  )
}
