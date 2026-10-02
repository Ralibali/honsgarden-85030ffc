import React, { lazy, Suspense } from 'react';
import { useSeo } from '@/hooks/useSeo';
import LandingNavbar from '@/components/LandingNavbar';
import ContextualShopCta from '@/components/ContextualShopCta';
import DigitalGuideCard from '@/components/blog/DigitalGuideCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Check, Egg, Bird, Wheat, CalendarDays, Calculator, BarChart3, ClipboardCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { SEO_LANDING_PAGES } from '@/data/seoLandingPages.mjs';

const LandingFooter = lazy(() => import('@/components/LandingFooter'));
const StickyMobileCTA = lazy(() => import('@/components/StickyMobileCTA'));

type PageKey = 'app-for-honsagare' | 'agglogg' | 'honskalender' | 'foderkostnad-hons' | 'klackningskalender' | 'borja-med-hons';

interface LandingPageData {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  heroBullets: string[];
  sections: { title: string; body: string; bullets?: string[] }[];
  practicalTips: string[];
  faq: { q: string; a: string }[];
}

const pages = SEO_LANDING_PAGES as Record<PageKey, LandingPageData>;
const pageIcons: Record<PageKey, React.ElementType> = {
  'app-for-honsagare': Bird, agglogg: Egg, honskalender: CalendarDays,
  'foderkostnad-hons': Wheat, klackningskalender: Egg, 'borja-med-hons': Bird,
};

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.42, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  };
}

export function SeoLandingPage({ pageKey }: { pageKey: PageKey }) {
  const page = pages[pageKey];
  const Icon = pageIcons[pageKey];

  useSeo({
    title: page.title,
    description: page.description,
    path: page.path,
    ogImage: 'https://honsgarden.se/blog-images/hens-garden.jpg',
    jsonLd: [
      {
        '@type': 'WebPage',
        name: page.h1,
        description: page.description,
        url: `https://honsgarden.se${page.path}`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: page.faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  });

  return (
    <main id="main-content" tabIndex={-1} className="min-h-dvh bg-background overflow-x-hidden">
      <Suspense fallback={null}><StickyMobileCTA /></Suspense>
      <LandingNavbar />

      <section className="relative pt-24 pb-14 sm:pt-32 sm:pb-20" style={{ background: 'linear-gradient(135deg, #f5f0e8 0%, #eef5ec 55%, #f5f0e8 100%)' }}>
        <div className="container max-w-6xl mx-auto px-5 sm:px-6">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-12 items-center">
            <motion.div {...fadeUp()}>
              <Badge className="bg-primary/10 text-primary border-primary/20 mb-4">{page.eyebrow}</Badge>
              <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl leading-[1.07] text-foreground mb-5">
                {page.h1}
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-6 max-w-2xl">
                {page.intro}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <Button asChild size="lg" className="h-12 px-7 gap-2 rounded-xl">
                  <a href="/login?mode=register">{page.primaryCta}<ArrowRight className="h-4 w-4" /></a>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 px-7 rounded-xl border-primary/30 text-primary hover:bg-primary/5">
                  <a href={page.secondaryCta.includes('foder') ? '/foderkostnad-hons' : page.secondaryCta.includes('ägg') || page.secondaryCta.includes('äggloggen') ? '/agglogg' : page.secondaryCta.includes('hönskalender') ? '/honskalender' : '/app-for-honsagare'}>{page.secondaryCta}</a>
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {page.heroBullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-2 rounded-xl bg-background/70 border border-border/50 p-3 text-sm text-foreground">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.08)} className="relative">
              <Card className="rounded-[2rem] border-primary/15 bg-card/80 shadow-xl overflow-hidden">
                <CardContent className="p-6 sm:p-8">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <p className="data-label mb-2">Praktiskt i vardagen</p>
                  <h2 className="font-serif text-2xl text-foreground mb-4">Det ska vara enkelt att göra rätt saker i tid</h2>
                  <div className="space-y-3">
                    {page.practicalTips.slice(0, 4).map((tip) => (
                      <div key={tip} className="flex gap-3 rounded-xl bg-muted/35 border border-border/40 p-3">
                        <span className="text-lg">🐔</span>
                        <p className="text-sm text-muted-foreground leading-relaxed">{tip}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-background">
        <div className="container max-w-5xl mx-auto px-5 sm:px-6 space-y-5">
          {page.sections.map((section, index) => (
            <motion.article key={section.title} {...fadeUp(index * 0.06)} className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  {[ClipboardCheck, Calculator, BarChart3][index % 3] && React.createElement([ClipboardCheck, Calculator, BarChart3][index % 3], { className: 'h-5 w-5 text-primary' })}
                </div>
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-2">{section.title}</h2>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{section.body}</p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="py-14 sm:py-20" style={{ background: 'linear-gradient(180deg, hsl(var(--secondary)/0.25), hsl(var(--background)))' }}>
        <div className="container max-w-5xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center mb-8">
            <h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">Råd från hönsgården</h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">Små rutiner gör stor skillnad när man vill förstå sin flock och slippa gissa.</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {page.practicalTips.map((tip) => (
              <div key={tip} className="rounded-2xl bg-card border border-border p-4 flex gap-3 shadow-sm">
                <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {pageKey === 'borja-med-hons' && (
        <section className="pb-4 bg-background">
          <div className="container max-w-3xl mx-auto px-5 sm:px-6">
            <DigitalGuideCard placement="beginner_guide" />
            <ContextualShopCta path="/borja-med-hons" />
          </div>
        </section>
      )}

      <section className="py-14 sm:py-20 bg-background">
        <div className="container max-w-3xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center mb-8">
            <h2 className="font-serif text-2xl sm:text-4xl text-foreground">Vanliga frågor</h2>
          </motion.div>
          <div className="space-y-3">
            {page.faq.map((item) => (
              <Card key={item.q} className="border-border shadow-sm">
                <CardContent className="p-5">
                  <h3 className="font-serif text-lg text-foreground mb-2">{item.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-14 sm:pb-20 bg-background">
        <div className="container max-w-4xl mx-auto px-5 sm:px-6">
          <div className="rounded-3xl bg-gradient-to-br from-primary/12 via-accent/5 to-warning/5 border border-primary/15 p-7 sm:p-10 text-center">
            <span className="text-5xl block mb-4">🥚</span>
            <h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">Börja enkelt – bygg erfarenhet över tid</h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed">
              Du behöver inte fylla i allt direkt. Börja med dagens ägg eller din första höna, så växer Hönsgården med din flock.
            </p>
            <Button asChild size="lg" className="h-12 px-8 rounded-xl gap-2">
              <a href="/login?mode=register">Skapa konto gratis<ArrowRight className="h-4 w-4" /></a>
            </Button>
          </div>
        </div>
      </section>

      <Suspense fallback={null}><LandingFooter /></Suspense>
    </main>
  );
}

export default SeoLandingPage;
