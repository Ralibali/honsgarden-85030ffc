import React, { useState, useMemo } from 'react';
import { useSeo } from '@/hooks/useSeo';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Egg, ArrowRight, Calculator, TrendingUp, Coins } from 'lucide-react';
import VisitorWelcomePopup from '@/components/VisitorWelcomePopup';

export default function EggCalculator() {
  const [henCount, setHenCount] = useState(5);
  const [eggsPerHenWeek, setEggsPerHenWeek] = useState(5);
  const [feedCostMonth, setFeedCostMonth] = useState(300);
  const [otherCostMonth, setOtherCostMonth] = useState(100);
  const [eggPricePer, setEggPricePer] = useState(5);

  const results = useMemo(() => {
    const eggsPerWeek = henCount * eggsPerHenWeek;
    const eggsPerMonth = eggsPerWeek * 4.33;
    const eggsPerYear = eggsPerWeek * 52;
    const totalCostMonth = feedCostMonth + otherCostMonth;
    const totalCostYear = totalCostMonth * 12;
    const costPerEgg = eggsPerMonth > 0 ? totalCostMonth / eggsPerMonth : 0;
    const revenueMonth = eggsPerMonth * eggPricePer;
    const revenueYear = eggsPerYear * eggPricePer;
    const profitMonth = revenueMonth - totalCostMonth;
    const profitYear = revenueYear - totalCostYear;

    return {
      eggsPerWeek: Math.round(eggsPerWeek),
      eggsPerMonth: Math.round(eggsPerMonth),
      eggsPerYear: Math.round(eggsPerYear),
      costPerEgg: costPerEgg.toFixed(2),
      totalCostMonth: Math.round(totalCostMonth),
      totalCostYear: Math.round(totalCostYear),
      revenueMonth: Math.round(revenueMonth),
      revenueYear: Math.round(revenueYear),
      profitMonth: Math.round(profitMonth),
      profitYear: Math.round(profitYear),
    };
  }, [henCount, eggsPerHenWeek, feedCostMonth, otherCostMonth, eggPricePer]);

  const faqs = useMemo(() => [
    { q: 'Hur många ägg lägger en höna per dag?', a: 'En genomsnittlig värphöna lägger cirka 4–6 ägg per vecka, alltså ungefär ett ägg varannan dag. Rasen, årstiden och hönans ålder påverkar mängden.' },
    { q: 'Vad kostar det att ha höns per månad?', a: 'En flock på 5 höns kostar typiskt 300–500 kr/mån i foder, strö och tillbehör. Med äggförsäljning kan du ofta gå plus.' },
    { q: 'Hur beräknar jag kostnad per ägg?', a: 'Dela din totala månadskostnad (foder + strö + övrigt) med antalet ägg du samlar in per månad. Använd kalkylatorn ovan för en snabb beräkning!' },
    { q: 'Lönar sig det att ha höns?', a: 'Med 5+ höns och bra värpning kan du producera ägg billigare än butikspris. Dessutom får du färskare, godare ägg och en trevlig hobby.' },
  ], []);

  const calculatorJsonLd = useMemo(() => [
    {
      '@type': 'WebApplication',
      name: 'Äggkalkylator – Hönsgården',
      url: 'https://honsgarden.se/verktyg/aggkalkylator',
      applicationCategory: 'UtilityApplication',
      operatingSystem: 'Web',
      description: 'Räkna ut vad dina ägg kostar per styck och om din hönsgård är lönsam.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'SEK' },
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Hem', item: 'https://honsgarden.se' },
        { '@type': 'ListItem', position: 2, name: 'Verktyg', item: 'https://honsgarden.se/verktyg/aggkalkylator' },
        { '@type': 'ListItem', position: 3, name: 'Äggkalkylator', item: 'https://honsgarden.se/verktyg/aggkalkylator' },
      ],
    },
  ], [faqs]);

  useSeo({
    title: 'Äggkalkylator – Beräkna kostnad per ägg | Hönsgården',
    description: 'Räkna ut vad dina ägg kostar, hur mycket du producerar och om din hönsgård går plus. Gratis kalkylator för hönsägare.',
    path: '/verktyg/aggkalkylator',
    ogImage: '/blog-images/eggs-basket.jpg',
    jsonLd: calculatorJsonLd,
  });

  return (
    <div className="min-h-screen bg-background">
      <VisitorWelcomePopup />

      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-xl">🐔</span>
            <span className="font-serif text-lg text-foreground">Hönsgården</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/blogg" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Blogg</Link>
            <Link to="/login">
              <Button size="sm" className="rounded-xl text-xs gap-1">
                <Egg className="h-3 w-3" /> Kom igång
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 text-primary text-xs font-medium mb-4">
            <Calculator className="h-3.5 w-3.5" /> Gratis verktyg
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif text-foreground mb-3">
            Äggkalkylator
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Räkna ut vad dina ägg kostar per styck, hur många ägg du producerar och om din hönsgård går plus eller minus.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input */}
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
            <h2 className="font-serif text-lg text-foreground flex items-center gap-2">
              <Egg className="h-5 w-5 text-primary" /> Dina uppgifter
            </h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="henCount" className="text-sm">Antal höns</Label>
                <Input id="henCount" type="number" min={1} max={500} value={henCount} onChange={e => setHenCount(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label htmlFor="eggsPerHen" className="text-sm">Ägg per höna/vecka</Label>
                <Input id="eggsPerHen" type="number" min={0} max={7} step={0.5} value={eggsPerHenWeek} onChange={e => setEggsPerHenWeek(Number(e.target.value) || 0)} />
                <p className="text-[10px] text-muted-foreground mt-1">Vanligt: 4–6 ägg/vecka för bra värpraser</p>
              </div>
              <div>
                <Label htmlFor="feedCost" className="text-sm">Foderkostnad (kr/mån)</Label>
                <Input id="feedCost" type="number" min={0} value={feedCostMonth} onChange={e => setFeedCostMonth(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label htmlFor="otherCost" className="text-sm">Övriga kostnader (kr/mån)</Label>
                <Input id="otherCost" type="number" min={0} value={otherCostMonth} onChange={e => setOtherCostMonth(Number(e.target.value) || 0)} />
                <p className="text-[10px] text-muted-foreground mt-1">Strö, grit, veterinär, etc.</p>
              </div>
              <div>
                <Label htmlFor="eggPrice" className="text-sm">Äggpris vid försäljning (kr/st)</Label>
                <Input id="eggPrice" type="number" min={0} step={0.5} value={eggPricePer} onChange={e => setEggPricePer(Number(e.target.value) || 0)} />
                <p className="text-[10px] text-muted-foreground mt-1">Vad du säljer eller sparar per ägg</p>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
              <h2 className="font-serif text-lg text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" /> Produktion
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Ägg/vecka', value: results.eggsPerWeek },
                  { label: 'Ägg/månad', value: results.eggsPerMonth },
                  { label: 'Ägg/år', value: results.eggsPerYear },
                ].map(r => (
                  <div key={r.label} className="text-center p-3 rounded-xl bg-muted/50">
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{r.value}</p>
                    <p className="text-[10px] text-muted-foreground">{r.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
              <h2 className="font-serif text-lg text-foreground mb-4 flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" /> Ekonomi
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Kostnad per ägg</span>
                  <span className="text-lg font-bold text-foreground">{results.costPerEgg} kr</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Total kostnad/mån</span>
                  <span className="text-sm font-medium text-foreground">{results.totalCostMonth} kr</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Äggvärde/mån</span>
                  <span className="text-sm font-medium text-foreground">{results.revenueMonth} kr</span>
                </div>
                <div className={`flex justify-between items-center py-3 px-3 rounded-xl ${results.profitMonth >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
                  <span className="text-sm font-medium text-foreground">Resultat/månad</span>
                  <span className={`text-xl font-bold ${results.profitMonth >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {results.profitMonth >= 0 ? '+' : ''}{results.profitMonth} kr
                  </span>
                </div>
                <div className={`flex justify-between items-center py-3 px-3 rounded-xl ${results.profitYear >= 0 ? 'bg-success/5' : 'bg-destructive/5'}`}>
                  <span className="text-sm text-muted-foreground">Resultat/år</span>
                  <span className={`text-lg font-bold ${results.profitYear >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {results.profitYear >= 0 ? '+' : ''}{results.profitYear} kr
                  </span>
                </div>
              </div>
            </div>

            {/* CTA inline */}
            <div className="bg-gradient-to-br from-primary/5 via-card to-accent/5 rounded-2xl p-5 border border-border/30 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Vill du logga ägg och kostnader automatiskt?
              </p>
              <Link to="/login?mode=register">
                <Button className="rounded-xl gap-2">
                  <Egg className="h-4 w-4" /> Testa Hönsgården gratis
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <section className="mt-14 sm:mt-20">
          <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-6 text-center">Vanliga frågor om äggekonomi</h2>
          <div className="max-w-2xl mx-auto space-y-2">
            {faqs.map((f, i) => (
              <details key={i} className="border border-border rounded-xl overflow-hidden group">
                <summary className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-muted/50 transition-colors cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="text-sm sm:text-base font-medium text-foreground pr-4">{f.q}</span>
                </summary>
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 -mt-1">
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Internal links */}
        <section className="mt-14 text-center">
          <h2 className="font-serif text-lg text-foreground mb-4">Läs mer om höns</h2>
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/blogg" className="text-sm text-primary hover:underline">Blogg</Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/om-oss" className="text-sm text-primary hover:underline">Om oss</Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/blogg/kategori/nyborjare" className="text-sm text-primary hover:underline">Nybörjarguider</Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/blogg/kategori/halsa" className="text-sm text-primary hover:underline">Hönshälsa</Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Hönsgården</span>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-foreground transition-colors">Startsidan</Link>
            <Link to="/blogg" className="hover:text-foreground transition-colors">Blogg</Link>
            <Link to="/om-oss" className="hover:text-foreground transition-colors">Om oss</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Villkor</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
