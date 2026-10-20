import { LandingAbout } from './components/about'
import { LandingCallToAction } from './components/call-to-action'
import { LandingFaq } from './components/faq'
import { LandingFeatures } from './components/features'
import { LandingHero } from './components/hero'
import { LandingTestimonials } from './components/testimonials'

export default function LandingPage() {
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
