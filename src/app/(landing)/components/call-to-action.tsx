import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function LandingCallToAction() {
  return (
    <section className="mx-auto flex min-h-svh max-w-[1440px] flex-col justify-center px-5 py-12 sm:px-8">
      <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-accent/50 px-6 py-10 sm:px-12 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-medium tracking-wider text-primary sm:text-sm">
            CONHEÇA A PROPOSTA
          </p>
          <h2 className="text-3xl leading-[1.1] font-bold tracking-[-0.04em] sm:text-4xl">
            Mais organização para uma
            <br className="hidden sm:block" /> comunidade{' '}
            <span className="text-primary">mais forte</span>
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
            Estamos construindo uma forma mais simples de cuidar da sua
            organização e ir mais longe.
          </p>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row">
            <Button
              nativeButton={false}
              className="h-12 gap-3 rounded-xl px-6"
              render={<Link href="/app" />}
            >
              Conhecer a aplicação
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              className="h-12 rounded-xl border-primary/40 px-6 shadow-none"
              render={<Link href="#como-funciona" />}
            >
              Saiba mais
            </Button>
          </div>
        </div>
        {/* The light artwork embeds its own backdrop, so dark mode uses a
            transparent cutout that sits directly on the dark panel. */}
        <Image
          src="/images/landing/teamwork.png"
          alt="Grupo celebrando uma conquista com as mãos unidas no alto"
          width={1448}
          height={1086}
          sizes="(min-width: 1440px) 624px, (min-width: 1024px) 50vw, 100vw"
          className="h-auto w-full rounded-2xl dark:hidden"
        />
        <Image
          src="/images/landing/teamwork-dark.png"
          alt="Grupo celebrando uma conquista com as mãos unidas no alto"
          width={1448}
          height={1086}
          sizes="(min-width: 1440px) 624px, (min-width: 1024px) 50vw, 100vw"
          className="hidden h-auto w-full dark:block"
        />
      </div>
    </section>
  )
}
