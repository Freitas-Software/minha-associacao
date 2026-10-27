import { MessageSquareQuote } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function LandingTestimonials() {
  return (
    <section id="depoimentos">
      <div className="mx-auto flex min-h-svh max-w-[1376px] flex-col justify-center px-5 py-14 sm:px-8">
        <div className="mb-7 text-center">
          <p className="mb-3 text-xs font-medium tracking-wider text-primary sm:text-sm">
            ESPAÇO PARA HISTÓRIAS REAIS
          </p>
          <h2 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
            Cada comunidade tem uma história para contar
          </h2>
          <p className="mt-3 text-muted-foreground">
            Os relatos de organizações que usarem a plataforma serão publicados
            aqui.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            'Organização no dia a dia',
            'Mais tempo para a comunidade',
            'Gestão com transparência',
          ].map(title => (
            <Card
              key={title}
              className="rounded-2xl border border-border py-6 shadow-none ring-0"
            >
              <CardContent>
                <MessageSquareQuote
                  className="mb-3 size-7 text-primary/60"
                  aria-hidden="true"
                />
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Aguardando um depoimento autorizado para compartilhar esta
                  experiência.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
