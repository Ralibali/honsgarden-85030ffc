import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSeo } from '@/hooks/useSeo';
// @ts-ignore – .mjs data-modul
import { getRegulationGuide } from '@/data/regulationGuides.mjs';
import type { RegulationGuide as RegulationGuideType } from '@/data/regulationGuides.d.mts';
import { brandName } from '@/lib/brand';

interface Props {
  slug: string;
}

export default function RegulationGuide({ slug }: Props) {
  const guide = getRegulationGuide(slug) as RegulationGuideType | null;
  const brand = brandName();
  const canonical = `/guider/${slug}`;

  useSeo({
    title: guide?.title ?? 'Regelguide',
    description: guide?.metaDescription ?? '',
    path: canonical,
    ogImage: guide?.ogImage ?? '/og-image.jpg',
    jsonLd: guide
      ? [
          {
            '@type': 'Article',
            headline: guide.h1,
            description: guide.metaDescription,
            datePublished: guide.updated,
            dateModified: guide.updated,
            author: { '@type': 'Organization', name: brand },
            publisher: {
              '@type': 'Organization',
              name: brand,
              logo: { '@type': 'ImageObject', url: 'https://honsgarden.se/logo.png' },
            },
            mainEntityOfPage: { '@type': 'WebPage', '@id': `https://honsgarden.se${canonical}` },
          },
          {
            '@type': 'FAQPage',
            mainEntity: guide.faqs.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          },
        ]
      : [],
  });

  if (!guide) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-serif">Guiden hittades inte</h1>
          <Link to="/blogg" className="text-primary underline">Till bloggen</Link>
        </div>
      </div>
    );
  }

  const updatedFormatted = new Date(guide.updated).toLocaleDateString('sv-SE', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-xl">🐔</span>
            <span className="font-serif text-lg">{brand}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/blogg" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block">Blogg</Link>
            <Link to="/salja-agg" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block">Sälja ägg</Link>
            <Link to="/login">
              <Button size="sm" className="rounded-xl text-xs gap-1">
                <Egg className="h-3 w-3" /> Kom igång
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <nav className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5 flex-wrap" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-foreground">Start</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/blogg" className="hover:text-foreground">Guider</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{guide.h1}</span>
        </nav>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 text-primary text-xs font-medium mb-4">
          <Shield className="h-3.5 w-3.5" /> Regelguide
        </div>

        <h1 className="text-3xl sm:text-4xl font-serif leading-tight mb-4">{guide.h1}</h1>

        <p className="text-sm text-muted-foreground mb-6">
          Senast uppdaterad: <time dateTime={guide.updated}>{updatedFormatted}</time>
        </p>

        <div
          className="prose prose-neutral max-w-none text-foreground/85 leading-relaxed [&_p]:mb-4 [&_a]:text-primary [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: guide.introHtml }}
        />

        <article className="mt-6 space-y-8">
          {guide.sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-2xl font-serif mb-3">{s.heading}</h2>
              <div
                className="prose prose-neutral max-w-none text-foreground/85 leading-relaxed [&_p]:mb-4 [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: s.html }}
              />
            </section>
          ))}
        </article>

        {/* Disclaimer */}
        <aside className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4 sm:p-5 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 dark:text-amber-100 space-y-2">
            <p className="font-medium">Regler kan ändras – dubbelkolla alltid källan</p>
            <p>
              Den här guiden är en översikt och ersätter inte myndigheternas information. För aktuella regler,
              hänvisar vi till <strong>Jordbruksverket</strong> och <strong>Livsmedelsverket</strong>:
            </p>
            <ul className="list-disc ml-5 space-y-1">
              {guide.authorityLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
                    {l.label} <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* FAQ */}
        <section className="mt-10">
          <h2 className="text-2xl font-serif mb-4">Vanliga frågor</h2>
          <div className="space-y-3">
            {guide.faqs.map((f, i) => (
              <details key={i} className="group rounded-xl border border-border bg-card/50 p-4 open:bg-card">
                <summary className="cursor-pointer list-none flex items-start justify-between gap-3 font-medium">
                  <span>{f.q}</span>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 mt-1 transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm text-foreground/80 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Related */}
        <section className="mt-10 rounded-2xl border border-border bg-card/30 p-5 sm:p-6">
          <h2 className="text-lg font-serif mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" /> Läs vidare
          </h2>
          <ul className="space-y-2">
            {guide.relatedLinks.map((l) => (
              <li key={l.href}>
                <Link to={l.href} className="text-primary underline inline-flex items-center gap-1">
                  {l.label} <ChevronRight className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Soft CTA */}
        <section className="mt-10 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-6 text-center">
          <h2 className="text-xl font-serif mb-2">Håll koll på hela din hönsflock i {brand}</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-xl mx-auto">
            Logga ägg, dela säljsida med kartposition och få smarta påminnelser om registrering, foder och säsong.
          </p>
          <Link to="/login">
            <Button className="rounded-xl gap-2">
              <Egg className="h-4 w-4" /> Kom igång gratis
            </Button>
          </Link>
        </section>
      </main>
    </div>
  );
}
