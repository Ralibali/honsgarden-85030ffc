import React, { lazy, Suspense } from 'react';
import LandingNavbar from '@/components/LandingNavbar';
import { useSeo } from '@/hooks/useSeo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Egg,
  ArrowRight,
  ChartBar as BarChart2,
  Star,
  Check,
  Bot,
  Wheat,
  CalendarDays,
  Bird,
  ClipboardCheck,
  Calculator,
  ReceiptText,
  Camera,
  Wallet,
  ShoppingBasket,
  Download,
  Share2,
  Link as LinkIcon,
} from 'lucide-react';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { motion } from 'framer-motion';

const StickyMobileCTA = lazy(() => import('@/components/StickyMobileCTA'));
const LandingFooter = lazy(() => import('@/components/LandingFooter'));
const ActivityPulse = lazy(() => import('@/components/ActivityPulse'));

import appMockup from '@/assets/app-mockup-hero.png';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 } as const,
  whileInView: { opacity: 1, y: 0 } as const,
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

const features = [
  { icon: Egg, title: 'Äggloggning', desc: 'Logga dagens ägg på några sekunder och se hur värpningen förändras över tid.', href: '/agglogg' },
  { icon: Bird, title: 'Flock och hönsprofiler', desc: 'Samla namn, ras, bild, anteckningar och historik för varje höna i flocken.', href: '/app-for-honsagare' },
  { icon: ReceiptText, title: 'Agda-säljgenerator', desc: 'Skapa egna säljsidor för ägg med bild, Swish, bokningsförfrågningar, lager och delningslänk.', href: '/login?mode=register', badge: 'NYHET' },
  { icon: CalendarDays, title: 'Hönskalender', desc: 'Håll koll på rutiner, rengöring, kvalsterkontroll, ruggning och säsong.', href: '/honskalender' },
  { icon: Wheat, title: 'Foderkostnad', desc: 'Registrera foderinköp och förstå vad dina ägg faktiskt kostar att producera.', href: '/foderkostnad-hons' },
  { icon: Egg, title: 'Kläckningskalender', desc: 'Följ dag 1 till 21 med milstolpar för lysning, vändning och kläckning.', href: '/klackningskalender' },
  { icon: Bot, title: 'Agda AI', desc: 'Få hjälp, säljte xter och vardagstips baserat på din egen hönsgård och logghistorik.', href: '/login?mode=register', badge: 'PLUS' },
  { icon: BarChart2, title: 'Statistik och insikter', desc: 'Följ trender, topplistor, snitt per höna och utveckling över tid.', href: '/login?mode=register' },
];

const agdaFeatures = [
  { icon: LinkIcon, title: 'Egen försäljningslänk', desc: 'Skapa en enkel länk som honsgarden.se/s/bergs-agg och dela den i Facebookgrupper, SMS eller på gården.' },
  { icon: Camera, title: 'Bild på det du säljer', desc: 'Ta en ny bild eller välj från galleri. Bilden visas som banner på säljsidan.' },
  { icon: Wallet, title: 'Swish och prislista', desc: 'Visa Swishnummer, Swish-meddelande, pris per karta och prisförslag för 6-, 12- och 30-pack.' },
  { icon: ShoppingBasket, title: 'Bokningsförfrågningar', desc: 'Köpare kan skicka namn, kontakt, antal kartor och meddelande direkt via säljsidan.' },
  { icon: ClipboardCheck, title: 'Ordervy i appen', desc: 'Se alla bokningar, summa, status, säljlista, kundkontakt och markera betald eller hämtad.' },
  { icon: Download, title: 'Export och kundlista', desc: 'Kopiera kundlista eller exportera bokningar som CSV för Excel eller Google Sheets.' },
];

const problems = [
  'Du minns inte exakt när äggproduktionen började gå ner.',
  'Du vet inte vad fodret faktiskt kostar per ägg.',
  'Du har hälsoanteckningar i mobilen, lappar och huvudet samtidigt.',
  'Du vill sälja ägg men saknar en enkel sida för pris, Swish, bild och bokningar.',
];

const betterThanNotes = [
  { icon: ClipboardCheck, title: 'Appen påminner dig', desc: 'En anteckningsbok säger inte till när du borde kolla kvalster, fylla på foder eller följa upp en kläckning.' },
  { icon: BarChart2, title: 'Historiken blir användbar', desc: 'Du ser trender, jämförelser, topplistor och snitt – inte bara gamla siffror i en lista.' },
  { icon: Calculator, title: 'Ekonomin blir tydlig', desc: 'När ägg, foder och försäljning finns på samma plats kan du förstå kostnad och intäkt bättre.' },
];

const testimonials = [
  { text: 'Äntligen vet jag vilken höna som slutat värpa. Tre månaders data – och svaret stod klart.', name: 'Karin S.', meta: '8 hönor, Dalarna' },
  { text: 'Jag trodde jag hade koll på fodret, men först när jag räknade per ägg förstod jag vad flocken faktiskt kostade.', name: 'Anna W.', meta: '6 hönor, Uppland' },
  { text: 'Det bästa är att jag kan logga direkt i mobilen när jag ändå står vid redena.', name: 'Lars M.', meta: '14 hönor, Skåne' },
];

const faqs = [
  { q: 'Vad är Hönsgården?', a: 'Hönsgården är en svensk app för hobbyhönsägare. Du kan logga ägg, följa hönor och flockar, skapa rutiner, räkna foderkostnad, sälja ägg via Agda-säljgeneratorn och få bättre koll på hönsgårdens vardag.' },
  { q: 'Vad är Agda-säljgeneratorn?', a: 'Agda-säljgeneratorn hjälper dig skapa en egen försäljningssida för ägg. Du kan lägga upp bild, pris, Swish, hämtinformation och låta köpare skicka bokningsförfrågningar via en enkel länk.' },
  { q: 'Kan jag se vem som beställt ägg?', a: 'Ja. Bokningsförfrågningar visas inne i appen under Agda sälj. Du ser kundnamn, kontakt, antal kartor, säljlista, summa, status och kan markera betald, hämtad eller avbokad.' },
  { q: 'Kan jag exportera beställningar?', a: 'Ja. Du kan kopiera kundlista och exportera bokningar som CSV, så att de kan öppnas i Excel eller Google Sheets.' },
  { q: 'Varför är det bättre än anteckningsbok eller Excel?', a: 'Anteckningar är bra, men de räknar inte åt dig. Hönsgården gör historiken användbar: du får trender, statistik, påminnelser, kostnad per ägg, säljsidor och tydligare överblick.' },
  { q: 'Är Hönsgården gratis?', a: 'Ja, du kan börja gratis. Vissa mer avancerade funktioner, som AI, ekonomi, foder och utökade säljfunktioner kan ingå i Plus.' },
  { q: 'Fungerar appen i mobilen och på dator?', a: 'Ja. Hönsgården är byggd för mobil, tablet och dator. Du kan logga ute vid hönshuset och hantera säljlistor eller export på större skärm.' },
];

const freeFeatures = ['Äggloggning', 'Upp till 10 hönor', 'Hälsologg', 'Grundstatistik', 'Dagbok', 'Fungerar i mobilen'];
const plusFeatures = ['Allt i Gratis', 'Obegränsat antal hönor', 'Agda AI', 'Agda-säljgenerator', 'Bokningsförfrågningar', 'Foder och ekonomi', 'Smarta påminnelser', 'Kläckningsstöd'];

export default function Index() {
  useSeo({
    title: 'Hönsgården – ägglogg, hönskalender och Agda-säljgenerator',
    description: 'Hönsgården är en svensk app för hönsägare. Logga ägg, följ flocken, räkna foderkostnad, skapa påminnelser och sälj ägg med Agda-säljgeneratorn.',
    path: '/',
    ogImage: 'https://honsgarden.se/blog-images/hens-garden.jpg',
    jsonLd: [
      {
        '@type': 'SoftwareApplication',
        name: 'Hönsgården',
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web, iOS, Android',
        description: 'Svensk app för hobbyhönsägare med ägglogg, hönsprofiler, hönskalender, foderkostnad, statistik och Agda-säljgenerator för äggförsäljning.',
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
    ],
  });

  return (
    <main id="main-content" className="min-h-screen bg-background overflow-x-hidden">
      <Suspense fallback={null}><StickyMobileCTA /></Suspense>
      <LandingNavbar />

      <section className="relative flex flex-col justify-center pt-24 pb-12 sm:min-h-screen sm:pt-16 sm:pb-10"
        style={{ background: 'linear-gradient(135deg, #f5f0e8 0%, #eef5ec 50%, #f5f0e8 100%)' }}
      >
        <div className="container max-w-6xl mx-auto px-5 sm:px-6 relative z-10">
          <div className="grid lg:grid-cols-[1.08fr_0.92fr] gap-10 lg:gap-14 items-center">
            <div className="text-center lg:text-left">
              <motion.div {...fadeUp(0)} className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-4">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs px-3 py-1">
                  Svensk app för hobbyhönsägare
                </Badge>
                <Badge variant="secondary" className="bg-warning/15 text-warning-foreground border-warning/30 text-xs px-3 py-1">
                  Nyhet: Agda-säljgenerator
                </Badge>
                <Badge variant="secondary" className="bg-background/70 text-foreground border-border text-xs px-3 py-1">
                  Gratis att börja
                </Badge>
              </motion.div>

              <motion.h1
                {...fadeUp(0.05)}
                className="font-serif text-[2rem] sm:text-5xl md:text-6xl text-foreground leading-[1.08] mb-4 sm:mb-5"
              >
                Få riktig koll på dina hönor – <span className="text-primary">och sälj ägg enklare</span>
              </motion.h1>

              <motion.p
                {...fadeUp(0.08)}
                className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed mb-5 sm:mb-6"
              >
                Hönsgården hjälper dig logga ägg, följa flocken, räkna foderkostnad och hantera vardagen i hönshuset. Med Agda-säljgeneratorn kan du dessutom skapa egna säljsidor med bild, Swish, bokningsförfrågningar och lagerkoll.
              </motion.p>

              <motion.div {...fadeUp(0.12)} className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-5">
                <Button asChild size="lg" className="h-12 sm:h-13 px-8 text-base gap-2 shadow-[0_8px_30px_hsl(var(--primary)/0.3)]">
                  <a href="/login?mode=register">
                    Skapa konto gratis
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 sm:h-13 px-8 text-base border-primary/30 text-primary hover:bg-primary/5">
                  <a href="/login?mode=register">Testa Agda sälj</a>
                </Button>
              </motion.div>

              <motion.div {...fadeUp(0.15)} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-2xl mx-auto lg:mx-0">
                {['Ägglogg på sekunder', 'Säljsida med Swish', 'Bokningar och export'].map((item) => (
                  <div key={item} className="flex items-center justify-center lg:justify-start gap-2 rounded-xl bg-background/70 border border-border/50 px-3 py-2 text-sm text-foreground">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {item}
                  </div>
                ))}
              </motion.div>

              <motion.div {...fadeUp(0.18)} className="mt-4 flex justify-center lg:justify-start">
                <Suspense fallback={null}><ActivityPulse /></Suspense>
              </motion.div>
            </div>

            <motion.div {...fadeUp(0.12)} className="flex justify-center lg:justify-end">
              <div className="relative">
                <div className="absolute -inset-6 rounded-[3rem] bg-primary/10 blur-3xl" />
                <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl bg-background max-w-[280px] sm:max-w-[340px] border border-border/50">
                  <img
                    src={appMockup}
                    alt="Hönsgården app – dashboard för äggloggning, hönsprofiler, väder och statistik"
                    width={500}
                    height={640}
                    className="w-full"
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-background">
        <div className="container max-w-6xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">Vad löser Hönsgården?</h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Efter ett tag med höns är det inte själva äggen som är svåra. Det svåra är att komma ihåg allt runt omkring: vem värper, vad fodret kostar, när du gjorde rent, om en höna varit hängig och hur du smidigast säljer överskottet.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
            {problems.map((problem) => (
              <Card key={problem} className="border-border shadow-sm bg-card">
                <CardContent className="p-5 flex gap-3 items-start">
                  <span className="text-xl">🤔</span>
                  <p className="text-sm sm:text-base text-foreground leading-relaxed">{problem}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {betterThanNotes.map((item) => (
              <Card key={item.title} className="border-primary/15 shadow-sm bg-primary/[0.03]">
                <CardContent className="p-6">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-serif text-lg text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-secondary/20">
        <div className="container max-w-6xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center max-w-3xl mx-auto mb-12">
            <Badge className="mb-3 bg-primary/10 text-primary border-primary/20">Nyhet</Badge>
            <h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">Agda-säljgeneratorn gör äggförsäljning enklare</h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Skapa en egen säljsida för dina ägg, dela länken i en lokal grupp och samla bokningsförfrågningar direkt i Hönsgården.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
          >
            {agdaFeatures.map((f) => (
              <motion.div key={f.title} variants={staggerItem} className="p-6 rounded-2xl bg-card border border-border shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-serif text-lg text-foreground mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div {...fadeUp(0.1)} className="mt-10 rounded-3xl bg-background border border-primary/15 p-6 sm:p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground mb-2">Exempel på länk</p>
            <p className="font-mono text-sm sm:text-base text-foreground break-all bg-muted/40 rounded-xl px-4 py-3 mb-5">https://honsgarden.se/s/bergs-agg</p>
            <Button asChild size="lg" className="gap-2">
              <a href="/login?mode=register">Skapa din första säljsida <ArrowRight className="h-4 w-4" /></a>
            </Button>
          </motion.div>
        </div>
      </section>

      <section id="sa-funkar-det" className="relative z-10 py-16 sm:py-20"
        style={{ background: 'linear-gradient(180deg, hsl(var(--secondary)/0.25) 0%, hsl(var(--background)) 100%)' }}
      >
        <div className="container max-w-4xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center mb-10">
            <h2 className="font-serif text-2xl sm:text-3xl text-foreground mb-2">Så enkelt kommer du igång</h2>
            <p className="text-sm text-muted-foreground">Börja litet. Appen blir mer värdefull ju mer du loggar.</p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-5"
          >
            {[
              { step: '1', emoji: '🐔', title: 'Lägg till hönor', desc: 'Börja med namn. Ras, bild och anteckningar kan du fylla i senare.' },
              { step: '2', emoji: '🥚', title: 'Logga eller sälj ägg', desc: 'Logga dagens ägg eller skapa en säljsida när du har överskott.' },
              { step: '3', emoji: '📊', title: 'Se mönster och följ upp', desc: 'Följ statistik, kostnader, bokningar, rutiner och vad som händer i flocken.' },
            ].map((s) => (
              <motion.div key={s.step} variants={staggerItem} className="text-center p-6 rounded-2xl bg-background border border-border shadow-sm">
                <span className="text-3xl mb-3 block">{s.emoji}</span>
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold mb-2">{s.step}</span>
                <h3 className="font-serif text-base text-foreground mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="funktioner" className="relative z-10 py-20 sm:py-28 bg-background">
        <div className="container max-w-6xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center mb-12 sm:mb-16">
            <h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">Funktioner som hönsägare faktiskt använder</h2>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Hönsgården är byggd för den riktiga hönsvardagen: loggning, flock, foder, ekonomi, påminnelser, AI och försäljning.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5"
          >
            {features.map((f) => (
              <motion.a
                key={f.title}
                href={f.href}
                variants={staggerItem}
                className="relative p-6 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                {f.badge && (
                  <Badge className="absolute top-4 right-4 bg-warning/20 text-warning-foreground border-warning/30 text-[10px] font-bold">
                    {f.badge}
                  </Badge>
                )}
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-serif text-lg text-foreground mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.a>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 py-20 sm:py-28" style={{ background: 'linear-gradient(180deg, hsl(var(--secondary)/0.3) 0%, hsl(var(--secondary)/0.5) 40%, hsl(var(--secondary)/0.3) 100%)' }}>
        <div className="container max-w-5xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center mb-12">
            <h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-2">Hönsägare behöver inte mer krångel</h2>
            <p className="text-sm text-muted-foreground">De behöver bättre koll, utan att vardagen blir tyngre.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            {testimonials.map((t, i) => (
              <motion.div key={t.name} {...fadeUp(i * 0.1)} className="p-6 rounded-2xl bg-card border border-border shadow-sm">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, j) => <Star key={j} className="h-4 w-4 fill-warning text-warning" />)}
                </div>
                <p className="text-sm text-foreground leading-relaxed mb-4">&ldquo;{t.text}&rdquo;</p>
                <p className="text-sm font-medium text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.meta}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="priser" className="relative z-10 py-20 sm:py-28 bg-background">
        <div className="container max-w-5xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center mb-10">
            <h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">Börja gratis – uppgradera när flocken växer</h2>
            <p className="text-muted-foreground text-sm sm:text-base">Det ska vara enkelt att börja få ordning på hönsgården.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <motion.div {...fadeUp(0.1)} className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-sm">
              <h3 className="font-serif text-xl text-foreground mb-1">Gratis</h3>
              <p className="text-muted-foreground text-sm mb-6">För att komma igång ordentligt</p>
              <p className="text-4xl font-bold text-foreground mb-1">0 kr</p>
              <p className="text-xs text-muted-foreground mb-6">Ingen tidsgräns</p>
              <ul className="space-y-3 mb-8">
                {freeFeatures.map((f) => <li key={f} className="flex items-center gap-2.5 text-sm text-foreground"><Check className="h-4 w-4 text-primary shrink-0" />{f}</li>)}
              </ul>
              <Button asChild variant="outline" className="w-full h-11"><a href="/login?mode=register">Skapa konto gratis</a></Button>
            </motion.div>

            <motion.div {...fadeUp(0.15)} className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-sm">
              <h3 className="font-serif text-xl text-foreground mb-1">Plus – Månad</h3>
              <p className="text-muted-foreground text-sm mb-6">För mer statistik och smartare stöd</p>
              <p className="text-4xl font-bold text-foreground mb-1">19 kr<span className="text-sm font-normal text-muted-foreground">/mån</span></p>
              <p className="text-xs text-primary font-medium mb-6">Sju dagars gratis provperiod</p>
              <ul className="space-y-3 mb-8">
                {plusFeatures.map((f) => <li key={f} className="flex items-center gap-2.5 text-sm text-foreground"><Check className="h-4 w-4 text-primary shrink-0" />{f}</li>)}
              </ul>
              <Button asChild variant="outline" className="w-full h-11"><a href="/login?mode=register">Prova Plus gratis</a></Button>
            </motion.div>

            <motion.div {...fadeUp(0.2)} className="relative p-6 sm:p-8 rounded-2xl border-2 border-primary shadow-md bg-primary/5">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2"><Badge className="bg-primary text-primary-foreground text-xs px-3 py-1">Spara 35%</Badge></div>
              <h3 className="font-serif text-xl text-foreground mb-1">Plus – År</h3>
              <p className="text-muted-foreground text-sm mb-6">Bästa värdet för aktiva hönsägare</p>
              <p className="text-4xl font-bold text-foreground mb-1">149 kr<span className="text-sm font-normal text-muted-foreground">/år</span></p>
              <p className="text-xs text-muted-foreground mb-6">Ungefär 12 kr/mån</p>
              <ul className="space-y-3 mb-8">
                {plusFeatures.map((f) => <li key={f} className="flex items-center gap-2.5 text-sm text-foreground"><Check className="h-4 w-4 text-primary shrink-0" />{f}</li>)}
              </ul>
              <Button asChild className="w-full h-11 text-sm shadow-[0_8px_30px_hsl(var(--primary)/0.3)]"><a href="/login?mode=register">Välj årsplan</a></Button>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative z-10 py-20 sm:py-28" style={{ background: 'linear-gradient(180deg, hsl(var(--background)) 0%, #f5f0e8 50%, hsl(var(--background)) 100%)' }}>
        <div className="container max-w-2xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center mb-10">
            <h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-2">Vanliga frågor</h2>
          </motion.div>

          <motion.div {...fadeUp(0.1)}>
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-xl overflow-hidden px-1">
                  <AccordionTrigger className="text-sm sm:text-base font-medium text-foreground hover:no-underline px-4 text-left">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground px-4 pb-4 leading-relaxed">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 pb-10 sm:pb-16">
        <div className="container max-w-3xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="rounded-3xl bg-gradient-to-br from-primary/10 via-accent/5 to-warning/5 border border-primary/15 p-8 sm:p-12 text-center">
            <div className="text-5xl mb-4">🐔</div>
            <h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">Flocken berättar mer än man tror</h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
              När du loggar ägg, foder, hälsa, försäljning och rutiner får du till slut något mycket bättre än magkänsla: du får riktig erfarenhet sparad över tid.
            </p>
            <Button asChild size="lg" className="h-14 px-10 text-lg gap-2 shadow-[0_8px_30px_hsl(var(--primary)/0.4)] hover:scale-[1.02] transition-transform">
              <a href="/login?mode=register">
                Skapa konto gratis
                <ArrowRight className="h-5 w-5" />
              </a>
            </Button>
            <p className="text-xs text-muted-foreground mt-4">Börja gratis · Mobilvänligt · Byggt för svenska hönsägare</p>
          </motion.div>
        </div>
      </section>

      <Suspense fallback={null}><LandingFooter /></Suspense>
    </main>
  );
}
