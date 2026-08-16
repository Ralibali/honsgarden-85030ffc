import { motion } from 'framer-motion';
import { ArrowRight, Check, Egg, Play } from 'lucide-react';
import ProductDashboardPreview from '@/components/ProductDashboardPreview';

function trackHeroCta() {
  void import('@/lib/analytics').then(({ trackEvent }) =>
    trackEvent('CTA Register Clicked', { source: 'landing_hero' }),
  );
}

const trust = ['Gratis att testa', 'Igång på 2 minuter', 'Inga kortuppgifter'];

/**
 * Startsidans hero, v3: rolig morgonstämning i sage & cream, redaktionell
 * typografi och app-förhandsvisningen som bevis – ingen glasig SaaS-låda.
 */
export default function LandingHeroV3() {
  return (
    <section className="hg-hero relative pt-28 pb-16 sm:pt-32 sm:pb-24" aria-labelledby="hg-hero-heading">
      <div className="hg-hero__photo" aria-hidden />
      <div className="hg-hero__veil" aria-hidden />

      <div className="container max-w-6xl mx-auto px-5 sm:px-6">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="hg-eyebrow mb-5"
            >
              Svensk app för hönsägare
            </motion.p>

            <motion.h1
              id="hg-hero-heading"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="text-[2.6rem] leading-[1.02] sm:text-6xl lg:text-[4.4rem] mb-5"
            >
              Lite enklare att ha höns.
              <br />
              <span style={{ color: '#7d9b76' }}>Lite roligare att följa dem.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.14 }}
              className="max-w-xl text-base sm:text-lg leading-relaxed"
              style={{ color: 'var(--hg-ink-soft)' }}
            >
              Ägglogg, hönsprofiler, foderkostnad, kalender och Agdas äggbod på ett ställe. Logga
              vardagen, se mönstren och sälj ägg utan Excel-kaos.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-8 flex flex-col sm:flex-row gap-3"
            >
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
            </motion.div>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
              style={{ color: 'var(--hg-ink-soft)' }}
            >
              {trust.map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4" style={{ color: '#7d9b76' }} />
                  {item}
                </li>
              ))}
            </motion.ul>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.38 }}
              className="mt-8 flex items-center gap-3"
            >
              <div className="hg-rule flex-1 max-w-[120px]" aria-hidden />
              <span className="hg-chip">
                <Egg className="h-3.5 w-3.5" style={{ color: '#7d9b76' }} />
                Byggd för svenska hönsgårdar, året runt
              </span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="flex justify-center lg:justify-end"
          >
            <ProductDashboardPreview />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
