import React, { lazy, Suspense, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useSeo } from '@/hooks/useSeo';
import { supabase } from '@/integrations/supabase/client';
import { isNativePlatform } from '@/lib/nativePlatform';
import { toast } from 'sonner';
import {
  BookOpen, CheckCircle2, Download, FileText, Printer, ShieldCheck, Loader2, ArrowRight,
} from 'lucide-react';
import LandingNavbar from '@/components/LandingNavbar';
import coverAsset from '@/assets/mina-forsta-hons-omslag.png.asset.json';
import sampleAsset from '@/assets/mina-forsta-hons-smakprov.pdf.asset.json';

const LandingFooter = lazy(() => import('@/components/LandingFooter'));

export const TERMS_VERSION = '2026-09-07';
const PRICE_LABEL = '199 kr';

const CHAPTERS: Array<{ title: string; body: string }> = [
  { title: 'Beslut före hönsköp', body: 'Frågorna du bör svara på innan du köper: tid, plats, grannar, kostnad och vem som sköter flocken när du är bortrest.' },
  { title: 'Inköpslistor', body: 'Vad som behövs från dag ett, vad som kan vänta och vad du kan låna eller bygga själv.' },
  { title: 'Budgetmall med räkneexempel', body: 'Startkostnad och löpande kostnad per månad, med ett ifyllt exempel så att du ser hur du räknar på dina egna siffror.' },
  { title: 'Boende och säkerhet', body: 'Plan för hönshus, rastgård, sittpinnar, värpreden och skydd mot rovdjur och rymning.' },
  { title: 'Första 48 timmarna', body: 'Steg för steg när hönsen kommer hem: transport, insläpp, vatten, foder och vad du håller ögonen på.' },
  { title: 'Första 30 dagarna', body: 'En dag-för-dag-plan som gör de första veckorna förutsägbara i stället för stressiga.' },
  { title: 'Rutiner morgon och kväll', body: 'Korta checklistor du kan sätta upp i hönshuset och bocka av utan att fundera.' },
  { title: 'Hönsvaktsblad', body: 'Ett blad att lämna till den som passar flocken: rutiner, kontaktuppgifter och vad som är viktigt.' },
  { title: 'Individkort per höna', body: 'Namn, ras, ålder, kännetecken och anteckningar – ett kort per höna.' },
  { title: 'Ägglogg', body: 'Enkel logg att skriva i för hand, eller använd som komplement till appen.' },
];

const FACTS = [
  { icon: FileText, label: '24 sidor i A4' },
  { icon: Printer, label: 'Utskrivbar' },
  { icon: BookOpen, label: '216 ifyllbara fält och checkrutor' },
  { icon: Download, label: 'Direkt nedladdning' },
];

export default function MinaForstaHons() {
  const [params] = useSearchParams();
  const canceled = params.get('avbrutet') === '1';
  const [consent, setConsent] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const native = isNativePlatform();

  useSeo({
    title: 'Mina första höns – svensk startguide i PDF (24 sidor) | Hönsgården',
    description:
      'Ifyllbar och utskrivbar PDF på 24 sidor: beslut före hönsköp, inköpslistor, budget, boende, första 48 timmarna, 30-dagarsplan, rutiner, hönsvaktsblad, individkort och ägglogg. 199 kr inkl. moms, engångsköp.',
    path: '/guider/mina-forsta-hons',
    ogImage: coverAsset.url,
    ogImageAlt: 'Omslaget till guiden Mina första höns',
    jsonLd: [{
      '@type': 'Product',
      name: 'Mina första höns – Hönsgårdens startpaket (PDF)',
      description: 'Svensk startguide för nya hönsägare. 24 sidor, ifyllbar och utskrivbar PDF.',
      image: `https://honsgarden.se${coverAsset.url}`,
      brand: { '@type': 'Brand', name: 'Hönsgården' },
      offers: {
        '@type': 'Offer',
        price: '199.00',
        priceCurrency: 'SEK',
        availability: 'https://schema.org/InStock',
        url: 'https://honsgarden.se/guider/mina-forsta-hons',
        seller: { '@type': 'Organization', name: 'aurora media AB' },
      },
    }],
  });

  const startCheckout = async () => {
    if (!consent) {
      toast.error('Kryssa i rutan om omedelbar leverans först.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('digital-checkout', {
        body: {
          productSlug: 'mina-forsta-hons',
          consent: true,
          termsVersion: TERMS_VERSION,
          email: email.trim() || undefined,
        },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error('Ingen betalningslänk');
      window.location.href = url;
    } catch (err) {
      console.error('[digital-checkout]', err);
      toast.error('Kunde inte starta betalningen. Försök igen om en stund.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <LandingNavbar />

      <main className="pt-24 pb-20">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4">
          {canceled && (
            <div className="mb-6 rounded-xl border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
              Köpet avbröts. Inget har debiterats – du kan starta om när du vill.
            </div>
          )}

          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Hönsgården · Startpaket 01
              </p>
              <h1 className="mt-4 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
                Mina första höns
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Från första funderingen till en vardag som fungerar. En svensk startguide på 24 sidor
                som du fyller i, skriver ut och återvänder till – med budget, planer och checklistor
                i stället för lösa tips.
              </p>

              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {FACTS.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-sm text-foreground">{label}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href={sampleAsset.url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/40 px-5 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5"
                >
                  Läs gratis smakprov (4 sidor)
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
                <span className="text-sm text-muted-foreground">Ingen registrering behövs.</span>
              </div>
            </div>

            {/* Köpkort */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <img
                src={coverAsset.url}
                alt="Omslaget till guiden Mina första höns – tre höns i en trädgård framför ett rött hönshus"
                width={745}
                height={1024}
                className="mb-6 w-full rounded-xl border border-border object-cover"
                loading="eager"
              />
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl text-foreground">{PRICE_LABEL}</span>
                <span className="text-sm text-muted-foreground">inkl. moms · engångsköp</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Digital PDF – ingen frakt och ingen fysisk bok. Guiden köps separat och innehåller
                inte Hönsgården Plus.
              </p>

              {native ? (
                <div className="mt-6 rounded-xl border border-border bg-muted/50 px-4 py-4 text-sm text-muted-foreground">
                  Guiden köps på honsgarden.se i webbläsaren. Öppna sidan där för att slutföra köpet.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <label className="block text-sm font-medium text-foreground" htmlFor="digital-email">
                    E-post för kvitto och nedladdningslänk <span className="text-muted-foreground">(valfritt – annars fyller du i den i kassan)</span>
                  </label>
                  <input
                    id="digital-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="din@epost.se"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                  />

                  <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
                    <Checkbox
                      id="digital-consent"
                      checked={consent}
                      onCheckedChange={(v) => setConsent(v === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor="digital-consent" className="text-sm leading-relaxed text-foreground">
                      Jag godkänner att filen levereras omedelbart och att min ångerrätt därmed
                      upphör. Reklamationsrätten gäller som vanligt.
                    </label>
                  </div>

                  <Button
                    size="lg"
                    className="w-full"
                    disabled={!consent || loading}
                    onClick={startCheckout}
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Öppnar kassan…</>
                    ) : (
                      <>Köp och ladda ner – {PRICE_LABEL}</>
                    )}
                  </Button>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Betalning sker hos Stripe. Läs{' '}
                    <a href="#villkor" className="underline">villkoren för PDF-köpet</a>{' '}
                    innan du betalar. Har du redan köpt?{' '}
                    <Link to="/guider/mina-forsta-hons/hamta" className="underline">Hämta din länk igen</Link>.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Innehåll */}
        <section className="mx-auto mt-20 max-w-6xl px-4">
          <h2 className="font-serif text-3xl text-foreground">Det här finns i guiden</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Tio delar som följer din väg från fundering till fungerande rutin. Allt är gjort för att
            fyllas i – på skärmen eller med penna efter utskrift.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHAPTERS.map((c, i) => (
              <article key={c.title} className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  Del {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-2 font-serif text-xl text-foreground">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Så funkar det */}
        <section className="mx-auto mt-20 max-w-4xl px-4">
          <h2 className="font-serif text-3xl text-foreground">Så går köpet till</h2>
          <ol className="mt-6 space-y-4">
            {[
              'Du kryssar i att filen levereras direkt och betalar med kort hos Stripe.',
              'Vi bekräftar betalningen på servern – först då skapas din nedladdning.',
              'Du får PDF:en direkt på tack-sidan och en beständig länk i mejlet.',
              'Behöver du filen igen senare hämtar du en ny länk med din e-postadress.',
            ].map((step, i) => (
              <li key={step} className="flex gap-4 rounded-xl border border-border bg-card px-5 py-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Villkor */}
        <section id="villkor" className="mx-auto mt-20 max-w-4xl px-4">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="font-serif text-2xl text-foreground">Villkor för PDF-köpet</h2>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Version {TERMS_VERSION}</p>

            <dl className="mt-6 space-y-5 text-sm leading-relaxed">
              <div>
                <dt className="font-semibold text-foreground">Säljare</dt>
                <dd className="text-muted-foreground">
                  aurora media AB, org.nr 559272-0220, Stjärnorp skolan 1, 585 78 Vreta Kloster.
                  Support: <a className="underline" href="mailto:info@auroramedia.se">info@auroramedia.se</a>.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Produkt och pris</dt>
                <dd className="text-muted-foreground">
                  Mina första höns, digital PDF på 24 sidor. 199 kr inklusive svensk moms 6 % för
                  elektronisk publikation. Engångsköp, ingen prenumeration, ingen frakt och ingen
                  fysisk leverans. Guiden ger inte tillgång till Hönsgården Plus.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Leverans</dt>
                <dd className="text-muted-foreground">
                  Filen blir tillgänglig direkt när betalningen är bekräftad. Du får dessutom en
                  beständig nedladdningslänk till den e-postadress du angav i kassan. Länken kan
                  användas flera gånger; nya länkar kan hämtas med samma e-postadress.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Ångerrätt</dt>
                <dd className="text-muted-foreground">
                  Eftersom du uttryckligen godkänner att det digitala innehållet levereras omedelbart
                  och samtidigt bekräftar att ångerrätten därmed upphör, finns ingen ångerrätt efter
                  att leveransen startat. Kryssrutan är aldrig förkryssad, och ditt samtycke sparas
                  med tidpunkt och villkorsversion samt bekräftas i orderbekräftelsen.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Reklamation</dt>
                <dd className="text-muted-foreground">
                  Reklamationsrätten gäller. Om filen är skadad, inte går att öppna eller inte
                  motsvarar beskrivningen – mejla oss så åtgärdar vi det eller återbetalar köpet.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Användning</dt>
                <dd className="text-muted-foreground">
                  Guiden är till för ditt eget hushåll. Du får skriva ut den för eget bruk, men inte
                  sälja eller sprida filen vidare.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Innehållets grund</dt>
                <dd className="text-muted-foreground">
                  Innehållet är sakligt kontrollerat mot Jordbruksverkets och SVA:s publika
                  vägledningar. Det ersätter inte veterinärbedömning i enskilda fall.
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={sampleAsset.url}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/40 px-5 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5"
            >
              <FileText className="h-4 w-4" aria-hidden /> Gratis smakprov
            </a>
            {!native && (
              <a
                href="#top"
                onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Köp och ladda ner – {PRICE_LABEL}
              </a>
            )}
          </div>
        </section>
      </main>

      <Suspense fallback={null}><LandingFooter /></Suspense>
    </div>
  );
}
