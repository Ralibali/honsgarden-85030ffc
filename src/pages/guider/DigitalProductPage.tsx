import { lazy, Suspense, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, FileText, Loader2, ArrowRight } from 'lucide-react';
import LandingNavbar from '@/components/LandingNavbar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useSeo } from '@/hooks/useSeo';
import { supabase } from '@/integrations/supabase/client';
import { isNativePlatform } from '@/lib/nativePlatform';
import { DIGITAL_PRODUCT_CATALOG, type DigitalProductSlug } from '@/lib/digitalProducts';
import { toast } from 'sonner';

const LandingFooter = lazy(() => import('@/components/LandingFooter'));
const TERMS_VERSION = '2026-09-08';

export default function DigitalProductPage({ productSlug }: { productSlug: DigitalProductSlug }) {
  const product = DIGITAL_PRODUCT_CATALOG[productSlug];
  const available = product.saleStatus !== 'preparing';
  const path = `/guider/${product.slug}`;
  const [params] = useSearchParams();
  const [consent, setConsent] = useState(false);
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const native = isNativePlatform();
  useSeo({
    title: `${product.title} – ifyllbar PDF | Hönsgården`, description: `${product.description} ${product.pages} sidor. ${product.price} kr inkl. moms.`,
    path, ogImage: product.cover, ogImageAlt: `Omslag: ${product.title}`,
    jsonLd: [{ '@type': 'Product', name: `${product.title} (PDF)`, description: product.description,
      image: `https://honsgarden.se${product.cover}`, brand: { '@type': 'Brand', name: 'Hönsgården' },
      offers: { '@type': 'Offer', price: product.price.toFixed(2), priceCurrency: 'SEK', availability: available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: `https://honsgarden.se${path}`, seller: { '@type': 'Organization', name: 'aurora media AB' } } }],
  });
  const checkout = async () => {
    if (!available || !consent || country !== 'SE' || loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('digital-checkout', {
        body: { productSlug: product.slug, consent: true, country, termsVersion: TERMS_VERSION },
      });
      if (error || !data?.url) throw error ?? new Error('Ingen betalningslänk');
      window.location.href = data.url;
    } catch {
      toast.error('Kunde inte öppna kassan. Försök igen om en stund.'); setLoading(false);
    }
  };
  if (native) return <main className="mx-auto max-w-xl px-5 py-20"><h1 className="font-serif text-3xl">{product.title}</h1><p className="mt-4">Den här produktvyn är inte tillgänglig i appen.</p><Link className="mt-6 block underline" to="/blogg">Till hönsguiderna</Link></main>;
  return <div className="min-h-dvh bg-background">
    <LandingNavbar />
    <main id="main-content" className="pb-20 pt-24">
      <section className="mx-auto max-w-6xl px-5">
        <Link to="/blogg" className="text-sm text-muted-foreground underline">Hönsgårdens artiklar</Link>
        {params.get('avbrutet') === '1' && <p className="mt-5 rounded-xl bg-muted p-4 text-sm">Köpet avbröts. Du kan starta om när du vill.</p>}
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Hönsgårdens arbetsböcker · PDF</p>
            <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">{product.title}</h1>
            <p className="mt-5 font-serif text-2xl text-primary">{product.tagline}</p>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">{product.description}</p>
            <div className="mt-7 flex flex-wrap gap-2 text-sm">
              {[`${product.pages} sidor i A4`, 'Ifyllbar och utskrivbar', 'Engångsköp'].map(fact => <span className="rounded-full border border-border bg-card px-4 py-2" key={fact}>{fact}</span>)}
            </div>
            <a href="#kop-pdf" className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">{available ? 'Se köp' : 'Se planerat pris'} – {product.price} kr inkl. moms</a>
            <a href={product.sample} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-12 items-center gap-3 rounded-xl border border-primary/40 px-5 py-3 font-medium text-primary">
              <FileText className="h-5 w-5" aria-hidden /> Gratis smakprov – {product.samplePages} riktiga sidor <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <p className="mt-3 text-sm text-muted-foreground">Bläddra före köp. Ingen registrering behövs.</p>
            <img src={product.cover} alt={`Omslaget till ${product.title}`} width={778} height={1100} className="mx-auto mt-10 h-auto w-full max-w-[290px] rounded-sm border border-border shadow-xl" />
          </div>
          <div id="kop-pdf" className="h-fit scroll-mt-24 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <p className="font-serif text-4xl">{product.price} kr</p>
            <p className="mt-2 text-sm text-muted-foreground">inkl. moms · betala en gång</p>
            <p className="mt-5 text-sm leading-relaxed">{available ? 'Du får' : 'När försäljningen öppnar får du'} hela PDF:en med {product.pages} sidor. Filen blir tillgänglig efter bekräftad betalning och en nedladdningslänk skickas till din e-post.</p>
            <div className="mt-6 space-y-4">
              {!available && <p role="status" className="rounded-xl bg-muted p-4 text-sm">Försäljningen öppnar när den digitala leveransen är klar. Läs gärna det kostnadsfria smakprovet under tiden.</p>}
              {available && <>
              <label htmlFor="pdf-country" className="block text-sm font-medium">Faktureringsland</label>
              <select id="pdf-country" value={country} onChange={e => setCountry(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-3">
                <option value="">Välj faktureringsland</option><option value="SE">Sverige</option>
              </select>
              <p className="text-xs text-muted-foreground">Köpet gäller svensk faktureringsadress. Du anger din e-post i kassan.</p>
              <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-4">
                <Checkbox id="pdf-consent" checked={consent} onCheckedChange={v => setConsent(v === true)} className="mt-1" />
                <label htmlFor="pdf-consent" className="text-sm leading-relaxed">Jag godkänner att filen levereras omedelbart och att min ångerrätt därmed upphör. Reklamationsrätten gäller som vanligt.</label>
              </div>
              <Button size="lg" className="w-full" disabled={!consent || country !== 'SE' || loading} onClick={checkout}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Öppnar kassan…</> : <><Download className="mr-2 h-4 w-4" aria-hidden /> Köp PDF – {product.price} kr</>}
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">Betalning hos Stripe. Läs <a className="underline" href="#villkor">köpvillkoren</a>. Digital leverans, ingen fysisk bok. Hönsgården Plus ingår inte.</p>
              <Link to={`${path}/hamta`} className="block text-sm text-primary underline">Redan köpt? Hämta din länk igen</Link>
              </>}
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto mt-20 max-w-6xl px-5">
        <h2 className="font-serif text-3xl">Det här får du</h2>
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{product.contents.map((part, index) => <article key={part.title} className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary">{String(index + 1).padStart(2, '0')}</p>
          <h3 className="mt-3 font-serif text-xl">{part.title}</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{part.body}</p>
        </article>)}</div>
        <div className="mt-8 max-w-3xl space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>{product.scope}</p>
          <p>Öppna i en PDF-läsare som stöder formulär, fyll i och spara en egen kopia. Kontrollera kopian efter att du öppnat den igen. Du kan också skriva ut och använda penna. Mobilens förhandsvisning kan ha begränsat formulärstöd.</p>
          <p>Utgåva {product.edition}. {product.review}</p>
        </div>
      </section>
      <section id="villkor" className="mx-auto mt-16 max-w-6xl scroll-mt-24 px-5">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 className="font-serif text-2xl">Villkor för PDF-köpet</h2><p className="mt-2 text-xs text-muted-foreground">Version {TERMS_VERSION}</p>
          <dl className="mt-6 grid gap-7 text-sm leading-relaxed sm:grid-cols-2">
            <div><dt className="font-semibold">Produkt och pris</dt><dd className="mt-2 text-muted-foreground">{product.title}, digital PDF med {product.pages} sidor. {product.price} kr inklusive svensk moms {product.vatPercent} %. Engångsköp för svensk faktureringsadress, ingen prenumeration eller frakt.</dd></div>
            <div><dt className="font-semibold">Leverans och återhämtning</dt><dd className="mt-2 text-muted-foreground">PDF:en kan hämtas när betalningen har bekräftats. Du får också en beständig länk via e-post. En ny länk kan hämtas med samma e-postadress. Ovanligt många nedladdningar inom en timme kan begränsas för att skydda filen.</dd></div>
            <div><dt className="font-semibold">Ångerrätt och reklamation</dt><dd className="mt-2 text-muted-foreground">Du godkänner uttryckligen omedelbar leverans och att ångerrätten då upphör. Samtycket sparas med tidpunkt och villkorsversion och bekräftas i kvittot. Reklamationsrätten gäller. Om filen är skadad eller inte motsvarar beskrivningen, mejla oss så åtgärdar vi felet eller återbetalar köpet.</dd></div>
            <div><dt className="font-semibold">Användningsrätt</dt><dd className="mt-2 text-muted-foreground">{product.license}</dd></div>
            <div><dt className="font-semibold">Säljare och support</dt><dd className="mt-2 text-muted-foreground">aurora media AB, org.nr 559272-0220. Stjärnorp skolan 1, 585 78 Vreta Kloster. <a href="mailto:info@auroramedia.se" className="underline">info@auroramedia.se</a>.</dd></div>
          </dl>
        </div>
      </section>
    </main>
    <Suspense fallback={null}><LandingFooter /></Suspense>
  </div>;
}
