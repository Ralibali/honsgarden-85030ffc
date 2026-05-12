import React, { lazy, Suspense } from 'react';
import LandingNavbar from '@/components/LandingNavbar';
import ProductDashboardPreview from '@/components/ProductDashboardPreview';
import { useSeo } from '@/hooks/useSeo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Bird,
  Bot,
  CalendarDays,
  Camera,
  Check,
  ClipboardCheck,
  CloudSun,
  Download,
  Egg,
  HeartPulse,
  Link as LinkIcon,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  ShoppingBasket,
  Users,
  Wallet,
  Wheat,
} from 'lucide-react';

const StickyMobileCTA = lazy(() => import('@/components/StickyMobileCTA'));
const LandingFooter = lazy(() => import('@/components/LandingFooter'));
const ActivityPulse = lazy(() => import('@/components/ActivityPulse'));

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 } as const,
  whileInView: { opacity: 1, y: 0 } as const,
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.42, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const staggerContainer = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const staggerItem = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

const productModules = [
  { icon: Egg, title: 'Ägglogg', desc: 'Logga dagens ägg snabbt, följ trender och se hur flocken värper över tid.', href: '/agglogg' },
  { icon: Bird, title: 'Flock & hönsprofiler', desc: 'Samla hönor, ras, bilder, hälsa, anteckningar och historik på ett ställe.', href: '/app-for-honsagare' },
  { icon: BarChart3, title: 'Statistik & insikter', desc: 'Se veckor, månader, snitt, avvikelser, topplistor och utveckling i tydliga vyer.', href: '/login?mode=register' },
  { icon: ReceiptText, title: 'Agdas äggbod', desc: 'Skapa säljsidor med bild, pris, Swish, bokningsförfrågningar, kundlista och export.', href: '/salja-agg', badge: 'Sälj ägg' },
  { icon: Wheat, title: 'Foder & ekonomi', desc: 'Följ foderinköp, kostnad per ägg, intäkter, utgifter och försäljningsvärde.', href: '/foderkostnad-hons' },
  { icon: CalendarDays, title: 'Kalender & rutiner', desc: 'Planera rengöring, vatten, foder, kvalsterkontroll, ruggning och säsongssysslor.', href: '/honskalender' },
  { icon: Egg, title: 'Kläckningskalender', desc: 'Följ dag 1–21, lysning, lockdown, milstolpar och resultat för varje kläckning.', href: '/klackningskalender' },
  { icon: CloudSun, title: 'Väder & påverkan', desc: 'Se hur väder, värme, kyla och säsong kan påverka ägg, rutiner och flock.', href: '/login?mode=register' },
  { icon: Bot, title: 'Agda AI', desc: 'Få råd, säljtexter, veckorapporter och nästa steg baserat på din egen hönsgård.', href: '/login?mode=register', badge: 'Plus' },
  { icon: MessageCircle, title: 'Community', desc: 'Skriv inlägg, dela frågor, tips och erfarenheter med andra hönsägare.', href: '/login?mode=register' },
  { icon: ClipboardCheck, title: 'Rapporter & export', desc: 'Kopiera rapporter, exportera CSV och samla underlag för uppföljning.', href: '/login?mode=register' },
];

const agdaFeatures = [
  { icon: LinkIcon, title: 'Egen försäljningslänk', desc: 'Skapa en enkel länk för dina ägg och dela den i Facebookgrupper, SMS eller på gården.' },
  { icon: Camera, title: 'Bild, pris och hämtning', desc: 'Visa vad du säljer, pris per karta, lager, hämtinformation och tydlig beskrivning.' },
  { icon: Wallet, title: 'Swish & betalstatus', desc: 'Visa Swishnummer, Swish-meddelande och följ vilka bokningar som är betalda.' },
  { icon: ShoppingBasket, title: 'Bokningar & kunder', desc: 'Köpare skickar namn, kontakt, antal kartor och meddelande direkt via säljsidan.' },
  { icon: Users, title: 'Kundöversikt', desc: 'Se kunder, återkommande köpare, snittorder och försäljningsvärde över tid.' },
  { icon: Download, title: 'Export', desc: 'Kopiera kundlista eller exportera bokningar som CSV till Excel eller Google Sheets.' },
];

const agdaSteps = [
  { step: '1', title: 'Skapa säljsida', desc: 'Fyll i rubrik, bild, pris, plats, lager, hämtning och Swish.' },
  { step: '2', title: 'Dela länken', desc: 'Skicka länken i SMS, Messenger, Instagram eller lokal Facebookgrupp.' },
  { step: '3', title: 'Ta emot bokningar', desc: 'Köparen skickar kontaktuppgifter, antal kartor och önskat meddelande.' },
  { step: '4', title: 'Följ upp i Agda', desc: 'Markera betald, hämtad eller avbokad och exportera vid behov.' },
];

const audience = [
  { icon: Bird, title: 'Hobbyhönsägaren', desc: 'För dig som vill logga ägg, följa hönor, hälsa och rutiner utan kalkylark.' },
  { icon: ReceiptText, title: 'Du som säljer ägg lokalt', desc: 'För dig som vill ha säljsida, Swish, bokningar och kundöversikt på ett ställe.' },
  { icon: HeartPulse, title: 'Du som vill upptäcka mönster', desc: 'För dig som vill förstå ruggning, väder, foder, avvikelser och flockens rytm.' },
];

const trustItems = ['Byggt för svenska hönsägare', 'Mobil, iPad och dator', 'Ingen appinstallation krävs', 'Gratis att börja', 'Export till CSV', 'Dina data i ditt konto', 'Community och feedback', 'Premium med AI och rapporter'];

const freeFeatures = ['Äggloggning', 'Upp till 10 hönor', 'Hälsologg', 'Grundstatistik', 'Dagbok', 'Mobilvänlig PWA'];
const plusFeatures = ['Allt i Gratis', 'Obegränsat antal hönor', 'Agda AI', 'Avancerad statistik', 'Foder och ekonomi', 'Smarta rapporter', 'Påminnelser', 'Kläckningsstöd'];

const faqs = [
  { q: 'Vad erbjuder Hönsgården exakt?', a: 'Hönsgården samlar ägglogg, hönsprofiler, flockhälsa, statistik, foderkostnad, ekonomi, kalender, påminnelser, kläckningskalender, väderpåverkan, community, feedback, rapporter, export, Agda AI och Agdas äggbod för lokal äggförsäljning.' },
  { q: 'Vad är Agdas äggbod?', a: 'Agdas äggbod är Hönsgårdens försäljningscenter. Du kan skapa säljsidor med bild, pris, Swish, lager, hämtinformation och ta emot bokningsförfrågningar från kunder via en enkel länk.' },
  { q: 'Kan jag hantera kunder och bokningar?', a: 'Ja. Bokningar visas i appen med kundnamn, kontakt, antal kartor, summa och status. Du kan markera betald, hämtad eller avbokad och exportera kundlistor.' },
  { q: 'Finns community?', a: 'Ja. Communityt är till för inlägg, frågor och tips mellan hönsägare. Inlägg sparas i databasen och kan rapporteras/modereras.' },
  { q: 'Vad ingår i Plus?', a: 'Plus ger mer AI-stöd, rapporter, avancerade insikter, obegränsat antal hönor och smartare hjälp för ekonomi, flock och vardagsrutiner.' },
];

export default function IndexUpdated() {
  useSeo({
    title: 'Hönsgården – ägglogg, flock, Agdas äggbod, community och AI',
    description: 'Hönsgården är en svensk app för hönsägare. Logga ägg, följ flocken, sälj ägg med Agdas äggbod, hantera kunder, få statistik, AI-råd, community och rapporter.',
    path: '/',
    ogImage: 'https://honsgarden.se/blog-images/hens-garden.jpg',
    jsonLd: [
      { '@type': 'SoftwareApplication', name: 'Hönsgården', applicationCategory: 'LifestyleApplication', operatingSystem: 'Web, iOS, Android', description: 'Svensk app för hönsägare med ägglogg, hönsprofiler, statistik, kalender, foderkostnad, ekonomi, Agdas äggbod, community, väderpåverkan, rapporter och AI-stöd.', offers: { '@type': 'Offer', price: '0', priceCurrency: 'SEK' } },
      { '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  });

  return (
    <main id="main-content" className="min-h-screen bg-background overflow-x-hidden">
      <Suspense fallback={null}><StickyMobileCTA /></Suspense>
      <LandingNavbar />

      <section className="relative flex flex-col justify-center pt-24 pb-12 sm:min-h-screen sm:pt-16 sm:pb-10" style={{ background: 'linear-gradient(135deg, #f5f0e8 0%, #eef5ec 50%, #f5f0e8 100%)' }}>
        <div className="container max-w-6xl mx-auto px-5 sm:px-6 relative z-10">
          <div className="grid lg:grid-cols-[1.04fr_0.96fr] gap-10 lg:gap-14 items-center">
            <div className="text-center lg:text-left">
              <motion.div {...fadeUp(0)} className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-4">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs px-3 py-1">Svensk app för hönsägare</Badge>
                <Badge variant="secondary" className="bg-warning/15 text-warning-foreground border-warning/30 text-xs px-3 py-1">Agdas äggbod</Badge>
                <Badge variant="secondary" className="bg-background/70 text-foreground border-border text-xs px-3 py-1">Gratis att börja</Badge>
              </motion.div>
              <motion.h1 {...fadeUp(0.05)} className="font-serif text-[2rem] sm:text-5xl md:text-6xl text-foreground leading-[1.08] mb-4 sm:mb-5">
                Mer koll på din hönsgård – <span className="text-primary">från ägg till försäljning</span>
              </motion.h1>
              <motion.p {...fadeUp(0.08)} className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed mb-5 sm:mb-6">
                Hönsgården samlar ägglogg, flock, hönsprofiler, statistik, foderkostnad, kalender, väder, community, rapporter och Agdas äggbod på samma plats. Logga vardagen, förstå mönstren och sälj ägg utan Excel-kaos.
              </motion.p>
              <motion.div {...fadeUp(0.12)} className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-5">
                <Button asChild size="lg" className="h-12 sm:h-13 px-8 text-base gap-2 shadow-[0_8px_30px_hsl(var(--primary)/0.3)]"><a href="/login?mode=register">Skapa konto gratis <ArrowRight className="h-4 w-4" /></a></Button>
                <Button asChild variant="outline" size="lg" className="h-12 sm:h-13 px-8 text-base border-primary/30 text-primary hover:bg-primary/5"><a href="/salja-agg">Se Agdas äggbod</a></Button>
              </motion.div>
              <motion.div {...fadeUp(0.15)} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-2xl mx-auto lg:mx-0">
                {['Logga ägg och hönor', 'Sälj ägg med egen länk', 'AI, statistik och community'].map((item) => <div key={item} className="flex items-center justify-center lg:justify-start gap-2 rounded-xl bg-background/70 border border-border/50 px-3 py-2 text-sm text-foreground"><Check className="h-4 w-4 text-primary shrink-0" />{item}</div>)}
              </motion.div>
              <motion.div {...fadeUp(0.18)} className="mt-4 flex justify-center lg:justify-start"><Suspense fallback={null}><ActivityPulse /></Suspense></motion.div>
            </div>
            <motion.div {...fadeUp(0.12)} className="flex justify-center lg:justify-end">
              <ProductDashboardPreview />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-background">
        <div className="container max-w-6xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">Det här erbjuder Hönsgården idag</h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">Hönsgården är inte bara en ägglogg längre. Det är ett komplett arbetsbord för dig som vill förstå flocken, sköta vardagen, sälja ägg och bygga bättre rutiner över tid.</p>
          </motion.div>
          <motion.div variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {productModules.map((f) => <motion.a key={f.title} href={f.href} variants={staggerItem} className="relative p-6 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">{f.badge && <Badge className="absolute top-4 right-4 bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">{f.badge}</Badge>}<div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4"><f.icon className="h-5 w-5 text-primary" /></div><h3 className="font-serif text-lg text-foreground mb-1.5">{f.title}</h3><p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p></motion.a>)}
          </motion.div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-secondary/20">
        <div className="container max-w-6xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center max-w-3xl mx-auto mb-12"><Badge className="mb-3 bg-primary/10 text-primary border-primary/20">För dig som säljer ägg</Badge><h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">Agdas äggbod gör lokal äggförsäljning enklare</h2><p className="text-sm sm:text-base text-muted-foreground leading-relaxed">Skapa en säljsida, visa bild och pris, ta emot bokningar och följ upp kunder, betalning, hämtning och värde direkt i Hönsgården.</p></motion.div>
          <motion.div variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {agdaFeatures.map((f) => <motion.div key={f.title} variants={staggerItem} className="p-6 rounded-2xl bg-card border border-border shadow-sm"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4"><f.icon className="h-5 w-5 text-primary" /></div><h3 className="font-serif text-lg text-foreground mb-1.5">{f.title}</h3><p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p></motion.div>)}
          </motion.div>
          <motion.div {...fadeUp(0.1)} className="mt-10 rounded-3xl bg-background border border-primary/15 p-6 sm:p-8 text-center shadow-sm"><p className="text-sm text-muted-foreground mb-2">Exempel på säljlänk</p><p className="font-mono text-sm sm:text-base text-foreground break-all bg-muted/40 rounded-xl px-4 py-3 mb-5">https://honsgarden.se/s/bergs-agg</p><Button asChild size="lg" className="gap-2"><a href="/login?mode=register">Skapa din första säljsida <ArrowRight className="h-4 w-4" /></a></Button></motion.div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-background">
        <div className="container max-w-6xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center max-w-3xl mx-auto mb-12"><h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">Så fungerar Agdas äggbod i praktiken</h2><p className="text-sm sm:text-base text-muted-foreground leading-relaxed">Från första säljlistan till uppföljning av betalning, hämtning och återkommande kunder.</p></motion.div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {agdaSteps.map((s) => <Card key={s.step} className="border-primary/15 shadow-sm"><CardContent className="p-5 text-center"><span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold mb-3">{s.step}</span><h3 className="font-serif text-base text-foreground mb-2">{s.title}</h3><p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p></CardContent></Card>)}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-secondary/20">
        <div className="container max-w-6xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center max-w-3xl mx-auto mb-12"><h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">För vem passar Hönsgården?</h2><p className="text-sm sm:text-base text-muted-foreground leading-relaxed">Oavsett om du har några få hönor, kläcker kycklingar eller säljer ägg lokalt får du bättre ordning.</p></motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {audience.map((a) => <Card key={a.title} className="shadow-sm"><CardContent className="p-6"><div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center mb-4"><a.icon className="h-5 w-5 text-primary" /></div><h3 className="font-serif text-lg text-foreground mb-2">{a.title}</h3><p className="text-sm text-muted-foreground leading-relaxed">{a.desc}</p></CardContent></Card>)}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-background">
        <div className="container max-w-5xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center mb-10"><h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">Tryggt och enkelt att komma igång</h2></motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {trustItems.map((item) => <div key={item} className="rounded-2xl bg-card border border-border px-4 py-3 flex items-center gap-2 text-sm text-foreground"><ShieldCheck className="h-4 w-4 text-primary shrink-0" />{item}</div>)}
          </div>
        </div>
      </section>

      <section id="priser" className="relative z-10 py-20 sm:py-28 bg-secondary/20">
        <div className="container max-w-5xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center mb-10"><h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">Börja gratis – uppgradera när du vill ha mer hjälp</h2><p className="text-muted-foreground text-sm sm:text-base">Gratis ger dig grunden. Plus ger mer AI, insikter, rapporter och obegränsad användning.</p></motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <PricingCard title="Gratis" price="0 kr" desc="För att komma igång ordentligt" features={freeFeatures} cta="Skapa konto gratis" />
            <PricingCard title="Plus – Månad" price="19 kr/mån" desc="För mer statistik och smartare stöd" features={plusFeatures} cta="Prova Plus" />
            <PricingCard highlighted title="Plus – År" price="149 kr/år" desc="Bästa värdet för aktiva hönsägare" features={plusFeatures} cta="Välj årsplan" />
          </div>
        </div>
      </section>

      <section className="relative z-10 py-20 sm:py-28" style={{ background: 'linear-gradient(180deg, hsl(var(--background)) 0%, #f5f0e8 50%, hsl(var(--background)) 100%)' }}>
        <div className="container max-w-2xl mx-auto px-5 sm:px-6"><motion.div {...fadeUp()} className="text-center mb-10"><h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-2">Vanliga frågor</h2></motion.div><motion.div {...fadeUp(0.1)}><Accordion type="single" collapsible className="space-y-2">{faqs.map((f, i) => <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-xl overflow-hidden px-1"><AccordionTrigger className="text-sm sm:text-base font-medium text-foreground hover:no-underline px-4 text-left">{f.q}</AccordionTrigger><AccordionContent className="text-sm text-muted-foreground px-4 pb-4 leading-relaxed">{f.a}</AccordionContent></AccordionItem>)}</Accordion></motion.div></div>
      </section>

      <section className="relative z-10 pb-10 sm:pb-16">
        <div className="container max-w-3xl mx-auto px-5 sm:px-6"><motion.div {...fadeUp()} className="rounded-3xl bg-gradient-to-br from-primary/10 via-accent/5 to-warning/5 border border-primary/15 p-8 sm:p-12 text-center"><div className="text-5xl mb-4">🐔</div><h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">Flocken berättar mer än man tror</h2><p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">När du loggar ägg, foder, hälsa, försäljning, väder och rutiner får du något bättre än magkänsla: sparad erfarenhet som hjälper dig fatta bättre beslut.</p><Button asChild size="lg" className="h-14 px-10 text-lg gap-2 shadow-[0_8px_30px_hsl(var(--primary)/0.4)] hover:scale-[1.02] transition-transform"><a href="/login?mode=register">Skapa konto gratis <ArrowRight className="h-5 w-5" /></a></Button><p className="text-xs text-muted-foreground mt-4">Börja gratis · Mobilvänligt · Byggt för svenska hönsägare</p></motion.div></div>
      </section>

      <Suspense fallback={null}><LandingFooter /></Suspense>
    </main>
  );
}

function PricingCard({ title, price, desc, features, cta, highlighted = false }: { title: string; price: string; desc: string; features: string[]; cta: string; highlighted?: boolean }) {
  return (
    <motion.div {...fadeUp(highlighted ? 0.2 : 0.1)} className={`relative p-6 sm:p-8 rounded-2xl shadow-sm ${highlighted ? 'border-2 border-primary bg-primary/5' : 'bg-card border border-border'}`}>
      {highlighted && <div className="absolute -top-3 left-1/2 -translate-x-1/2"><Badge className="bg-primary text-primary-foreground text-xs px-3 py-1">Spara 35%</Badge></div>}
      <h3 className="font-serif text-xl text-foreground mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm mb-6">{desc}</p>
      <p className="text-4xl font-bold text-foreground mb-6">{price}</p>
      <ul className="space-y-3 mb-8">{features.map((f) => <li key={f} className="flex items-center gap-2.5 text-sm text-foreground"><Check className="h-4 w-4 text-primary shrink-0" />{f}</li>)}</ul>
      <Button asChild variant={highlighted ? 'default' : 'outline'} className="w-full h-11"><a href="/login?mode=register">{cta}</a></Button>
    </motion.div>
  );
}
