import { LandingAbout } from './about'
import { LandingCallToAction } from './call-to-action'
import { LandingFaq } from './faq'
import { LandingFeatures } from './features'
import { LandingHero } from './hero'
import { LandingTestimonials } from './testimonials'

export function LandingHome() {
  return (
    <main>
      <LandingHero />
      <LandingAbout />
      <LandingFeatures />
      <LandingTestimonials />
      <LandingCallToAction />
      <section id="precos" className="scroll-mt-8 px-5 pt-4 pb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          Planos para sua associação
        </h2>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted-foreground">
          Os planos e preços serão apresentados aqui quando estiverem
          disponíveis.
        </p>
      </section>
      <LandingFaq />
    </main>
  )
}
