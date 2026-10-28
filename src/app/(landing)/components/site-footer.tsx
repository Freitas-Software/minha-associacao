import { cacheLife } from 'next/cache'
import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import { LandingBrand } from './brand'
import { FooterReveal } from './footer-reveal'
import { landingNavigation } from './navigation'

type FooterLink = { label: string; href: string }
type SiteFooterProps = { legalLinks?: readonly FooterLink[] }

const linkClass =
  'inline-block rounded-sm py-0.5 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none'

async function CopyrightYear() {
  'use cache'
  cacheLife('hours')
  return new Date().getFullYear()
}

export function SiteFooter({ legalLinks = [] }: SiteFooterProps) {
  return (
    <footer className="relative isolate mt-auto text-foreground">
      <div className="relative h-16 text-accent/40 sm:h-20" aria-hidden="true">
        <svg
          className="absolute inset-0 size-full"
          viewBox="0 0 1536 130"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0 66C180-24 245-7 405 36S622-5 782 11s267 95 427 65 235-85 327-48v102H0Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="bg-accent/40">
        <div className="px-5 pt-2 pb-10 text-center text-sm leading-7">
          <Link
            href="/"
            className="rounded-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Associae
          </Link>
          <p className="text-muted-foreground">
            Mais organização para uma comunidade mais forte.
          </p>
        </div>
        <FooterReveal>
          <div className="mx-auto max-w-[1376px] px-5 pt-8 pb-8 sm:px-8 sm:pt-12">
            <div className="grid gap-10 pb-10 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1.5fr] lg:gap-16">
              <div className="max-w-sm">
                <LandingBrand />
                <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                  Organização para associações e OSCs: gestão, documentos,
                  associados e atividades em um só lugar.
                </p>
              </div>
              <nav aria-label="Navegação institucional">
                <h2 className="mb-5 text-base font-semibold">Institucional</h2>
                <ul className="space-y-3 text-sm">
                  {landingNavigation.map(({ href, label }) => (
                    <li key={href}>
                      <Link className={linkClass} href={href}>
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <section aria-label="Informações legais">
                <h2 className="mb-5 text-base font-semibold">
                  Informações legais
                </h2>
                {legalLinks.length > 0 ? (
                  <ul className="space-y-3 text-sm">
                    {legalLinks.map(({ href, label }) => (
                      <li key={href}>
                        <Link className={linkClass} href={href}>
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                    Os documentos legais ainda não estão disponíveis neste site.
                  </p>
                )}
              </section>
            </div>
            <Separator className="bg-border/70" />
            <div className="flex flex-col gap-3 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                © <CopyrightYear /> Associae. Todos os direitos reservados.
              </p>
              <span lang="pt-BR">Português (Brasil)</span>
            </div>
          </div>
        </FooterReveal>
      </div>
    </footer>
  )
}
