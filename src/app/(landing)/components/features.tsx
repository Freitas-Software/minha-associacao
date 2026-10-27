import {
  Banknote,
  CalendarDays,
  ChartNoAxesCombined,
  FolderOpen,
  Megaphone,
  UsersRound,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const features = [
  {
    title: 'Gestão de associados',
    description:
      'Mantenha o cadastro dos membros sempre atualizado, com histórico e categorias.',
    icon: UsersRound,
  },
  {
    title: 'Controle financeiro',
    description:
      'Registre receitas, despesas e gere relatórios para uma prestação de contas mais transparente.',
    icon: Banknote,
  },
  {
    title: 'Documentos organizados',
    description:
      'Armazene atas, estatutos, relatórios e outros documentos importantes em um só lugar.',
    icon: FolderOpen,
  },
  {
    title: 'Assembleias e reuniões',
    description:
      'Organize convocações, registre atas e acompanhe deliberações.',
    icon: CalendarDays,
  },
  {
    title: 'Comunicação integrada',
    description:
      'Mantenha seus associados informados com comunicados e notificações.',
    icon: Megaphone,
  },
  {
    title: 'Relatórios e transparência',
    description:
      'Gere relatórios simples e claros para prestação de contas e auditorias.',
    icon: ChartNoAxesCombined,
  },
]

export function LandingFeatures() {
  return (
    <section
      id="recursos"
      className="bg-linear-to-b from-accent/20 to-background"
    >
      <div className="mx-auto flex min-h-svh max-w-[1376px] flex-col justify-center px-5 py-14 sm:px-8">
        <div className="mb-7 text-center">
          <p className="mb-3 text-xs font-medium tracking-wider text-primary sm:text-sm">
            TUDO O QUE SUA ASSOCIAÇÃO PRECISA
          </p>
          <h2 className="text-3xl leading-tight font-bold tracking-[-0.04em] sm:text-4xl">
            Recursos para uma gestão mais{' '}
            <span className="text-primary">simples e eficiente</span>
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Funcionalidades pensadas para a realidade das associações e OSCs.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            A plataforma está em desenvolvimento. Os recursos abaixo apresentam
            a proposta do produto.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ title, description, icon: Icon }) => (
            <Card
              key={title}
              className="rounded-2xl border border-border bg-background/90 py-5 shadow-none ring-0"
            >
              <CardContent className="flex-row items-start gap-5 px-5">
                <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-accent/50 text-primary">
                  <Icon className="size-8" strokeWidth={2} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-semibold tracking-tight">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
