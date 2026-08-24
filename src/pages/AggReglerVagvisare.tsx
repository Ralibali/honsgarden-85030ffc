import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSeo } from '@/hooks/useSeo';
import {
  Egg, Shield, AlertTriangle, ExternalLink, ChevronRight, CheckCircle2,
  ClipboardList, Scale, Info, Store,
} from 'lucide-react';
import {
  evaluateRegler, summarizeLevel, LEVEL_LABELS, SALES_CHANNEL_OPTIONS,
  type SalesChannel, type RuleResult,
} from '@/lib/aggRegler';
import { brandName } from '@/lib/brand';

const QUICK_COUNTS = [10, 50, 100, 350, 1000];

function RuleCard({ rule }: { rule: RuleResult }) {
  const isInfo = rule.level === 'info';
  return (
    <li
      className={`rounded-2xl border p-4 sm:p-5 flex gap-3 ${
        isInfo
          ? 'border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-900'
          : rule.level === 'always'
            ? 'border-border bg-card/60'
            : 'border-primary/30 bg-primary/5'
      }`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {isInfo ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        ) : rule.level === 'always' ? (
          <Shield className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ClipboardList className="h-5 w-5 text-primary" />
        )}
      </div>
      <div className="space-y-1.5 min-w-0">
        <p className="font-medium leading-snug">{rule.title}</p>
        <p className="text-sm text-foreground/80 leading-relaxed">{rule.body}</p>
        {rule.authority && rule.link && (
          <a
            href={rule.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline inline-flex items-center gap-1"
          >
            {rule.linkLabel} ({rule.authority}) <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </li>
  );
}

export default function AggReglerVagvisare() {
  const brand = brandName();
  const [hens, setHens] = useState(60);
  const [sells, setSells] = useState(true);
  const [channels, setChannels] = useState<SalesChannel[]>(['gard', 'reko_prepaid']);

  const results = useMemo(
    () => evaluateRegler({ hens, sells, channels: sells ? channels : [] }),
    [hens, sells, channels],
  );
  const level = useMemo(
    () => summarizeLevel({ hens, sells, channels: sells ? channels : [] }),
    [hens, sells, channels],
  );

  const required = results.filter((r) => r.level === 'required');
  const always = results.filter((r) => r.level === 'always');
  const infos = results.filter((r) => r.level === 'info');

  const toggleChannel = (id: SalesChannel) =>
    setChannels((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  useSeo({
    title: 'Äggregler-vägvisaren – vilka regler gäller för din äggförsäljning? (2026)',
    description:
      'Svara på två frågor och få en personlig checklista: producentkod, äggmärkning, länsstyrelseregistrering, salmonellajournal och kommunens krav – för din flockstorlek och dina försäljningskanaler.',
    path: '/verktyg/aggregler-vagvisare',
    ogImage: '/blog-images/eggs-basket.jpg',
    jsonLd: [
      {
        '@type': 'WebApplication',
        name: 'Äggregler-vägvisaren',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description:
          'Interaktiv vägvisare som visar vilka svenska regler som gäller för äggförsäljning utifrån flockstorlek och försäljningskanal.',
        url: 'https://honsgarden.se/verktyg/aggregler-vagvisare',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'SEK' },
        creator: { '@type': 'Organization', name: brand },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Hur många höns får jag ha utan producentkod?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Med högst 50 värphöns behöver du ingen producentkod. Säljer du ändå utanför gården (t.ex. på torg) ska ditt namn och din adress finnas synliga på försäljningsplatsen. Har du fler än 50 värphöns och säljer utanför gården måste äggen märkas med producentkod från Livsmedelsverket.',
            },
          },
          {
            '@type': 'Question',
            name: 'Behöver jag märka ägg som säljs i gårdsbutik eller via REKO?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Nej. Försäljning direkt till konsument på gården – inklusive förbeställd och förbetald REKO-försäljning – räknas som sålt på gården och är undantagen från märkningskravet, oavsett flockstorlek.',
            },
          },
          {
            '@type': 'Question',
            name: 'Vad är en försäljningsjournal och vem måste föra en?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Anläggningar med värphöns för yrkesmässig äggproduktion ska enligt salmonellakontrollen (SJVFS 2007:19) löpande föra journal över alla äggförsäljningar med datum, antal och köpare. Journalen ska kunna visas upp för länsstyrelsen vid kontroll.',
            },
          },
          {
            '@type': 'Question',
            name: 'När måste jag registrera mig hos kommunen?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Säljer du mer än "små mängder" – ungefär årsproduktionen från 350 fjäderfän – ska livsmedelsverksamheten registreras hos kommunen. Ska äggen säljas via grossist eller packeri krävs dessutom godkännande från Livsmedelsverket.',
            },
          },
        ],
      },
    ],
  });

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-xl">🐔</span>
            <span className="font-serif text-lg">{brand}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/guider/salja-agg-regler" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block">
              Regelguiden
            </Link>
            <Link to="/blogg" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block">Blogg</Link>
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
          <Link to="/verktyg/aggkalkylator" className="hover:text-foreground">Verktyg</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Äggregler-vägvisaren</span>
        </nav>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 text-primary text-xs font-medium mb-4">
          <Scale className="h-3.5 w-3.5" /> Interaktivt verktyg
        </div>

        <h1 className="text-3xl sm:text-4xl font-serif leading-tight mb-3">Äggregler-vägvisaren</h1>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Svara på två frågor om din flock och din försäljning – så får du en personlig checklista
          över exakt vilka registreringar, märkningskrav och journaler som gäller för dig.
          Baserad på reglerna från Jordbruksverket, Livsmedelsverket och Skatteverket.
        </p>

        {/* Steg 1: antal höns */}
        <section className="rounded-2xl border border-border bg-card/60 p-5 sm:p-6 mb-4">
          <h2 className="text-lg font-serif mb-1 flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
            Hur många värphöns har du?
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Räkna bara hönsen du håller för äggproduktion.</p>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {QUICK_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setHens(n)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  hens === n
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 max-w-xs">
            <Input
              type="number"
              min={0}
              value={hens}
              onChange={(e) => setHens(Math.max(0, Number(e.target.value) || 0))}
              className="rounded-xl"
              aria-label="Antal värphöns"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">värphöns</span>
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 flex-shrink-0" />
            Gränserna som styr reglerna: 50 höns (producentkod & länsstyrelsen) och 350 höns (kommunregistrering).
          </p>
        </section>

        {/* Steg 2: försäljning */}
        <section className="rounded-2xl border border-border bg-card/60 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-serif mb-1 flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
            Säljer du ägg – och i så fall var?
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Markera alla kanaler som stämmer. Detaljerna spelar roll: REKO med förbetalning räknas t.ex. som "sålt på gården".</p>

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setSells(true)}
              className={`px-4 py-2 rounded-xl text-sm border transition-colors ${
                sells ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50'
              }`}
            >
              Ja, jag säljer
            </button>
            <button
              type="button"
              onClick={() => setSells(false)}
              className={`px-4 py-2 rounded-xl text-sm border transition-colors ${
                !sells ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50'
              }`}
            >
              Nej, bara husbehov
            </button>
          </div>

          {sells && (
            <div className="grid sm:grid-cols-2 gap-2" role="group" aria-label="Försäljningskanaler">
              {SALES_CHANNEL_OPTIONS.map((opt) => {
                const active = channels.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleChannel(opt.id)}
                    aria-pressed={active}
                    className={`text-left rounded-xl border p-3 transition-colors ${
                      active ? 'border-primary bg-primary/8' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium text-sm">
                      <Store className="h-4 w-4 text-primary flex-shrink-0" />
                      {opt.label}
                      {active && <CheckCircle2 className="h-4 w-4 text-primary ml-auto flex-shrink-0" />}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-1">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Resultat */}
        <section aria-live="polite">
          <div className="rounded-2xl bg-gradient-to-br from-primary/12 to-primary/5 border border-primary/25 p-5 sm:p-6 mb-5">
            <p className="text-xs uppercase tracking-wide text-primary font-medium mb-1">Din nivå</p>
            <h2 className="text-xl sm:text-2xl font-serif">{LEVEL_LABELS[level]}</h2>
            <p className="text-sm text-foreground/80 mt-1">
              {required.length > 0
                ? `${required.length} krav att ta hand om – plus ${always.length} som gäller alla fjäderfähållare.`
                : `${always.length} grundkrav som gäller alla fjäderfähållare.`}
            </p>
          </div>

          {required.length > 0 && (
            <>
              <h3 className="text-lg font-serif mb-3">Krav för din situation</h3>
              <ul className="space-y-3 mb-8">
                {required.map((r) => <RuleCard key={r.id} rule={r} />)}
              </ul>
            </>
          )}

          <h3 className="text-lg font-serif mb-3">Gäller alla fjäderfähållare</h3>
          <ul className="space-y-3 mb-8">
            {always.map((r) => <RuleCard key={r.id} rule={r} />)}
          </ul>

          {infos.length > 0 && (
            <>
              <h3 className="text-lg font-serif mb-3">Bra att veta</h3>
              <ul className="space-y-3 mb-8">
                {infos.map((r) => <RuleCard key={r.id} rule={r} />)}
              </ul>
            </>
          )}
        </section>

        {/* Journal-CTA */}
        <section className="rounded-2xl border border-primary/25 bg-card p-5 sm:p-6 mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="font-serif text-lg mb-1">Låt journalen skriva sig själv</h3>
            <p className="text-sm text-foreground/80">
              Registrerar du försäljningen i {brand} har du automatiskt en försäljningsjournal med
              datum, antal och köpare – redo att visa upp vid kontroll eller exportera till PDF/CSV.
            </p>
          </div>
          <Link to="/login?mode=register" className="flex-shrink-0">
            <Button className="rounded-xl gap-2">
              <ClipboardList className="h-4 w-4" /> Skapa gratis konto
            </Button>
          </Link>
        </section>

        {/* Disclaimer */}
        <aside className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4 sm:p-5 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 dark:text-amber-100 space-y-2">
            <p className="font-medium">Vägledning – inte juridisk rådgivning</p>
            <p>
              Vägvisaren är en översikt baserad på reglerna hos Jordbruksverket, Livsmedelsverket och
              Skatteverket (hämtade augusti 2026). Regler kan ändras och din kommun kan ha egna krav –
              dubbelkolla alltid hos myndigheten innan du fattar beslut.
            </p>
            <ul className="list-disc ml-5 space-y-1">
              <li>
                <a href="https://www.livsmedelsverket.se" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
                  Livsmedelsverket – äggmärkning och försäljning <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a href="https://jordbruksverket.se" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
                  Jordbruksverket – anläggningsregistret och salmonellakontroll <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>
        </aside>

        {/* Läs vidare */}
        <section className="mt-8 rounded-2xl border border-border bg-card/30 p-5 sm:p-6">
          <h2 className="text-lg font-serif mb-3">Läs vidare</h2>
          <ul className="space-y-2">
            <li>
              <Link to="/guider/salja-agg-regler" className="text-primary underline inline-flex items-center gap-1">
                Sälja ägg från egna höns – reglerna i klartext <ChevronRight className="h-3 w-3" />
              </Link>
            </li>
            <li>
              <Link to="/guider/registrera-hons-jordbruksverket" className="text-primary underline inline-flex items-center gap-1">
                Registrera dina höns hos Jordbruksverket – så gör du <ChevronRight className="h-3 w-3" />
              </Link>
            </li>
            <li>
              <Link to="/verktyg/aggkalkylator" className="text-primary underline inline-flex items-center gap-1">
                Äggkalkylatorn – räkna på lönsamheten <ChevronRight className="h-3 w-3" />
              </Link>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
