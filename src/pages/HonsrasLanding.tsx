import React, { lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';
import LandingNavbar from '@/components/LandingNavbar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, Bird, Egg } from 'lucide-react';
import { motion } from 'framer-motion';
import { longformPages, type LongformPage } from '@/data/honsraserContent';
import { getBreedLayingRate, DEFAULT_BREED_RATE } from '@/data/breedLayingRates';

const LandingFooter = lazy(() => import('@/components/LandingFooter'));

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.42, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  };
}

interface HonsrasLandingProps {
  slug?: keyof typeof longformPages | string;
  /** Om satt: pekar canonical/og:url dit istället för sidans egen path (används av äldre statiska routes). */
  canonicalPath?: string;
}

export default function HonsrasLanding({ slug, canonicalPath }: HonsrasLandingProps) {
  const params = useParams<{ slug?: string }>();
  const activeSlug = (slug ?? params.slug ?? '') as string;
  const page = longformPages[activeSlug] as LongformPage | undefined;

  const articleJsonLd = page
    ? {
        '@type': 'Article',
        headline: page.h1,
        description: page.description,
        url: `https://honsgarden.se${canonicalPath ?? page.path}`,
        author: { '@type': 'Organization', name: 'Hönsgården' },
        publisher: { '@type': 'Organization', name: 'Hönsgården' },
        inLanguage: 'sv-SE',
      }
    : null;

  const faqJsonLd = page
    ? {
        '@type': 'FAQPage',
        mainEntity: page.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }
    : null;

  useSeo({
    title: page?.title ?? 'Hönsraser',
    description: page?.description ?? '',
    path: canonicalPath ?? page?.path ?? '/honsraser',
    ogType: 'article',
    ogImage: 'https://honsgarden.se/blog-images/hens-garden.jpg',
    jsonLd: page ? [articleJsonLd, faqJsonLd] : [],
  });

  const breedRate = page?.breedName ? getBreedLayingRate(page.breedName) : null;
  const hasBreedRate = !!breedRate && breedRate !== DEFAULT_BREED_RATE;

  if (!page) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Sidan finns inte.</p>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-screen bg-background overflow-x-hidden">
      <LandingNavbar />

      {/* Hero */}
      <section
        className="relative pt-24 pb-12 sm:pt-32 sm:pb-16"
        style={{ background: 'linear-gradient(135deg, #f5f0e8 0%, #eef5ec 55%, #f5f0e8 100%)' }}
      >
        <div className="container max-w-4xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()}>
            <Badge className="bg-primary/10 text-primary border-primary/20 mb-4">{page.eyebrow}</Badge>
            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl leading-[1.07] text-foreground mb-6">
              {page.h1}
            </h1>
            {page.intro.map((p, i) => (
              <p key={i} className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-4 max-w-3xl">
                {p}
              </p>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Värpstat från breedLayingRates.ts */}
      {hasBreedRate && breedRate && (
        <section className="py-6 bg-background">
          <div className="container max-w-4xl mx-auto px-5 sm:px-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-primary/80 font-medium">Typisk värpning</div>
                    <div className="text-2xl font-serif text-foreground">{breedRate.typical}%</div>
                    <div className="text-xs text-muted-foreground">värpprocent (ägg per höna och dag × 100)</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-primary/80 font-medium">Typiskt intervall</div>
                    <div className="text-lg text-foreground">{breedRate.min}–{breedRate.max}%</div>
                    <div className="text-xs text-muted-foreground">för hobbyflock under värpsäsong</div>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Riktvärde från vår ras-databas – används också i äggloggen för att beräkna förväntad värpning.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Innehållsförteckning */}
      <section className="py-8 bg-background">
        <div className="container max-w-4xl mx-auto px-5 sm:px-6">
          <Card className="border-border bg-card/60">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-5 w-5 text-primary" />
                <h2 className="font-serif text-lg text-foreground">I den här guiden</h2>
              </div>
              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                {page.toc.map((item) => (
                  <li key={item} className="text-muted-foreground">— {item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Sektioner */}
      <section className="py-10 sm:py-14 bg-background">
        <div className="container max-w-3xl mx-auto px-5 sm:px-6 space-y-12">
          {page.sections.map((section, idx) => (
            <motion.article key={section.heading} {...fadeUp(idx * 0.04)}>
              <h2 className="font-serif text-2xl sm:text-3xl text-foreground mb-4 leading-tight">
                {section.heading}
              </h2>
              <div className="space-y-4">
                {section.paragraphs.map((p, i) => (
                  <p key={i} className="text-base text-foreground/85 leading-relaxed">
                    {p}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="space-y-2 pt-1">
                    {section.bullets.map((b) => (
                      <li key={b} className="flex gap-2 text-foreground/85 text-base">
                        <span className="text-primary mt-1">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Jämförelsetabell */}
      {page.breedTable && (
        <section
          className="py-12 sm:py-16"
          style={{ background: 'linear-gradient(180deg, hsl(var(--secondary)/0.25), hsl(var(--background)))' }}
        >
          <div className="container max-w-5xl mx-auto px-5 sm:px-6">
            <motion.div {...fadeUp()} className="mb-6">
              <h2 className="font-serif text-2xl sm:text-3xl text-foreground mb-2">Stor jämförelsetabell</h2>
              <p className="text-sm text-muted-foreground">
                Riktvärden för vanliga hönsraser. Värpning och vikt varierar mellan linjer och uppfödare.
              </p>
            </motion.div>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-foreground">
                  <tr>
                    <th className="text-left p-3 font-medium">Ras</th>
                    <th className="text-left p-3 font-medium">Ursprung</th>
                    <th className="text-left p-3 font-medium">Vikt</th>
                    <th className="text-left p-3 font-medium">Ägg/år</th>
                    <th className="text-left p-3 font-medium">Äggfärg</th>
                    <th className="text-left p-3 font-medium">Temperament</th>
                    <th className="text-left p-3 font-medium">Passar</th>
                  </tr>
                </thead>
                <tbody>
                  {page.breedTable.map((row) => (
                    <tr key={row.namn} className="border-t border-border/60">
                      <td className="p-3 font-medium text-foreground">{row.namn}</td>
                      <td className="p-3 text-muted-foreground">{row.ursprung}</td>
                      <td className="p-3 text-muted-foreground">{row.vikt}</td>
                      <td className="p-3 text-muted-foreground">{row.agg_per_ar}</td>
                      <td className="p-3 text-muted-foreground">{row.aggfarg}</td>
                      <td className="p-3 text-muted-foreground">{row.temperament}</td>
                      <td className="p-3 text-muted-foreground">{row.passar}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="py-12 sm:py-16 bg-background">
        <div className="container max-w-3xl mx-auto px-5 sm:px-6">
          <motion.h2 {...fadeUp()} className="font-serif text-2xl sm:text-3xl text-foreground mb-6">
            Vanliga frågor
          </motion.h2>
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

      {/* Related */}
      <section className="py-10 bg-background">
        <div className="container max-w-4xl mx-auto px-5 sm:px-6">
          <h2 className="font-serif text-xl text-foreground mb-4">Läs vidare</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {page.relatedLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors group"
              >
                <Bird className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm text-foreground group-hover:text-primary">{link.label}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-16 bg-background">
        <div className="container max-w-3xl mx-auto px-5 sm:px-6">
          <div className="rounded-3xl bg-gradient-to-br from-primary/12 via-accent/5 to-warning/5 border border-primary/15 p-7 sm:p-10 text-center">
            <Egg className="h-10 w-10 text-primary mx-auto mb-3" />
            <h2 className="font-serif text-2xl sm:text-3xl text-foreground mb-3">
              Få ordning på din hönsflock med Hönsgården
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto mb-5 leading-relaxed">
              Logga ägg, följ varje höna, räkna foderkostnad och bygg upp en historik som hjälper dig fatta bättre
              beslut – oavsett vilken hönsras du valt.
            </p>
            <Button asChild size="lg" className="h-12 px-7 rounded-xl gap-2">
              <a href="/login?mode=register">
                Skapa konto gratis <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <LandingFooter />
      </Suspense>
    </main>
  );
}
