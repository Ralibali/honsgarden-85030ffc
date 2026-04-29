import React, { lazy, Suspense, useMemo } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';
import LandingNavbar from '@/components/LandingNavbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ArrowRight, Check, MapPin, ShoppingBag, Megaphone, CalendarClock, CreditCard, Egg, HelpCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { ORTER, getOrt } from '@/data/saljaAggOrter';
import { buildOrtContent, buildOrtFaq, buildOrtMeta, buildOrtImages, buildOrtHenImage } from '@/data/saljaAggOrtContent';
import heroCoop from '@/assets/hero-coop.jpg';
import heroFarm from '@/assets/hero-farm.jpg';
import eggsBasket from '@/assets/eggs-basket.jpg';
import henPortrait from '@/assets/hen-portrait.jpg';

const ASSET_BY_KEY: Record<'coop' | 'farm' | 'eggs' | 'hen', string> = {
  coop: heroCoop,
  farm: heroFarm,
  eggs: eggsBasket,
  hen: henPortrait,
};

const LandingFooter = lazy(() => import('@/components/LandingFooter'));

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.5, delay, ease: 'easeOut' as const },
});

const steps = [
  { icon: ShoppingBag, title: 'Skapa din säljsida', body: 'Lägg upp pris, antal kartor och hämtadress.' },
  { icon: Megaphone, title: 'Dela länken lokalt', body: 'Sprid den i lokala Facebook-grupper, på Blocket eller i bygdebrevet.' },
  { icon: CalendarClock, title: 'Köpare bokar själva', body: 'De väljer dag och antal – du får mejl och notis direkt.' },
  { icon: CreditCard, title: 'Få betalt med Swish', body: 'Pengarna går rakt till ditt konto utan mellanhand.' },
];

export default function SaljaAggOrt() {
  const { ort: ortSlug } = useParams<{ ort: string }>();
  const ort = ortSlug ? getOrt(ortSlug) : undefined;

  const meta = ort ? buildOrtMeta(ort) : null;
  const title = meta?.title ?? 'Sälja ägg lokalt i Sverige | Hönsgården';
  const description = meta?.description ?? '';

  const faq = useMemo(() => (ort ? buildOrtFaq(ort) : []), [ort]);

  const jsonLd = useMemo(() => {
    if (!ort) return undefined;
    return [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Hönsgården', item: 'https://honsgarden.se/' },
          { '@type': 'ListItem', position: 2, name: 'Sälja ägg', item: 'https://honsgarden.se/salja-agg' },
          { '@type': 'ListItem', position: 3, name: ort.name, item: `https://honsgarden.se/salja-agg/${ort.slug}` },
        ],
      },
      {
        '@type': 'Service',
        name: `Sälja ägg i ${ort.name}`,
        areaServed: { '@type': 'City', name: ort.name, address: { '@type': 'PostalAddress', addressRegion: ort.lan, addressCountry: 'SE' } },
        provider: { '@type': 'Organization', name: 'Hönsgården', url: 'https://honsgarden.se' },
        description,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'SEK' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
      {
        '@type': 'SiteNavigationElement',
        name: `Sälja ägg i orter nära ${ort.name}`,
        hasPart: (ort.narliggande ?? [])
          .map((s) => getOrt(s))
          .filter((o): o is NonNullable<ReturnType<typeof getOrt>> => Boolean(o))
          .map((o) => ({
            '@type': 'SiteNavigationElement',
            name: `Sälja ägg i ${o.name}`,
            url: `https://honsgarden.se/salja-agg/${o.slug}`,
          })),
      },
    ];
  }, [ort, faq, description]);

  useSeo({
    title,
    description,
    path: ort ? `/salja-agg/${ort.slug}` : '/salja-agg',
    ogType: 'website',
    ogImage: '/og-image.jpg',
    ogImageAlt: ort ? `Sälja ägg lokalt i ${ort.name}` : 'Sälja ägg lokalt i Sverige',
    noindex: !ort,
    jsonLd,
  });

  if (!ortSlug || !ort) {
    return <Navigate to="/salja-agg" replace />;
  }

  const narliggande = (ort.narliggande ?? [])
    .map((s) => getOrt(s))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));

  // Andra orter i samma län (exkl. nuvarande och redan listade närliggande)
  const narliggandeSlugs = new Set(narliggande.map((n) => n.slug));
  const sammaLan = ORTER
    .filter((o) => o.lan === ort.lan && o.slug !== ort.slug && !narliggandeSlugs.has(o.slug))
    .slice(0, 10);

  // Populära storstäder för cross-län-länkning (exkl. nuvarande län)
  const STORSTADER_SLUGS = ['stockholm', 'goteborg', 'malmo', 'uppsala', 'linkoping', 'orebro', 'vasteras', 'jonkoping', 'umea', 'lund'];
  const storstader = STORSTADER_SLUGS
    .map((s) => getOrt(s))
    .filter((o): o is NonNullable<typeof o> => Boolean(o) && o!.slug !== ort.slug && o!.lan !== ort.lan)
    .slice(0, 6);

  const content = buildOrtContent(ort);
  const images = buildOrtImages(ort);
  const henImg = buildOrtHenImage(ort);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LandingNavbar />

      <main className="flex-1">
        {/* Brödsmulor */}
        <nav aria-label="Brödsmulor" className="container max-w-6xl mx-auto px-5 sm:px-6 pt-6 text-xs text-muted-foreground">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li><Link to="/" className="hover:text-foreground">Hönsgården</Link></li>
            <li>/</li>
            <li><Link to="/salja-agg" className="hover:text-foreground">Sälja ägg</Link></li>
            <li>/</li>
            <li className="text-foreground">{ort.name}</li>
          </ol>
        </nav>

        {/* HERO */}
        <section className="relative pt-8 pb-16 sm:pt-14 sm:pb-24 overflow-hidden noise-bg">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-warning/[0.04] to-transparent pointer-events-none" />
          <div className="container max-w-6xl mx-auto px-5 sm:px-6 relative">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
              <motion.div {...fadeUp()} className="max-w-3xl">
                <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 inline-flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" /> {ort.lan}
                </Badge>
                <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl text-foreground leading-[1.05] mb-5">
                  Sälja ägg i <span className="text-primary">{ort.name}</span> – gratis säljsida på 2 minuter
                </h1>
                <p className="text-base sm:text-lg text-muted-foreground mb-7 leading-relaxed max-w-2xl">
                  Har du höns och fler ägg än ni hinner äta hemma? Skapa en lokal säljsida för {ort.name} och
                  närliggande orter. Köpare bokar själva, betalar via Swish och du behåller hela försäljningen –
                  inga avgifter, ingen mellanhand.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button asChild size="lg" className="h-12 px-8 text-base gap-2 shadow-[0_8px_30px_hsl(var(--primary)/0.3)]">
                    <Link to={`/login?mode=register&utm_source=ort_page&utm_campaign=salja_agg&utm_content=${ort.slug}`}>
                      Skapa min säljsida gratis <ArrowRight className="h-5 w-5" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="h-12 px-7 text-base">
                    <Link to="/salja-agg#ai-pitch">Testa AI-säljtext först</Link>
                  </Button>
                </div>
              </motion.div>

              <motion.figure {...fadeUp(0.1)} className="hidden lg:block">
                <img
                  src={ASSET_BY_KEY[images.coop.assetKey]}
                  alt={images.coop.alt}
                  loading="eager"
                  width={640}
                  height={480}
                  className="w-full h-auto rounded-3xl shadow-xl object-cover aspect-[4/3]"
                />
                <figcaption className="mt-2 text-xs text-muted-foreground text-center">
                  {images.coop.caption}
                </figcaption>
              </motion.figure>
            </div>
          </div>
        </section>

        {/* Lokal kontext - djuplodande SEO-innehåll */}
        <section className="py-14 sm:py-20">
          <div className="container max-w-3xl mx-auto px-5 sm:px-6">
            <motion.div {...fadeUp()} className="space-y-10 text-foreground">
              <div className="space-y-4">
                <h2 className="font-serif text-2xl sm:text-3xl">Sälja ägg i {ort.name} – så ser läget ut idag</h2>
                <p className="text-[15px] leading-relaxed text-muted-foreground">{content.intro}</p>
                <p className="text-[15px] leading-relaxed text-muted-foreground">{content.marknadAvsnitt}</p>
              </div>

              <div className="space-y-4">
                <h2 className="font-serif text-2xl sm:text-3xl">Så resonerar köpare av lokala ägg i {ort.name}</h2>
                <p className="text-[15px] leading-relaxed text-muted-foreground">{content.saResonerarKöpare}</p>
                <p className="text-[15px] leading-relaxed text-muted-foreground">{content.vardagsexempel}</p>
              </div>

              <div className="space-y-4" id="priser">
                <h2 className="font-serif text-2xl sm:text-3xl">Vad får man för ägg i {ort.name}?</h2>
                <p className="text-[15px] leading-relaxed text-muted-foreground">{content.prisIOrt}</p>
                <ul className="space-y-2.5 pt-2">
                  {content.prisTips.map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-[15px]">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <figure className="rounded-2xl overflow-hidden border border-border/50 bg-background">
                <img
                  src={ASSET_BY_KEY[images.eggs.assetKey]}
                  alt={images.eggs.alt}
                  loading="lazy"
                  width={1200}
                  height={675}
                  className="w-full h-auto object-cover aspect-[16/9]"
                />
                <figcaption className="px-4 py-2.5 text-xs text-muted-foreground bg-muted/30 border-t border-border/40">
                  {images.eggs.caption}
                </figcaption>
              </figure>

              <div className="space-y-4">
                <h2 className="font-serif text-2xl sm:text-3xl">Så får du fler kunder i {ort.name}</h2>
                <p className="text-[15px] leading-relaxed text-muted-foreground">{content.saSäljerDuMer}</p>
              </div>

              <div className="space-y-4" id="leverans">
                <h2 className="font-serif text-2xl sm:text-3xl">Hämtning, leverans och logistik i {ort.name}</h2>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  En av de vanligaste orsakerna till att hönsägare i {ort.name} tappar köpare är otydlig logistik.
                  Med en tydlig hämtdag och en sval plats för avhämtning slipper både du och köparen onödigt
                  pingande. Här är några konkreta tips som funkar bra i {ort.lan}:
                </p>
                <ul className="space-y-2.5 pt-2">
                  {content.leveransTips.map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-[15px]">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <figure className="rounded-2xl overflow-hidden border border-border/50 bg-background">
                <img
                  src={ASSET_BY_KEY[images.farm.assetKey]}
                  alt={images.farm.alt}
                  loading="lazy"
                  width={1200}
                  height={675}
                  className="w-full h-auto object-cover aspect-[16/9]"
                />
                <figcaption className="px-4 py-2.5 text-xs text-muted-foreground bg-muted/30 border-t border-border/40">
                  {images.farm.caption}
                </figcaption>
              </figure>

              <figure className="rounded-2xl overflow-hidden border border-border/50 bg-background sm:max-w-md">
                <img
                  src={ASSET_BY_KEY[henImg.assetKey]}
                  alt={henImg.alt}
                  loading="lazy"
                  width={800}
                  height={800}
                  className="w-full h-auto object-cover aspect-square"
                />
                <figcaption className="px-4 py-2.5 text-xs text-muted-foreground bg-muted/30 border-t border-border/40">
                  {henImg.caption}
                </figcaption>
              </figure>

              <div className="space-y-4" id="regler">
                <h2 className="font-serif text-2xl sm:text-3xl">Hygien, märkning och regler i korthet</h2>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  För småskalig försäljning av ägg direkt från gård i Sverige (under 350 värphöns) räcker det i
                  de flesta fall att registrera primärproduktion hos Länsstyrelsen i {ort.lan}. Du behöver inte
                  stämpla varje ägg, men du ansvarar för att hanteringen är hygienisk och spårbar. Köpare i
                  {' '}{ort.name} förväntar sig idag ren förpackning, tydligt värpdatum och svar på enkla frågor
                  om uppfödning. Följ dessa råd så ligger du tryggt:
                </p>
                <ul className="space-y-2.5 pt-2">
                  {content.hygienTips.map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-[15px]">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4" id="sasong">
                <h2 className="font-serif text-2xl sm:text-3xl">Säsong och klimat i {ort.region}</h2>
                <p className="text-[15px] leading-relaxed text-muted-foreground">{content.klimatNot}</p>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  Många framgångsrika säljare i {ort.name} arbetar med en kort säsongsbeskrivning på säljsidan,
                  där de förklarar varför värpningen varierar över året. Det skapar trovärdighet och
                  förebygger irriterade köpare när det blir lägre tillgång under vintern.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="font-serif text-2xl sm:text-3xl">Vanliga frågor från köpare i {ort.name}</h2>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  Genom att svara på de här frågorna direkt på säljsidan halverar du antalet sms du behöver
                  besvara, och de flesta köpare bokar direkt utan att behöva höra av sig först:
                </p>
                <ul className="space-y-2.5 pt-2">
                  {content.vanligaFragor.map((q) => (
                    <li key={q} className="flex items-start gap-2.5 text-[15px]">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 4 STEG */}
        <section className="py-14 sm:py-20 bg-muted/30 border-y border-border/40">
          <div className="container max-w-5xl mx-auto px-5 sm:px-6">
            <motion.div {...fadeUp()} className="text-center mb-10">
              <h2 className="font-serif text-2xl sm:text-3xl mb-3">Så funkar äggförsäljning i {ort.name}</h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
                Fyra enkla steg från första logginen till första bokningen.
              </p>
            </motion.div>
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
              {steps.map((s, i) => (
                <motion.div key={s.title} {...fadeUp(i * 0.05)}>
                  <Card className="h-full border-border/50 rounded-2xl bg-background">
                    <CardContent className="p-5 sm:p-6 flex gap-4">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <s.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-serif text-lg mb-1">{s.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Fördelar */}
        <section className="py-14 sm:py-20">
          <div className="container max-w-4xl mx-auto px-5 sm:px-6">
            <motion.div {...fadeUp()}>
              <h2 className="font-serif text-2xl sm:text-3xl mb-6">Det här får du med Hönsgården i {ort.name}</h2>
              <ul className="space-y-3">
                {[
                  `En egen säljsida som syns när någon i ${ort.name} googlar “sälja ägg ${ort.name.toLowerCase()}”.`,
                  `Bokningssystem så köpare väljer dag och antal kartor utan sms-pingla.`,
                  `Swish-betalning direkt till dig – ingen provision, inga dolda avgifter.`,
                  `Lager och kundlista så du vet exakt hur mycket du har att sälja just nu.`,
                  `Notiser och mejl när någon bokar, även om du är ute i hönsgården.`,
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-[15px] text-foreground">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </section>

        {/* Intern länkning – närliggande orter, samma län & populära storstäder */}
        <nav
          aria-label={`Sälja ägg i orter nära ${ort.name}`}
          className="py-12 sm:py-16 bg-muted/20 border-y border-border/40"
        >
          <div className="container max-w-5xl mx-auto px-5 sm:px-6 space-y-10">
            {narliggande.length > 0 && (
              <div>
                <h2 className="font-serif text-xl sm:text-2xl mb-2">
                  Sälja ägg i grannstäder nära {ort.name}
                </h2>
                <p className="text-sm text-muted-foreground mb-5 max-w-2xl">
                  Bor du i utkanten av {ort.name} eller pendlar in från en grannort? Hönsgården funkar
                  lika bra i hela {ort.lan}. Klicka vidare till en lokal säljsida för en närliggande ort:
                </p>
                <ul className="flex flex-wrap gap-2 list-none p-0">
                  {narliggande.map((n) => (
                    <li key={n.slug}>
                      <Link
                        to={`/salja-agg/${n.slug}`}
                        title={`Sälja ägg i ${n.name} (${n.lan})`}
                        className="inline-flex items-center gap-1.5 text-sm rounded-full border border-border/60 bg-background hover:border-primary/40 hover:text-primary px-3.5 py-1.5 transition-colors"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        Sälja ägg i {n.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sammaLan.length > 0 && (
              <div>
                <h2 className="font-serif text-xl sm:text-2xl mb-2">
                  Fler orter i {ort.lan}
                </h2>
                <p className="text-sm text-muted-foreground mb-5 max-w-2xl">
                  Vi har lokala säljsidor för fler orter i {ort.lan} – jämför priser och efterfrågan
                  i området innan du sätter ditt eget pris i {ort.name}:
                </p>
                <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 list-none p-0">
                  {sammaLan.map((n) => (
                    <li key={n.slug}>
                      <Link
                        to={`/salja-agg/${n.slug}`}
                        title={`Sälja ägg lokalt i ${n.name}`}
                        className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1.5"
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        Sälja ägg i {n.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {storstader.length > 0 && (
              <div>
                <h2 className="font-serif text-xl sm:text-2xl mb-2">
                  Populära orter i hela Sverige
                </h2>
                <p className="text-sm text-muted-foreground mb-5 max-w-2xl">
                  Sälja ägg är populärt i hela landet. Se hur efterfrågan ser ut i några av Sveriges
                  största städer:
                </p>
                <ul className="flex flex-wrap gap-2 list-none p-0">
                  {storstader.map((n) => (
                    <li key={n.slug}>
                      <Link
                        to={`/salja-agg/${n.slug}`}
                        title={`Sälja ägg i ${n.name}`}
                        className="inline-flex items-center gap-1.5 text-sm rounded-full border border-border/60 bg-background hover:border-primary/40 hover:text-primary px-3.5 py-1.5 transition-colors"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        {n.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Se även – kategorier per län (jump-länkar inom sidan) */}
            <div className="pt-2 border-t border-border/40">
              <h2 className="font-serif text-xl sm:text-2xl mb-2">
                Se även: kategorier för {ort.lan}
              </h2>
              <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
                Hoppa direkt till en specifik del av guiden för {ort.name} och {ort.lan}:
              </p>
              <ul className="flex flex-wrap gap-2 list-none p-0">
                {[
                  { hash: 'priser', label: `Priser i ${ort.lan}` },
                  { hash: 'leverans', label: `Leverans i ${ort.lan}` },
                  { hash: 'regler', label: `Regler i ${ort.lan}` },
                  { hash: 'sasong', label: `Säsong i ${ort.region}` },
                  { hash: 'faq', label: `Vanliga frågor – ${ort.name}` },
                ].map((c) => (
                  <li key={c.hash}>
                    <a
                      href={`#${c.hash}`}
                      title={c.label}
                      className="inline-flex items-center gap-1.5 text-sm rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 px-3.5 py-1.5 transition-colors"
                    >
                      {c.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2">
              <Link
                to="/salja-agg"
                className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                Se alla orter där du kan sälja ägg <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </nav>


        {/* FAQ */}
        <section id="faq" className="py-14 sm:py-20 bg-muted/20 border-y border-border/40">
          <div className="container max-w-3xl mx-auto px-5 sm:px-6">
            <motion.div {...fadeUp()} className="text-center mb-8">
              <Badge className="mb-3 bg-primary/10 text-primary border-primary/20 inline-flex items-center gap-1.5">
                <HelpCircle className="h-3 w-3" /> Vanliga frågor
              </Badge>
              <h2 className="font-serif text-2xl sm:text-3xl mb-2">
                Vanliga frågor om att sälja ägg i {ort.name}
              </h2>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                Snabba svar på det hönsägare i {ort.lan} oftast undrar innan de börjar sälja sina ägg lokalt.
              </p>
            </motion.div>

            <Accordion type="single" collapsible className="rounded-2xl border border-border/50 bg-background divide-y divide-border/40">
              {faq.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-0 px-5 sm:px-6">
                  <AccordionTrigger className="text-left text-[15px] sm:text-base font-medium py-4 hover:no-underline">
                    {f.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-[15px] text-muted-foreground leading-relaxed pb-5">
                    {f.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Slut-CTA */}
        <section className="py-16 sm:py-24">
          <div className="container max-w-3xl mx-auto px-5 sm:px-6 text-center">
            <Egg className="h-10 w-10 text-primary mx-auto mb-4" />
            <h2 className="font-serif text-2xl sm:text-3xl mb-3">
              Redo att sälja dina ägg i {ort.name}?
            </h2>
            <p className="text-muted-foreground mb-7 max-w-xl mx-auto">
              Skapa kontot på 30 sekunder, sätt pris och hämtadress – så är din säljsida igång inför nästa
              veckas leverans.
            </p>
            <Button asChild size="lg" className="h-12 px-8 text-base gap-2 shadow-[0_8px_30px_hsl(var(--primary)/0.3)]">
              <Link to="/login?mode=register&utm_source=ort_page_cta&utm_campaign=salja_agg">
                Kom igång gratis <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <p className="mt-5 text-xs text-muted-foreground">
              <Link to="/salja-agg" className="underline hover:text-foreground">
                Se hela funktionsöversikten på sälja-ägg-sidan →
              </Link>
            </p>
          </div>
        </section>
      </main>

      <Suspense fallback={null}>
        <LandingFooter />
      </Suspense>
    </div>
  );
}

// Exportera ORTER så sitemap/build-script kan importera om vi vill prerendra senare
export { ORTER };
