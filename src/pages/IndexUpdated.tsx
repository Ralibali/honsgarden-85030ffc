import React, { lazy, Suspense } from 'react';
import LandingNavbar from '@/components/LandingNavbar';
import LandingHeroV3 from '@/components/landing/LandingHeroV3';
import { useSeo } from '@/hooks/useSeo';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
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

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 } as const,
  whileInView: { opacity: 1, y: 0 } as const,
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.42, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const staggerContainer = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const staggerItem = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

type Tile = {
  icon: typeof Egg;
  title: string;
  desc: string;
  href: string;
  badge?: string;
  span?: string;
  tone?: 'deep' | 'sage';
  chart?: boolean;
};

const productModules: Tile[] = [
  { icon: Egg, title: 'Ägglogg', desc: 'Logga dagens ägg på några sekunder, följ trender och se hur flocken värper över tid.', href: '/agglogg', span: 'col-span-2 lg:col-span-2 lg:row-span-2', tone: 'deep', chart: true },
  { icon: Bird, title: 'Flock & hönsprofiler', desc: 'Hönor, ras, bilder, hälsa och historik på ett ställe.', href: '/app-for-honsagare' },
  { icon: BarChart3, title: 'Statistik & insikter', desc: 'Veckor, månader, snitt, avvikelser och topplistor.', href: '/login?mode=register' },
  { icon: ReceiptText, title: 'Agdas äggbod', desc: 'Egen säljsida med bild, pris, Swish, bokningar, kundlista och export.', href: '/salja-agg', badge: 'Sälj ägg', span: 'col-span-2', tone: 'sage' },
  { icon: Wheat, title: 'Foder & ekonomi', desc: 'Foderinköp, kostnad per ägg, intäkter och utgifter.', href: '/foderkostnad-hons' },
  { icon: CalendarDays, title: 'Kalender & rutiner', desc: 'Rengöring, vatten, foder, kvalster, ruggning och säsong.', href: '/honskalender' },
  { icon: Bot, title: 'Agda AI', desc: 'Råd, säljtexter, veckorapporter och nästa steg – utifrån din egen hönsgård.', href: '/login?mode=register', badge: 'Plus', span: 'col-span-2', tone: 'sage' },
  { icon: Egg, title: 'Kläckningskalender', desc: 'Dag 1–21, lysning, lockdown och resultat.', href: '/klackningskalender' },
  { icon: CloudSun, title: 'Väder & påverkan', desc: 'Se hur värme, kyla och säsong påverkar äggen.', href: '/login?mode=register' },
  { icon: MessageCircle, title: 'Community', desc: 'Inlägg, frågor och tips mellan hönsägare.', href: '/login?mode=register' },
  { icon: ClipboardCheck, title: 'Rapporter & export', desc: 'Kopiera rapporter och exportera CSV.', href: '/login?mode=register' },
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

/** Trattmätning: spårar klick på registrerings-CTA:er med källa. */
function trackRegisterCta(source: 'landing_hero' | 'landing_navbar' | 'landing_final_cta') {
  void import('@/lib/analytics').then(({ trackEvent }) =>
    trackEvent('CTA Register Clicked', { source }),
  );
}

function SectionHeading({ eyebrow, title, desc }: { eyebrow?: string; title: string; desc?: string }) {
  return (
    <motion.div {...fadeUp()} className="max-w-2xl mb-10 sm:mb-12">
      {eyebrow && <p className="hg-eyebrow mb-3">{eyebrow}</p>}
      <h2 className="text-2xl sm:text-4xl mb-3">{title}</h2>
      {desc && <p className="text-sm sm:text-base leading-relaxed" style={{ color: 'var(--hg-ink-soft)' }}>{desc}</p>}
      <div className="hg-rule mt-6 max-w-[160px]" aria-hidden />
    </motion.div>
  );
}

export default function IndexUpdated() {
  useSeo({
    title: 'Hönsgården – ägglogg, flock, Agdas äggbod och AI',
    description: 'Hönsgården är en svensk app för hönsägare. Logga ägg, följ flocken, sälj ägg med Agdas äggbod, hantera kunder, få statistik, AI-råd, community och rapporter.',
    path: '/',
    ogImage: 'https://honsgarden.se/blog-images/hens-garden.jpg',
    jsonLd: [
      { '@type': 'SoftwareApplication', name: 'Hönsgården', applicationCategory: 'LifestyleApplication', operatingSystem: 'Web, iOS, Android', description: 'Svensk app för hönsägare med ägglogg, hönsprofiler, statistik, kalender, foderkostnad, ekonomi, Agdas äggbod, community, väderpåverkan, rapporter och AI-stöd.', offers: { '@type': 'Offer', price: '0', priceCurrency: 'SEK' } },
      { '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  });

  return (
    <main id="main-content" tabIndex={-1} className="min-h-dvh overflow-x-hidden">
      <div className="hg-home-v3">
        <Suspense fallback={null}><StickyMobileCTA /></Suspense>
        <LandingNavbar />

        <LandingHeroV3 />

        {/* Funktioner som bento-rutnät */}
        <section id="funktioner" className="py-16 sm:py-24" style={{ background: 'var(--hg-cream)' }}>
          <div className="container max-w-6xl mx-auto px-5 sm:px-6">
            <SectionHeading
              eyebrow="Funktioner"
              title="Allt hönsägaren behöver – i ett lugnt arbetsbord"
              desc="Hönsgården är inte bara en ägglogg. Det är platsen där flocken, vardagen, ekonomin och försäljningen hänger ihop."
            />
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-[minmax(150px,auto)]"
            >
              {productModules.map((f) => (
                <motion.a
                  key={f.title}
                  href={f.href}
                  variants={staggerItem}
                  className={`hg-tile ${f.tone === 'deep' ? 'hg-tile--deep' : ''} ${f.tone === 'sage' ? 'hg-tile--sage' : ''} ${f.span ?? ''} group flex flex-col p-5 sm:p-6`}
                >
                  {f.badge && (
                    <span className="hg-chip absolute top-4 right-4 text-[10px] font-semibold uppercase tracking-wider">
                      {f.badge}
                    </span>
                  )}
                  <span className="hg-icon mb-4">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className={`${f.chart ? 'text-2xl sm:text-3xl' : 'text-lg'} mb-2`}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: f.tone === 'deep' ? 'rgba(244,241,230,.76)' : 'var(--hg-ink-soft)' }}>
                    {f.desc}
                  </p>
                  {f.chart && (
                    <div className="mt-auto pt-8 flex items-end gap-1.5 h-24" aria-hidden>
                      {[38, 52, 44, 61, 55, 70, 78, 66, 84].map((h, i) => (
                        <span
                          key={i}
                          className="flex-1 rounded-t-md"
                          style={{ height: `${h}%`, background: 'linear-gradient(180deg, rgba(168,192,160,.9), rgba(168,192,160,.35))' }}
                        />
                      ))}
                    </div>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium opacity-70 group-hover:opacity-100 transition-opacity">
                    Läs mer <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </motion.a>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Agdas äggbod */}
        <section className="py-16 sm:py-24" style={{ background: 'var(--hg-cream-2)' }}>
          <div className="container max-w-6xl mx-auto px-5 sm:px-6">
            <SectionHeading
              eyebrow="För dig som säljer ägg"
              title="Agdas äggbod gör lokal äggförsäljning enklare"
              desc="Skapa en säljsida, visa bild och pris, ta emot bokningar och följ upp kunder, betalning och hämtning direkt i Hönsgården."
            />
            <motion.div variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {agdaFeatures.map((f) => (
                <motion.div key={f.title} variants={staggerItem} className="hg-tile hg-tile--hover p-6">
                  <span className="hg-icon mb-4"><f.icon className="h-5 w-5" /></span>
                  <h3 className="text-lg mb-2">{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--hg-ink-soft)' }}>{f.desc}</p>
                </motion.div>
              ))}
            </motion.div>
            <motion.div {...fadeUp(0.1)} className="hg-tile mt-4 p-6 sm:p-8 text-center">
              <p className="hg-eyebrow mb-3">Exempel på säljlänk</p>
              <p className="font-mono text-sm sm:text-base break-all rounded-xl px-4 py-3 mb-5" style={{ background: 'rgba(125,155,118,.12)' }}>
                https://honsgarden.se/s/bergs-agg
              </p>
              <a href="/login?mode=register" className="hg-cta-primary inline-flex items-center gap-2 h-12 min-h-[48px] px-7 text-base font-medium">
                Skapa din första säljsida <ArrowRight className="h-4 w-4" />
              </a>
            </motion.div>
          </div>
        </section>

        {/* Så fungerar det */}
        <section className="py-16 sm:py-24" style={{ background: 'var(--hg-cream)' }}>
          <div className="container max-w-6xl mx-auto px-5 sm:px-6">
            <SectionHeading title="Så fungerar Agdas äggbod i praktiken" desc="Från första säljsidan till uppföljning av betalning, hämtning och återkommande kunder." />
            <motion.ol variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
              {agdaSteps.map((s) => (
                <motion.li key={s.step} variants={staggerItem} className="hg-tile hg-tile--hover p-6">
                  <span className="text-3xl block mb-3" style={{ color: 'var(--hg-sage-deep)', fontFamily: "'DM Serif Display', Georgia, serif" }}>{s.step}</span>
                  <h3 className="text-base mb-2">{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--hg-ink-soft)' }}>{s.desc}</p>
                </motion.li>
              ))}
            </motion.ol>
          </div>
        </section>

        {/* Målgrupper */}
        <section className="py-16 sm:py-24" style={{ background: 'var(--hg-cream-2)' }}>
          <div className="container max-w-6xl mx-auto px-5 sm:px-6">
            <SectionHeading title="För vem passar Hönsgården?" desc="Några få hönor, kläckningar eller lokal äggförsäljning – du får bättre ordning oavsett." />
            <motion.div variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              {audience.map((a) => (
                <motion.div key={a.title} variants={staggerItem} className="hg-tile hg-tile--hover p-6">
                  <span className="hg-icon mb-4"><a.icon className="h-5 w-5" /></span>
                  <h3 className="text-lg mb-2">{a.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--hg-ink-soft)' }}>{a.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Trygghet */}
        <section className="py-16 sm:py-20" style={{ background: 'var(--hg-cream)' }}>
          <div className="container max-w-5xl mx-auto px-5 sm:px-6">
            <SectionHeading title="Tryggt och enkelt att komma igång" />
            <motion.div variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {trustItems.map((item) => (
                <motion.div key={item} variants={staggerItem} className="hg-tile px-4 py-3 flex items-center gap-2 text-sm">
                  <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: 'var(--hg-sage-deep)' }} />
                  {item}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Priser */}
        <section id="priser" className="py-16 sm:py-24" style={{ background: 'var(--hg-cream-2)' }}>
          <div className="container max-w-5xl mx-auto px-5 sm:px-6">
            <SectionHeading
              eyebrow="Priser"
              title="Börja gratis – uppgradera när du vill ha mer hjälp"
              desc="Gratis ger dig grunden. Plus ger mer AI, insikter, rapporter och obegränsad användning."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <PricingCard title="Gratis" price="0 kr" desc="För att komma igång ordentligt" features={freeFeatures} cta="Skapa konto gratis" />
              <PricingCard title="Plus – Månad" price="39 kr/mån" desc="För mer statistik och smartare stöd" features={plusFeatures} cta="Prova 7 dagar gratis" />
              <PricingCard highlighted title="Plus – År" price="299 kr/år" desc="Bästa värdet – motsvarar 24,90 kr/mån" features={plusFeatures} cta="Prova 7 dagar – välj år" />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 sm:py-24" style={{ background: 'var(--hg-cream)' }}>
          <div className="container max-w-2xl mx-auto px-5 sm:px-6">
            <SectionHeading title="Vanliga frågor" />
            <motion.div {...fadeUp(0.1)}>
              <Accordion type="single" collapsible className="space-y-2.5">
                {faqs.map((f, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="hg-tile border-0 overflow-hidden px-1">
                    <AccordionTrigger className="text-sm sm:text-base font-medium hover:no-underline px-4 text-left">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-sm px-4 pb-4 leading-relaxed" style={{ color: 'var(--hg-ink-soft)' }}>{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </div>
        </section>

        {/* Slutlig CTA */}
        <section className="pb-16 sm:pb-24" style={{ background: 'var(--hg-cream)' }}>
          <div className="container max-w-3xl mx-auto px-5 sm:px-6">
            <motion.div {...fadeUp()} className="hg-tile hg-tile--deep p-8 sm:p-14 text-center">
              <p className="hg-eyebrow mb-4" style={{ color: 'rgba(219,231,212,.85)' }}>Hönsgården</p>
              <h2 className="text-2xl sm:text-4xl mb-4">Flocken berättar mer än man tror</h2>
              <p className="text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed" style={{ color: 'rgba(244,241,230,.78)' }}>
                När du loggar ägg, foder, hälsa, försäljning och rutiner får du något bättre än magkänsla: sparad erfarenhet som hjälper dig fatta bättre beslut.
              </p>
              <a
                href="/login?mode=register"
                onClick={() => trackRegisterCta('landing_final_cta')}
                className="inline-flex items-center gap-2 h-14 min-h-[56px] px-10 text-lg font-medium rounded-full"
                style={{ background: '#f4f1e6', color: '#22392b' }}
              >
                Skapa konto gratis <ArrowRight className="h-5 w-5" />
              </a>
              <p className="text-xs mt-5" style={{ color: 'rgba(244,241,230,.6)' }}>Börja gratis · Mobilvänligt · Byggt för svenska hönsägare</p>
            </motion.div>
          </div>
        </section>

        <Suspense fallback={null}><LandingFooter /></Suspense>
      </div>
    </main>
  );
}

function PricingCard({ title, price, desc, features, cta, highlighted = false }: { title: string; price: string; desc: string; features: string[]; cta: string; highlighted?: boolean }) {
  return (
    <motion.div
      {...fadeUp(highlighted ? 0.16 : 0.08)}
      className={`hg-tile hg-tile--hover p-6 sm:p-8 flex flex-col ${highlighted ? 'hg-tile--deep' : ''}`}
    >
      {highlighted && (
        <span className="hg-chip absolute -top-3 left-6 text-[11px] font-semibold" style={{ background: '#f4f1e6', color: '#22392b' }}>
          Spara 169 kr
        </span>
      )}
      <h3 className="text-xl mb-1">{title}</h3>
      <p className="text-sm mb-6" style={{ color: highlighted ? 'rgba(244,241,230,.7)' : 'var(--hg-ink-soft)' }}>{desc}</p>
      <p className="text-4xl mb-6" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>{price}</p>
      <ul className="space-y-2.5 mb-8">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-sm">
            <Check className="h-4 w-4 shrink-0" style={{ color: highlighted ? '#b9d0b0' : 'var(--hg-sage-deep)' }} />
            {f}
          </li>
        ))}
      </ul>
      <a
        href="/login?mode=register"
        className={`mt-auto inline-flex items-center justify-center h-12 min-h-[48px] px-6 text-base font-medium rounded-full ${highlighted ? '' : 'hg-cta-ghost'}`}
        style={highlighted ? { background: '#f4f1e6', color: '#22392b' } : undefined}
      >
        {cta}
      </a>
    </motion.div>
  );
}
