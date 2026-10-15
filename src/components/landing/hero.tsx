import { ArrowRight, Check } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function LandingHero() {
  return (
    <section className="bg-linear-to-br from-accent/25 via-background to-accent/30">
      <div className="mx-auto grid max-w-[1376px] items-center gap-12 px-5 py-14 sm:px-8 lg:min-h-[620px] lg:grid-cols-2 lg:gap-6 lg:py-16">
        <div>
          <p className="mb-5 inline-flex rounded-full bg-accent/70 px-4 py-2 text-xs font-medium text-primary sm:text-sm">
            Feito para associações e OSCs
          </p>
          <h1 className="text-[clamp(2.5rem,4.3vw,4.25rem)] leading-[1.06] font-bold tracking-[-0.045em]">
            Gestão simples
            <br />
            para associações
            <br />
            <span className="text-primary">que fazem a diferença</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            O Minha Associação ajuda sua organização a se organizar, comunicar,
            administrar e manter tudo em dia, de forma simples e acessível, no
            computador e no celular.
          </p>
          <div className="mt-7 flex flex-col gap-4 sm:flex-row">
            <Button
              nativeButton={false}
              className="h-12 gap-3 rounded-xl px-7 text-sm"
              render={<Link href="/app" />}
            >
              Conhecer a aplicação
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              className="h-12 rounded-xl border-primary/40 px-7 text-sm shadow-none"
              render={<Link href="#recursos" />}
            >
              Conhecer os recursos
            </Button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground sm:text-sm">
            {[
              'Fácil de usar',
              'Acesso em qualquer lugar',
              'Feito para a realidade das OSCs',
            ].map(text => (
              <li key={text} className="flex items-center gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check
                    className="size-3"
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <Image
          src="/images/landing/product-devices.png"
          alt="Ilustração de uma plataforma de gestão no computador e no celular"
          width={1448}
          height={1086}
          sizes="(min-width: 1376px) 644px, (min-width: 1024px) 50vw, 100vw"
          preload
          className="h-auto w-full rounded-3xl"
        />
      </div>
    </section>
  )
}
