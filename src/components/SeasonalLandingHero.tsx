import { motion } from 'framer-motion';
import { ArrowRight, Check, Play, Sparkles } from 'lucide-react';

function trackHeroCta(action: 'register' | 'explore') {
  if (action !== 'register') return;
  void import('@/lib/analytics').then(({ trackEvent }) =>
    trackEvent('CTA Register Clicked', { source: 'landing_hero' }),
  );
}

export default function SeasonalLandingHero() {
  return (
    <section className="farm-hero-v2 farm-hero-v6" aria-labelledby="farm-hero-heading">
      <div className="farm-hero-v6__scene" aria-hidden="true">
        <div className="farm-hero-v6__sky" />
        <div className="farm-hero-v6__stars farm-hero-v6__stars--far" />
        <div className="farm-hero-v6__stars farm-hero-v6__stars--near" />
        <div className="farm-hero-v6__meteor farm-hero-v6__meteor--one" />
        <div className="farm-hero-v6__meteor farm-hero-v6__meteor--two" />
      </div>

      <div className="farm-hero-v6__content container max-w-6xl mx-auto px-5 sm:px-6">
        <div className="farm-hero-v6__copy">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .55, delay: .08 }}
            className="hero-eyebrow inline-flex items-center gap-2 rounded-full border border-emerald-950/10 bg-white/50 px-3.5 py-2 text-xs font-medium text-emerald-950/80 backdrop-blur-md"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Din hönsgård, året runt
          </motion.div>

          <motion.h1
            id="farm-hero-heading"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .7, delay: .14, ease: [0.16, 1, 0.3, 1] }}
          >
            Lite enklare att ha höns.<br />
            <span>Lite roligare att följa dem.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .65, delay: .22 }}
          >
            Hönsgården hjälper dig hålla koll på flocken, äggen och allt det där lilla – utan att kännas som ännu ett system att administrera.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .65, delay: .3 }}
            className="farm-hero-v6__actions flex flex-col sm:flex-row gap-3"
          >
            <a
              href="/login?mode=register"
              onClick={() => trackHeroCta('register')}
              className="inline-flex items-center justify-center gap-2 font-medium transition-all"
            >
              Kom igång gratis <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#funktioner"
              onClick={() => trackHeroCta('explore')}
              className="inline-flex items-center justify-center gap-2 font-medium transition-all"
            >
              <Play className="h-4 w-4 fill-current" /> Se hur det fungerar
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: .7, delay: .42 }}
            className="hero-trust mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-emerald-950/70"
          >
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Gratis att testa</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Kom igång på 2 minuter</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Inga kortuppgifter</span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
