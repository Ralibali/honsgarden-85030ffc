import React, { lazy, Suspense } from 'react';
import { useSeo } from '@/hooks/useSeo';
import LandingNavbar from '@/components/LandingNavbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  Check,
  Egg,
  Smartphone,
  ShieldCheck,
  Star,
  ShoppingBag,
  CalendarClock,
  CreditCard,
  MapPin,
  Megaphone,
  TrendingUp,
  Quote,
  Lock,
  Heart,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ORTER } from '@/data/saljaAggOrter';

const LandingFooter = lazy(() => import('@/components/LandingFooter'));
const StickyMobileCTA = lazy(() => import('@/components/StickyMobileCTA'));
const AiPitchGenerator = lazy(() => import('@/components/landing/AiPitchGenerator'));

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.5, delay, ease: 'easeOut' as const },
});

const heroBullets = [
  'Egen säljsida med bild, pris och hämtinfo',
  'Köpare bokar direkt – du får mejl & notis',
  'Swish-betalning, lager och kundlista',
];

const stepGuide = [
  {
    icon: ShoppingBag,
    title: '1. Skapa din säljsida på 2 minuter',
    body: 'Lägg till bild, pris per förpackning, hämtadress och beskrivning. Du får en delbar länk – t.ex. honsgarden.se/dina-agg.',
  },
  {
    icon: Megaphone,
    title: '2. Dela länken där dina kunder finns',
    body: 'På Facebook-grupper, hyllan i butiken, Blocket eller direkt till stamkunder via SMS. Du behöver ingen egen hemsida.',
  },
  {
    icon: CalendarClock,
    title: '3. Köpare bokar – du får notis',
    body: 'När någon bokar får du mejl direkt och en notis i appen med kundens namn, antal och kontaktuppgifter.',
  },
  {
    icon: CreditCard,
    title: '4. Hantera Swish, lager och kundlista',
    body: 'Markera betalt, hämtat eller avbokat. Hönsgården räknar lagret automatiskt och spar din kundhistorik.',
  },
];

const features = [
  { icon: Smartphone, title: 'Mobilvänlig säljsida', desc: 'Snyggt och snabbt på mobilen där dina kunder är.' },
  { icon: MapPin, title: 'Hämtinformation och karta', desc: 'Visa adress och hämttider tydligt så slipper du frågor.' },
  { icon: ShieldCheck, title: 'Trygg för köparen', desc: 'Recensioner, väntelista och tydlig info om dig som säljare.' },
  { icon: TrendingUp, title: 'Statistik på försäljningen', desc: 'Se intäkter, antal sålda förpackningar och stamkunder.' },
  { icon: Star, title: 'Recensioner från kunder', desc: 'Stamkunder kan lämna omdömen som syns på säljsidan.' },
  { icon: Egg, title: 'Auto-lager från äggloggen', desc: 'Loggar du ägg i Hönsgården kan lagret räknas automatiskt.' },
];

const faq = [
  {
    q: 'Är det gratis att sälja ägg via Hönsgården?',
    a: 'Ja. Du kan skapa säljsida, ta emot bokningar och hantera kunder helt gratis. Vi tar inga avgifter på din försäljning – Swish går direkt mellan dig och köparen.',
  },
  {
    q: 'Hur fungerar äggförsäljning med Swish?',
    a: 'Köparen bokar antal kartor på din säljsida och betalar med Swish till dig direkt vid hämtning eller i förväg. Hönsgården hanterar bokningen, lagret och påminnelsen – inga mellanhänder och inga avgifter.',
  },
  {
    q: 'Vad är "Agdas Bod"?',
    a: 'Agdas Bod är vår säljmodul i Hönsgården-appen. Det är där du skapar din säljsida och ser bokningar och kunder.',
  },
  {
    q: 'Behöver jag F-skatt eller företag för att sälja ägg?',
    a: 'Nej, inte för enstaka försäljning av ägg från egna höns. Hobbyförsäljning är skattefritt upp till en viss gräns. Tjänar du över 50 000 kr/år bör du kontakta Skatteverket.',
  },
  {
    q: 'Får jag verkligen sälja ägg från mina höns?',
    a: 'Ja, du får sälja ägg direkt från gården till privatpersoner. Det kallas "primärproduktion till slutkonsument" och är tillåtet utan tillstånd. Säljer du till butik gäller andra regler – då måste du anmäla till Livsmedelsverket.',
  },
  {
    q: 'Vad är ett bra pris på hemmagjorda ägg 2026?',
    a: 'Marknadspriset ligger oftast mellan 40 och 70 kr per karta (10–12 ägg) i Sverige. Frigående och unika rasägg kan tas ut högre. Hönsgården räknar din faktiska foderkostnad så du vet om du går plus.',
  },
  {
    q: 'Hur hittar jag köpare till mina ägg lokalt?',
    a: 'De flesta hittar köpare via lokala Facebook-grupper, anslag i butiker, vägskyltar och word-of-mouth. Med Hönsgården får du en delbar länk att klistra in överallt – köparen bokar själv.',
  },
  {
    q: 'Vad händer om jag inte har ägg en vecka?',
    a: 'Du kan markera din säljsida som "tillfälligt slut" eller pausa den. Kunder kan ställa sig på väntelista och få notis när du har ägg igen.',
  },
];

const testimonials = [
  {
    name: 'Lena',
    location: 'Värmland',
    text: 'Innan satt jag och svarade på SMS hela tiden. Nu får kunderna boka själva och jag ser allt på ett ställe. Bästa förändringen för min hönsgård.',
  },
  {
    name: 'Johan',
    location: 'Småland',
    text: 'Sålt ägg i 5 år men aldrig haft ordning. Nu vet jag vem som kommer hämta, hur många paket och om de betalt. Helt fantastiskt.',
  },
  {
    name: 'Birgitta',
    location: 'Uppland',
    text: 'Mina stamkunder älskar att de kan boka själva på kvällen. Jag fick fyra nya kunder bara genom att lägga länken på Facebook.',
  },
];

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Sälj ägg lokalt – skapa din egen säljsida med Hönsgården',
    description:
      'Sälj ägg från egna höns med Swish-betalning, bokningssystem och kundlista. Skapa en gratis säljsida på 2 minuter.',
    url: 'https://honsgarden.se/salja-agg',
    inLanguage: 'sv-SE',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Säljverktyg för hobbyhönsägare',
    provider: { '@type': 'Organization', name: 'Hönsgården', url: 'https://honsgarden.se' },
    areaServed: { '@type': 'Country', name: 'Sverige' },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'SEK', description: 'Gratis säljmodul för ägg' },
  },
];

export default function SaljaAgg() {
  useSeo({
    title: 'Sälja ägg lokalt med Swish – gratis säljsida | Hönsgården',
    description:
      'Sälja ägg från egna höns? Skapa en gratis säljsida med bokning och Swish-betalning på 2 minuter. Få stamkunder, hantera lager och äggförsäljning enkelt med Hönsgården.',
    path: '/salja-agg',
    ogType: 'website',
    ogImage: '/og-image.jpg',
    ogImageAlt: 'Sälja ägg lokalt med Swish – gratis säljsida från Hönsgården',
    jsonLd,
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LandingNavbar />

      <main className="flex-1">
        {/* HERO */}
        <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden noise-bg">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-warning/[0.04] to-transparent pointer-events-none" />
          <div className="container max-w-6xl mx-auto px-5 sm:px-6 relative">
            <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center">
              <motion.div {...fadeUp()}>
                <Badge className="mb-5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
                  Sälj ägg lokalt – helt gratis
                </Badge>
                <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-foreground leading-[1.05] mb-5">
                  Sälj ägg från dina höns – <span className="text-primary">utan krångel</span>
                </h1>
                <p className="text-base sm:text-lg text-muted-foreground mb-7 leading-relaxed max-w-lg">
                  Skapa en gratis säljsida på 2 minuter. Köpare bokar själva, du får notis direkt, och
                  Swish-betalningen går rakt till dig. Inga avgifter, ingen mellanhand.
                </p>

                <ul className="space-y-2.5 mb-8">
                  {heroBullets.map((b) => (
                    <li key={b} className="flex items-center gap-2.5 text-sm sm:text-base text-foreground">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 px-8 text-base gap-2 shadow-[0_8px_30px_hsl(var(--primary)/0.3)]"
                  >
                    <a href="/login?mode=register">
                      Skapa gratis säljsida <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
                    <a href="#hur-det-funkar">Se hur det funkar</a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Ingen avgift · Inget kreditkort · Du behåller 100% av vad du säljer
                </p>
              </motion.div>

              <motion.div {...fadeUp(0.15)} className="relative hidden md:block">
                <div className="absolute -top-6 -left-6 w-32 h-32 bg-warning/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-6 -right-6 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
                <Card className="relative shadow-2xl border-border/40 rounded-3xl overflow-hidden">
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-primary/15 to-warning/15 p-6 border-b border-border/40">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Mockup</p>
                      <p className="font-serif text-xl text-foreground">Lenas Ekoägg</p>
                      <p className="text-xs text-muted-foreground">Värmland · 6 förpackningar i lager</p>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Pris per förpackning</span>
                        <span className="font-semibold text-foreground">45 kr</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Antal förpackningar</span>
                        <span className="font-semibold text-foreground">2 st</span>
                      </div>
                      <div className="border-t border-border/40 pt-4 flex items-center justify-between">
                        <span className="font-semibold text-foreground">Totalt</span>
                        <span className="font-serif text-2xl text-primary">90 kr</span>
                      </div>
                      <Button className="w-full h-11 gap-2">
                        Boka & betala med Swish
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF / STATS */}
        <section className="py-10 sm:py-14 bg-muted/30 border-y border-border/40">
          <div className="container max-w-5xl mx-auto px-5 sm:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
              {[
                { value: '2 min', label: 'för att skapa säljsida' },
                { value: '0 kr', label: 'i avgifter eller provision' },
                { value: 'Swish', label: 'rakt till dig' },
                { value: '100%', label: 'till hönsbonden' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="font-serif text-2xl sm:text-3xl text-primary mb-1">{s.value}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HUR DET FUNKAR */}
        <section id="hur-det-funkar" className="py-16 sm:py-24">
          <div className="container max-w-5xl mx-auto px-5 sm:px-6">
            <motion.div {...fadeUp()} className="text-center mb-12">
              <Badge className="mb-3 bg-warning/10 text-warning-foreground border-warning/20">Så funkar det</Badge>
              <h2 className="font-serif text-3xl sm:text-4xl text-foreground mb-3">
                Från första ägget till stamkund – på en söndag
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Inga konstigheter. Du sätter upp en säljsida på 2 minuter och börjar ta emot bokningar samma dag.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
              {stepGuide.map((step, i) => (
                <motion.div key={step.title} {...fadeUp(i * 0.05)}>
                  <Card className="h-full border-border/50 hover:border-primary/30 transition-colors rounded-2xl">
                    <CardContent className="p-6 sm:p-7">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                        <step.icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-serif text-xl text-foreground mb-2">{step.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* KUNDCASE */}
        <section className="py-16 sm:py-24 bg-muted/20 border-y border-border/40">
          <div className="container max-w-6xl mx-auto px-5 sm:px-6">
            <motion.div {...fadeUp()} className="text-center mb-12">
              <Badge className="mb-3 bg-primary/10 text-primary border-primary/20">Riktiga hönsägare</Badge>
              <h2 className="font-serif text-3xl sm:text-4xl text-foreground mb-3">
                Så har andra fått igång sin äggförsäljning
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Tre vanliga vardagsexempel från hönsgårdar runt om i Sverige – inga säljpitchar, bara
                hur det faktiskt brukar gå.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
              {[
                {
                  name: 'Karin, 4 höns i Småland',
                  result: 'Sålde slut på 12 kartor första helgen',
                  story:
                    '"Jag delade bara länken i bygdens Facebook-grupp på fredagen. På söndag kväll var det tomt i kylen och tre nya stamkunder bokade in nästa vecka."',
                },
                {
                  name: 'Linda & Per, 14 höns i Skåne',
                  result: 'Slipper sms-pinglandet helt',
                  story:
                    '"Förut fick vi 30 sms i veckan om vem som ville hämta när. Nu bokar de själva i kalendern och vi får bara notisen när det är dags att packa."',
                },
                {
                  name: 'Marcus, 22 höns i Värmland',
                  result: '+1 200 kr/mån utan extra jobb',
                  story:
                    '"Jag hade alltid överskott men ingen ork att maila runt. Nu går säljsidan av sig själv och Swish-betalningen ligger på kontot innan kunden ens hunnit hem."',
                },
              ].map((c, i) => (
                <motion.div key={c.name} {...fadeUp(i * 0.07)}>
                  <Card className="h-full border-border/50 rounded-2xl bg-background hover:shadow-md transition-shadow">
                    <CardContent className="p-6 sm:p-7 flex flex-col h-full">
                      <Quote className="h-7 w-7 text-primary/30 mb-3" />
                      <p className="text-sm sm:text-[15px] text-foreground leading-relaxed mb-5 flex-1">
                        {c.story}
                      </p>
                      <div className="pt-4 border-t border-border/40">
                        <p className="text-xs text-primary font-medium mb-0.5">{c.result}</p>
                        <p className="text-xs text-muted-foreground">{c.name}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* TROVÄRDIGHET */}
        <section className="py-14 sm:py-16">
          <div className="container max-w-5xl mx-auto px-5 sm:px-6">
            <motion.div
              {...fadeUp()}
              className="rounded-3xl bg-gradient-to-br from-primary/[0.06] via-background to-warning/[0.04] border border-border/50 p-6 sm:p-10"
            >
              <div className="grid sm:grid-cols-3 gap-6 sm:gap-4 mb-8">
                {[
                  { value: '0 kr', label: 'Inga avgifter, inga provisioner' },
                  { value: '2 min', label: 'Från registrering till första bokning' },
                  { value: '100 %', label: 'Pengarna går direkt till din Swish' },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="font-serif text-3xl sm:text-4xl text-primary mb-1">{s.value}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-3 sm:gap-4 max-w-3xl mx-auto">
                {[
                  { icon: Lock, text: 'Vi säljer aldrig dina eller dina kunders uppgifter – GDPR-säkert.' },
                  { icon: ShieldCheck, text: 'Ingen mellanhand. Du behåller hela försäljningen.' },
                  { icon: Heart, text: 'Byggt i Sverige för svenska hönsgårdar. Support på svenska.' },
                  { icon: Zap, text: 'Du kan avsluta eller pausa din säljsida när du vill, inga bindningar.' },
                ].map((t) => (
                  <div key={t.text} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <t.icon className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{t.text}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* AI PITCH GENERATOR */}
        <Suspense fallback={<div className="h-96" />}>
          <AiPitchGenerator />
        </Suspense>

        {/* FEATURES */}
        <section className="py-16 sm:py-24 bg-muted/30 border-y border-border/40">
          <div className="container max-w-6xl mx-auto px-5 sm:px-6">
            <motion.div {...fadeUp()} className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-foreground mb-3">
                Allt du behöver för att sälja ägg lokalt
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Mer än bara en betalning – ett komplett verktyg för hobbyhönsägare i Sverige.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f, i) => (
                <motion.div key={f.title} {...fadeUp(i * 0.04)}>
                  <Card className="h-full bg-card/80 backdrop-blur border-border/50 rounded-2xl">
                    <CardContent className="p-6">
                      <f.icon className="h-7 w-7 text-primary mb-3" />
                      <h3 className="font-serif text-lg text-foreground mb-1.5">{f.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="py-16 sm:py-24">
          <div className="container max-w-5xl mx-auto px-5 sm:px-6">
            <motion.h2 {...fadeUp()} className="font-serif text-3xl sm:text-4xl text-foreground text-center mb-10">
              Hönsbönder som redan säljer smartare
            </motion.h2>
            <div className="grid md:grid-cols-3 gap-5">
              {testimonials.map((t, i) => (
                <motion.div key={t.name} {...fadeUp(i * 0.05)}>
                  <Card className="h-full border-border/50 rounded-2xl">
                    <CardContent className="p-6">
                      <div className="flex gap-0.5 mb-3">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star key={idx} className="h-4 w-4 text-warning fill-warning" />
                        ))}
                      </div>
                      <p className="text-sm text-foreground leading-relaxed mb-4 italic">"{t.text}"</p>
                      <p className="text-xs text-muted-foreground">
                        <strong className="text-foreground">{t.name}</strong> · {t.location}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* LOKALA SIDOR */}
        <section className="py-14 sm:py-20 bg-muted/20 border-y border-border/40">
          <div className="container max-w-5xl mx-auto px-5 sm:px-6">
            <motion.div {...fadeUp()} className="text-center mb-8">
              <Badge className="mb-3 bg-primary/10 text-primary border-primary/20">Lokalt nära dig</Badge>
              <h2 className="font-serif text-3xl sm:text-4xl text-foreground mb-3">
                Säljer du ägg i din ort?
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Vi har dedikerade säljsidor för fler än 100 svenska orter. Hitta din kommun nedan eller
                gå direkt till registreringen.
              </p>
            </motion.div>
            <motion.div {...fadeUp(0.05)} className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
              {[
                'stockholm','goteborg','malmo','uppsala','linkoping','orebro','vasteras',
                'jonkoping','norrkoping','helsingborg','umea','lund','karlstad','gavle',
                'sundsvall','vaxjo','halmstad','boras','eskilstuna','kalmar',
              ].map((slug) => {
                const ort = ORTER.find((o) => o.slug === slug);
                if (!ort) return null;
                return (
                  <Link
                    key={slug}
                    to={`/salja-agg/${slug}`}
                    className="inline-flex items-center gap-1.5 text-sm rounded-full border border-border/60 bg-background hover:border-primary/40 hover:text-primary px-3.5 py-1.5 transition-colors"
                  >
                    <MapPin className="h-3.5 w-3.5" /> {ort.name}
                  </Link>
                );
              })}
            </motion.div>
            <p className="text-center text-xs text-muted-foreground mt-6">
              Är din ort inte med? Det funkar lika bra ändå – skapa kontot så syns du på lokala sökningar i din kommun.
            </p>
          </div>
        </section>

        {/* SEO-RIK CONTENT */}
        <section className="py-16 sm:py-20 bg-muted/30 border-y border-border/40">
          <div className="container max-w-3xl mx-auto px-5 sm:px-6 prose prose-stone max-w-none">
            <motion.div {...fadeUp()}>
              <h2 className="font-serif text-3xl text-foreground mb-5">
                Sälja ägg lokalt – så blir hobbyn ett tillskott i kassan
              </h2>
              <p className="text-foreground/85 leading-relaxed mb-4">
                Att sälja ägg från sina egna höns är ett av de enklaste sätten att få in lite extra pengar på en
                hobby som ofta kostar mer än vad många tror. Med några hönor i bakgården eller på gården kan du
                snabbt få ett överskott att erbjuda grannar, arbetskamrater eller en lokal Facebook-grupp.
                Hönsgården är gjort för dig som vill göra det smidigt utan att behöva en webbutik, F-skatt eller
                krångliga avtal.
              </p>
              <h3 className="font-serif text-2xl text-foreground mt-8 mb-3">Vad får man sälja?</h3>
              <p className="text-foreground/85 leading-relaxed mb-4">
                Som privatperson får du sälja ägg direkt från gården till slutkonsument utan tillstånd. Det
                kallas <em>primärproduktion till konsument</em> och är fullt lagligt så länge du säljer från
                produktionsplatsen och inte distribuerar via butik. Vill du sälja till en lokal handlare eller
                restaurang behöver du anmäla till Livsmedelsverket – men för "äggförsäljning Swish" till
                privatpersoner räcker det med några praktiska rutiner kring renhet, märkning av bäst-före-datum
                och ett ställe att förvara äggen kallt.
              </p>
              <h3 className="font-serif text-2xl text-foreground mt-8 mb-3">Pris på ägg från egna höns</h3>
              <p className="text-foreground/85 leading-relaxed mb-4">
                Marknadspriset för hemmagjorda ägg ligger ofta mellan <strong>40 och 70 kr per förpackning</strong>{' '}
                (10–12 ägg) i Sverige, beroende på om de är ekologiska, frigående och hur efterfrågan ser ut i
                ditt område. Hönsgården hjälper dig sätta ett pris baserat på faktisk foderkostnad – så vet du om
                du går plus minus noll eller faktiskt tjänar något.
              </p>
              <h3 className="font-serif text-2xl text-foreground mt-8 mb-3">Marknadsföring – var hittar man köpare?</h3>
              <p className="text-foreground/85 leading-relaxed mb-4">
                De flesta som börjar sälja ägg lokalt hittar sina första kunder via:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-foreground/85 mb-4">
                <li>Lokala Facebook-grupper ("Sälja & köpa i [orten]")</li>
                <li>Anslag i butiker, bygdegårdar eller på arbetsplatsen</li>
                <li>Skylt vid vägen eller framför grinden</li>
                <li>Word of mouth från grannar och stamkunder</li>
              </ul>
              <p className="text-foreground/85 leading-relaxed">
                Med Hönsgårdens säljsida får du en delbar länk att använda överallt – istället för att svara på
                SMS dygnet runt sköter köparen bokningen själv.
              </p>
            </motion.div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 sm:py-24">
          <div className="container max-w-3xl mx-auto px-5 sm:px-6">
            <motion.h2 {...fadeUp()} className="font-serif text-3xl sm:text-4xl text-foreground text-center mb-10">
              Vanliga frågor
            </motion.h2>
            <div className="space-y-3">
              {faq.map((f, i) => (
                <motion.div key={f.q} {...fadeUp(i * 0.03)}>
                  <Card className="border-border/50 rounded-2xl">
                    <CardContent className="p-5 sm:p-6">
                      <h3 className="font-serif text-lg text-foreground mb-2">{f.q}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-16 sm:py-24">
          <div className="container max-w-3xl mx-auto px-5 sm:px-6">
            <motion.div
              {...fadeUp()}
              className="rounded-3xl bg-gradient-to-br from-primary/10 via-warning/5 to-accent/5 border border-primary/15 p-8 sm:p-12 text-center"
            >
              <div className="text-5xl mb-4">🥚</div>
              <h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">
                Redo att sälja dina första ägg?
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
                Skapa konto, lägg upp din säljsida och dela länken. Hela uppstarten tar mindre tid än att
                samla in dagens ägg.
              </p>
              <Button
                asChild
                size="lg"
                className="h-14 px-10 text-lg gap-2 shadow-[0_8px_30px_hsl(var(--primary)/0.4)] hover:scale-[1.02] transition-transform"
              >
                <a href="/login?mode=register">
                  Skapa gratis säljsida <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                100% gratis · Inga avgifter på din försäljning · Swish direkt till dig
              </p>
            </motion.div>
          </div>
        </section>
      </main>

      <Suspense fallback={null}>
        <LandingFooter />
        <StickyMobileCTA />
      </Suspense>
    </div>
  );
}
