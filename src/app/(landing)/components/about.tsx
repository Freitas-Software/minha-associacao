import Image from 'next/image'

export function LandingAbout() {
  return (
    <section id="como-funciona">
      <div className="mx-auto grid min-h-svh max-w-[1376px] content-center items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-2 lg:py-10">
        <div>
          <p className="mb-3 text-xs font-medium tracking-widest text-primary sm:text-sm">
            MAIS TEMPO PARA O QUE REALMENTE IMPORTA
          </p>
          <h2 className="max-w-xl text-3xl leading-[1.12] font-bold tracking-[-0.04em] sm:text-4xl lg:text-5xl">
            Fortalecendo associações
            <br />e <span className="text-primary">comunidades</span>
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Sabemos que por trás de cada associação existe um grupo de pessoas
            comprometidas com um propósito. O Minha Associação existe para
            facilitar a gestão e dar mais tempo para o que realmente importa:
            transformar a realidade da sua comunidade.
          </p>
        </div>
        <Image
          src="/images/landing/community.png"
          alt="Pessoas abraçadas, lado a lado, contemplando uma paisagem ao pôr do sol"
          width={1448}
          height={1086}
          sizes="(min-width: 1376px) 632px, (min-width: 1024px) 50vw, 100vw"
          className="h-auto w-full rounded-3xl"
        />
      </div>
    </section>
  )
}
