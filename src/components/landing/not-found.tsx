import {
  ArrowLeft,
  ArrowRight,
  CircleHelp,
  House,
  LayoutGrid,
  Tag,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const suggestions = [
  {
    title: 'Início',
    description:
      'Conheça o Minha Associação e o que ele pode fazer pela sua organização.',
    href: '/',
    icon: House,
  },
  {
    title: 'Recursos',
    description: 'Veja todas as funcionalidades disponíveis.',
    href: '/#recursos',
    icon: LayoutGrid,
  },
  {
    title: 'Preços',
    description: 'Planos simples e transparentes para sua associação.',
    href: '/#precos',
    icon: Tag,
  },
  {
    title: 'FAQ',
    description: 'Tire suas dúvidas mais comuns.',
    href: '/#faq',
    icon: CircleHelp,
  },
]

export function LandingNotFound() {
  return (
    <main className="mx-auto w-[calc(100%-40px)] max-w-[1376px] md:w-[calc(100%-64px)]">
      <section
        className="grid grid-cols-1 items-center gap-0 pt-14 pb-11 md:min-h-[530px] md:grid-cols-2 md:gap-6 md:pt-16 md:pb-10 min-[1200px]:min-h-[570px] min-[1200px]:pl-[54px]"
        aria-labelledby="not-found-title"
      >
        <div className="min-w-0">
          <span className="inline-flex items-center rounded-full bg-accent/40 px-[17px] py-[5px] text-xl leading-[1.4] font-bold text-primary dark:bg-primary/12">
            404
          </span>
          <h1
            id="not-found-title"
            className="mt-[18px] text-[clamp(42px,9vw,64px)] leading-[1.02] font-[750] tracking-[-0.045em] md:text-[clamp(48px,5.2vw,80px)]"
          >
            Página não <span className="block text-primary">encontrada</span>
          </h1>
          <p className="mt-6 max-w-xl text-[clamp(18px,1.57vw,24px)] leading-[1.45] tracking-tight text-muted-foreground md:max-w-[590px]">
            Ops! Parece que a página que você está procurando não existe ou foi
            movida para outro endereço.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 max-[480px]:flex-col max-[480px]:items-stretch md:mt-[34px] md:gap-[22px]">
            <Button
              nativeButton={false}
              className="h-14 gap-2.5 rounded-[14px] px-6 text-base font-semibold md:h-[66px] md:px-[34px] md:text-lg"
              render={<Link href="/" />}
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
              Voltar para o início
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              className="h-14 gap-2.5 rounded-[14px] border-primary/45 px-6 text-base font-semibold text-foreground shadow-none md:h-[66px] md:px-[34px] md:text-lg dark:text-foreground"
              render={<Link href="/#recursos" />}
            >
              Ver recursos
            </Button>
          </div>
        </div>
        <Image
          src="/images/landing/not-found.png"
          alt="Pessoa diante de um notebook, com pontos de interrogação ao redor"
          width={1448}
          height={1086}
          sizes="(min-width: 1376px) 644px, (min-width: 768px) 50vw, 100vw"
          className="mt-8 h-auto w-full rounded-3xl md:mt-0"
          loading="eager"
        />
      </section>
      <section className="pt-4 pb-[30px]" aria-labelledby="suggestions-title">
        <h2
          id="suggestions-title"
          className="mb-[18px] text-2xl font-bold tracking-[-0.04em] md:text-[26px]"
        >
          Talvez você queira
        </h2>
        <div className="grid grid-cols-1 gap-3.5 min-[480px]:grid-cols-2 md:gap-5 min-[1200px]:grid-cols-4">
          {suggestions.map(({ title, description, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="relative flex min-h-[126px] items-start gap-3.5 rounded-[15px] border border-border bg-background p-[18px] transition-colors duration-160 hover:border-primary hover:bg-accent/40 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none min-[480px]:min-h-[146px] md:gap-5 md:p-[21px] dark:hover:bg-primary/12"
            >
              <span className="grid size-[55px] shrink-0 place-items-center rounded-[13px] bg-[#edf5ff] text-primary dark:bg-primary/12">
                <Icon aria-hidden="true" className="size-7" strokeWidth={2.5} />
              </span>
              <div className="min-w-0 pt-[5px]">
                <h3 className="pr-5 text-lg font-semibold tracking-[-0.035em]">
                  {title}
                </h3>
                <p className="mt-1.5 text-sm leading-[1.55] tracking-[-0.02em] text-muted-foreground">
                  {description}
                </p>
              </div>
              <ArrowRight
                aria-hidden="true"
                className="absolute top-[29px] right-[22px] size-[18px] text-primary"
              />
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
