import { ArrowRight, Check, Play } from 'lucide-react';
import ProductDashboardPreview from '@/components/ProductDashboardPreview';

function trackHeroCta() {
  void import('@/lib/analytics').then(({ trackEvent }) =>
    trackEvent('CTA Register Clicked', { source: 'landing_hero' }),
  );
}

const trust = ['7 dagar Plus gratis', 'Inga kortuppgifter'];

export default function LandingHeroV3() {
  return (
    <section className="hg-hero relative pt-28 pb-16 sm:pt-32 sm:pb-24" aria-labelledby="hg-hero-heading">
      <div className="hg-hero__photo" aria-hidden />
      <div className="hg-hero__veil" aria-hidden />

      <div className="container max-w-6xl mx-auto px-5 sm:px-6">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
          <div>
            <p className="hg-eyebrow mb-5">
              Svensk app för hönsägare
            </p>

            <h1
              id="hg-hero-heading"
              className="text-[2.6rem] leading-[1.02] sm:text-6xl lg:text-[4.4rem] mb-5"
            >
              Lite enklare att ha höns.
              <br />
              <span style={{ color: 'var(--hg-sage-deep)' }}>Lite roligare att följa dem.</span>
            </h1>

            <p
              className="max-w-xl text-base sm:text-lg leading-relaxed"
              style={{ color: 'var(--hg-ink-soft)' }}
            >
              Ägglogg, hönsprofiler, foderkostnad, kalender och Agdas äggbod på ett ställe. Logga
              vardagen, se mönstren och sälj ägg utan Excel-kaos.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a
                href="/login?mode=register"
                onClick={trackHeroCta}
                className="hg-cta-primary inline-flex items-center justify-center gap-2 h-13 min-h-[52px] px-8 text-base font-medium transition-colors"
              >
                Kom igång gratis <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/demo"
                className="hg-cta-ghost inline-flex items-center justify-center gap-2 h-13 min-h-[52px] px-7 text-base font-medium transition-colors"
              >
                <Play className="h-4 w-4 fill-current" /> Prova utan konto
              </a>
            </div>

            <ul
              className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
              style={{ color: 'var(--hg-ink-soft)' }}
            >
              {trust.map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4" style={{ color: 'var(--hg-sage-deep)' }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-center lg:justify-end">
            <ProductDashboardPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
