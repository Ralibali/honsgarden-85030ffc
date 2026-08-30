import React, { lazy, Suspense, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';
import LandingNavbar from '@/components/LandingNavbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { ArrowRight, CircleHelp as HelpCircle, Wrench } from 'lucide-react';
import type { AnalyticsPublicTool } from '@/lib/analytics';

const LandingFooter = lazy(() => import('@/components/LandingFooter'));

export interface PublicToolFaq {
  q: string;
  a: string;
}

export interface PublicToolLink {
  href: string;
  label: string;
  description: string;
}

interface PublicToolPageProps {
  /** Stabilt verktygs-id (används i analytics och som nyckel). */
  tool: AnalyticsPublicTool;
  /** SEO: title, meta description, canonical path. */
  title: string;
  description: string;
  path: string;
  /** Hero: kort etikett, h1 och inledande stycke. */
  eyebrow: string;
  h1: string;
  intro: string;
  /** Själva interaktiva verktyget (ren UI, logiken lever i src/lib/tools/). */
  children: React.ReactNode;
  /** FAQ-sektion under verktyget (ger även FAQPage-JSON-LD). */
  faqs: PublicToolFaq[];
  /** Relaterade verktyg/sidor för internlänkning. */
  related: PublicToolLink[];
  /** Valfri extra sektion mellan verktyg och FAQ. */
  afterTool?: React.ReactNode;
}

/**
 * Delat skal för publika, anonyma verktyg under /verktyg/.
 *
 * Ramverket äger SEO-head (inkl. WebApplication/FAQ/Breadcrumb JSON-LD),
 * hero, FAQ-sektion, internlänkning och CTA. Verktygslogiken ska ligga i
 * rena funktioner under src/lib/tools/ så den kan testas och återanvändas
 * utan DOM.
 */
export default function PublicToolPage({
  tool,
  title,
  description,
  path,
  eyebrow,
  h1,
  intro,
  children,
  faqs,
  related,
  afterTool,
}: PublicToolPageProps) {
  const jsonLd = useMemo(() => [
    {
      '@type': 'WebApplication',
      name: h1,
      url: `https://honsgarden.se${path}`,
      applicationCategory: 'UtilityApplication',
      operatingSystem: 'Web',
      inLanguage: 'sv-SE',
      description,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'SEK' },
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Hönsgården', item: 'https://honsgarden.se/' },
        { '@type': 'ListItem', position: 2, name: 'Verktyg', item: 'https://honsgarden.se/verktyg/aggkalkylator' },
        { '@type': 'ListItem', position: 3, name: h1, item: `https://honsgarden.se${path}` },
      ],
    },
  ], [h1, path, description, faqs]);

  useSeo({ title, description, path, ogType: 'website', jsonLd });

  return (
    <div className="min-h-dvh bg-background flex flex-col" data-tool={tool}>
      <LandingNavbar />

      <main className="flex-1">
        <nav aria-label="Brödsmulor" className="container max-w-4xl mx-auto px-5 sm:px-6 pt-6 text-xs text-muted-foreground">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li><Link to="/" className="hover:text-foreground">Hönsgården</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link to="/verktyg/aggkalkylator" className="hover:text-foreground">Verktyg</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground" aria-current="page">{h1}</li>
          </ol>
        </nav>

        <section className="pt-10 pb-8 sm:pt-16 sm:pb-12">
          <div className="container max-w-4xl mx-auto px-5 sm:px-6">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 inline-flex items-center gap-1.5">
              <Wrench className="h-3 w-3" /> {eyebrow}
            </Badge>
            <h1 className="font-serif text-3xl sm:text-5xl text-foreground leading-[1.1] mb-4 tracking-tight">
              {h1}
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
              {intro}
            </p>
          </div>
        </section>

        <section className="pb-14 sm:pb-20">
          <div className="container max-w-4xl mx-auto px-5 sm:px-6">
            {children}
          </div>
        </section>

        {afterTool}

        <section className="py-14 sm:py-20 bg-muted/30 border-y border-border/40">
          <div className="container max-w-4xl mx-auto px-5 sm:px-6">
            <h2 className="font-serif text-2xl sm:text-3xl mb-6">Fler gratis verktyg</h2>
            <ul className="grid sm:grid-cols-2 gap-3 list-none p-0">
              {related.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors group h-full"
                  >
                    <Wrench className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium text-foreground group-hover:text-primary">{link.label}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{link.description}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-14 sm:py-20">
          <div className="container max-w-3xl mx-auto px-5 sm:px-6">
            <div className="text-center mb-8">
              <Badge className="mb-3 bg-primary/10 text-primary border-primary/20 inline-flex items-center gap-1.5">
                <HelpCircle className="h-3 w-3" /> Vanliga frågor
              </Badge>
              <h2 className="font-serif text-2xl sm:text-3xl">Vanliga frågor</h2>
            </div>
            <Accordion type="single" collapsible className="rounded-2xl border border-border/50 bg-card divide-y divide-border/40">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-0 px-5 sm:px-6">
                  <AccordionTrigger className="text-left text-[15px] font-medium py-4 hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-[15px] text-muted-foreground leading-relaxed pb-5">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="mt-12 text-center bg-gradient-to-br from-primary/5 via-card to-accent/5 rounded-2xl p-8 sm:p-10 border border-border/30">
              <span className="text-3xl mb-3 block">🐣</span>
              <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-2">
                Följ kläckningen dag för dag i appen
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                Hönsgårdens kläckningskalender håller koll på datum, påminner om lysning och loggar resultatet – gratis.
              </p>
              <Button asChild size="lg" className="rounded-xl gap-2">
                <Link to={`/login?mode=register&utm_source=tool&utm_content=${tool}`}>
                  Skapa ett konto <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Suspense fallback={null}>
        <LandingFooter />
      </Suspense>
    </div>
  );
}
