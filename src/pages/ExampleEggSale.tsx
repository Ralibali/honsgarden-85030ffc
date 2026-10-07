import { useState } from 'react';
import { ArrowRight, CheckCircle2, Egg, MapPin } from 'lucide-react';
import LandingNavbar from '@/components/LandingNavbar';
import LandingFooter from '@/components/LandingFooter';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useSeo } from '@/hooks/useSeo';

/** A separate, local-only demo: no seller, contact details, payment or booking API. */
export default function ExampleEggSale() {
  const [packs, setPacks] = useState(1);
  const [previewed, setPreviewed] = useState(false);
  useSeo({
    title: 'Exempel på säljsida – Bergs ägg | Hönsgården',
    description: 'Se hur en säljlänk i Agdas äggbod fungerar. Prova antal och bokningsöversikt med exempeldata utan att något skickas eller sparas.',
    path: '/s/bergs-agg',
    noindex: true,
  });

  return (
    <div className="min-h-dvh bg-background">
      <LandingNavbar />
      <main id="main-content" className="container mx-auto max-w-4xl px-5 pt-24 pb-16">
        <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <strong className="block mb-1">Demo – en påhittad säljsida</strong>
          Alla uppgifter är exempel. Du kan prova bokningsöversikten, men ingen beställning, betalning eller kontakt med en säljare sker. Inget sparas.
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border bg-card p-6 sm:p-8">
            <div className="mb-6 flex h-36 items-center justify-center rounded-2xl bg-primary/10" aria-hidden="true">
              <Egg className="h-20 w-20 text-primary" />
            </div>
            <p className="text-sm font-medium text-primary mb-2">Agdas äggbod · Exempel</p>
            <h1 className="font-serif text-3xl mb-3">Bergs ägg</h1>
            <p className="text-muted-foreground leading-relaxed">Färska ägg från vår lilla hönsgård. Välj antal kartor och se din bokningsöversikt.</p>
            <p className="flex items-center gap-2 mt-5"><MapPin className="h-4 w-4" aria-hidden="true" /> Berg, Ljungsbro (exempel)</p>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t pt-5">
              <div><dt className="text-sm text-muted-foreground">Per karta</dt><dd className="font-semibold">12 ägg · 60 kr</dd></div>
              <div><dt className="text-sm text-muted-foreground">Tillgängligt i exemplet</dt><dd className="font-semibold">6 kartor</dd></div>
            </dl>
            <h2 className="font-semibold mt-6 mb-2">Hämtning</h2>
            <p className="text-sm text-muted-foreground">I en riktig säljsida visar du plats och information om hämtning här.</p>
          </section>
          <section className="rounded-3xl border bg-card p-6 sm:p-8 self-start" aria-labelledby="example-booking-title">
            <h2 id="example-booking-title" className="font-serif text-2xl mb-5">Prova en bokning</h2>
            <Label htmlFor="example-packs">Antal kartor med 12 ägg</Label>
            <select id="example-packs" value={packs} onChange={(event) => { setPacks(Number(event.target.value)); setPreviewed(false); }} className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 text-base">
              {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} {count === 1 ? 'karta' : 'kartor'} – {count * 60} kr</option>)}
            </select>
            <p className="my-5 flex justify-between gap-3 text-lg"><span>Summa</span><strong>{packs * 60} kr</strong></p>
            <Button type="button" className="w-full h-12" onClick={() => setPreviewed(true)}>Visa bokningsexempel</Button>
            {previewed && (
              <div role="status" className="mt-4 rounded-xl bg-primary/10 p-4 text-sm">
                <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Så kan bokningen se ut</p>
                <p className="mt-2">{packs} {packs === 1 ? 'karta' : 'kartor'}, {packs * 12} ägg, totalt {packs * 60} kr. I den riktiga säljsidan lämnar köparen sina kontaktuppgifter och säljaren får en bokningsförfrågan.</p>
                <p className="mt-2 font-medium">Det här var bara ett exempel. Inget har skickats eller sparats.</p>
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">Du behöver inte lämna några kontaktuppgifter för att prova.</p>
            <div className="mt-8 border-t pt-6">
              <h2 className="font-semibold mb-2">Vill du sälja dina egna ägg?</h2>
              <p className="text-sm text-muted-foreground mb-4">Skapa en säljsida med din bild, ditt pris och din information om hämtning.</p>
              <Button asChild variant="outline" className="w-full h-auto min-h-12 whitespace-normal"><a href="/login?mode=register">Skapa din egen säljsida <ArrowRight className="ml-2 h-4 w-4 shrink-0" aria-hidden="true" /></a></Button>
              <a href="/salja-agg" className="mt-4 block text-sm text-primary underline underline-offset-4">Läs mer om Agdas äggbod</a>
            </div>
          </section>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
