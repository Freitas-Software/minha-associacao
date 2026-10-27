const questions = [
  {
    title: 'Para quem é o Minha Associação?',
    answer:
      'A proposta da plataforma é apoiar a organização e a gestão de associações e organizações da sociedade civil (OSCs).',
  },
  {
    title: 'A plataforma já está pronta?',
    answer:
      'O Minha Associação está em desenvolvimento. A área da aplicação está sendo preparada e os recursos serão disponibilizados conforme forem implementados.',
  },
  {
    title: 'Já existem planos e preços definidos?',
    answer:
      'Os planos e as condições de uso ainda não foram publicados. As informações serão disponibilizadas nesta página.',
  },
]

export function LandingFaq() {
  return (
    <section id="faq">
      <div className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center px-5 py-14 sm:px-8">
        <h2 className="mb-6 text-center text-3xl font-bold tracking-tight">
          Perguntas frequentes
        </h2>
        <div className="divide-y rounded-2xl border px-5 sm:px-6">
          {questions.map(({ title, answer }) => (
            <details key={title} className="group py-5">
              <summary className="cursor-pointer rounded-sm pr-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                {title}
              </summary>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
