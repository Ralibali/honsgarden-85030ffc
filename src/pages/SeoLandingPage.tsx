import React, { lazy, Suspense } from 'react';
import { useSeo } from '@/hooks/useSeo';
import LandingNavbar from '@/components/LandingNavbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Check, Egg, Bird, Wheat, CalendarDays, Calculator, BarChart3, ClipboardCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const LandingFooter = lazy(() => import('@/components/LandingFooter'));
const StickyMobileCTA = lazy(() => import('@/components/StickyMobileCTA'));

type PageKey = 'app-for-honsagare' | 'agglogg' | 'honskalender' | 'foderkostnad-hons' | 'klackningskalender' | 'borja-med-hons';

interface LandingPageData {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  icon: React.ElementType;
  heroBullets: string[];
  sections: { title: string; body: string; bullets?: string[] }[];
  practicalTips: string[];
  faq: { q: string; a: string }[];
}

const pages: Record<PageKey, LandingPageData> = {
  'app-for-honsagare': {
    path: '/app-for-honsagare',
    title: 'App för hönsägare – ägg, flock & foder | Hönsgården',
    description: 'Hönsgården är en svensk app för hobbyhönsägare. Logga ägg, följ flocken, räkna foderkostnad och skapa vardagsrutiner direkt i mobilen.',
    eyebrow: 'Svensk app för hobbyhönsägare',
    h1: 'En app för dig som vill ha riktig koll på hönsgården',
    intro: 'Efter många år med höns lär man sig att det inte räcker att “gå på känsla”. En höna som slutar värpa, en foderkostnad som smyger iväg eller en kläckning där dagarna blandas ihop – allt blir enklare när du har ordning på historiken. Hönsgården samlar ägg, flock, foder, ekonomi och påminnelser på ett sätt som passar svenska hobbyhönsägare.',
    primaryCta: 'Skapa konto gratis',
    secondaryCta: 'Se äggloggaren',
    icon: Bird,
    heroBullets: ['Logga ägg på några sekunder', 'Följ hönor, flockar och hälsa', 'Se foderkostnad och statistik över tid'],
    sections: [
      { title: 'Byggd för verklig hönsvardag', body: 'Hönsgården är gjord för de små återkommande sakerna: samla ägg, fylla vatten, köpa foder, hålla koll på ruggning, notera en haltande höna och minnas när du startade en kläckning. Det är där appen gör skillnad.' },
      { title: 'Bättre än anteckningsbok och lösa lappar', body: 'En anteckningsbok fungerar tills du vill jämföra veckor, hitta när en höna började värpa eller se vad ett ägg faktiskt kostar. I Hönsgården blir anteckningarna användbara data utan att det känns krångligt.' },
      { title: 'Mobil först – direkt i hönshuset', body: 'De flesta loggar inte ägg framför datorn. Därför är Hönsgården byggd för mobilen, med stora knappar, snabb loggning och tydlig översikt även när du står ute i stövlar.' },
    ],
    practicalTips: ['Lägg in dina hönor först, även om du bara fyller i namn.', 'Logga ägg varje dag i minst en vecka för att se första trenden.', 'Lägg in foderinköp när du köper säcken, inte i efterhand.', 'Skapa påminnelser för vatten, rengöring och kvalsterkontroll.'],
    faq: [
      { q: 'Vem passar Hönsgården för?', a: 'För dig som har höns hemma, på gården eller som hobbyuppfödning och vill slippa hålla allt i huvudet.' },
      { q: 'Kan jag använda appen med bara några få hönor?', a: 'Ja. Appen fungerar lika bra för tre hönor på tomten som för en större hobbyflock.' },
      { q: 'Är appen svår att komma igång med?', a: 'Nej. Börja med att lägga till en höna och logga dagens ägg. Resten kan du fylla på efter hand.' },
    ],
  },
  agglogg: {
    path: '/agglogg',
    title: 'Ägglogg – logga ägg och följ värpning | Hönsgården',
    description: 'Digital ägglogg för hönsägare. Logga dagens ägg snabbt, se veckotrender, jämför perioder och förstå hur flocken värper.',
    eyebrow: 'Digital ägglogg',
    h1: 'Logga ägg snabbt – och förstå vad siffrorna betyder',
    intro: 'När man har haft höns ett tag märker man att äggproduktionen berättar mycket. Väder, årstid, ruggning, ålder, foder och stress syns ofta i äggkorgen innan man ser det på hönan. Med Hönsgårdens ägglogg kan du snabbt se om flocken går som vanligt eller om något börjar avvika.',
    primaryCta: 'Börja logga ägg gratis',
    secondaryCta: 'Läs om foderkostnad',
    icon: Egg,
    heroBullets: ['Dagens datum är förvalt', 'Plus/minus för antal ägg', 'Vecka, månad och historik i tydliga vyer'],
    sections: [
      { title: 'Snabb nog att använda varje dag', body: 'En ägglogg måste vara enkel, annars används den inte. Därför är Hönsgården gjord för att du ska kunna registrera dagens ägg på några sekunder, utan onödiga fält.' },
      { title: 'Se när något förändras', body: 'Om produktionen plötsligt går ner kan det bero på ruggning, kyla, värme, foderbyte, ohyra eller att någon höna blivit äldre. När du loggar löpande får du en baslinje att jämföra mot.' },
      { title: 'Koppla ägg till höna eller flock', body: 'Vill du nörda ner dig kan du logga per höna eller flock. Det hjälper dig se vilka hönor som värper mest och vilka som kanske behöver extra koll.' },
    ],
    practicalTips: ['Logga antal ägg samma tid varje dag.', 'Skriv en kort notering vid avvikande skal, små ägg eller blodfläckar.', 'Jämför helst veckor, inte enstaka dagar.', 'Titta extra på trender vid ruggning och foderbyte.'],
    faq: [
      { q: 'Måste jag logga per höna?', a: 'Nej. Du kan börja med totalen för hela flocken och lägga till detaljer senare.' },
      { q: 'Varför ska jag logga ägg?', a: 'För att du snabbare ser förändringar i hälsa, säsong, foder och värpning.' },
      { q: 'Kan jag se statistik?', a: 'Ja, när du har loggat några dagar kan appen visa vecka, månad, trender och historik.' },
    ],
  },
  honskalender: {
    path: '/honskalender',
    title: 'Hönskalender – skötsel och rutiner | Hönsgården',
    description: 'Hönskalender för svenska hönsägare. Håll koll på rengöring, foder, vatten, kvalster, ruggning, kläckning och säsongsrutiner.',
    eyebrow: 'Kalender för hönshuset',
    h1: 'En hönskalender som hjälper dig ligga steget före',
    intro: 'Höns mår bäst av lugna, återkommande rutiner. Vatten ska inte frysa, reden ska hållas rena, kvalster ska upptäckas tidigt och under ruggning behöver flocken ofta lite extra stöd. En bra hönskalender gör att du slipper komma ihåg allt själv.',
    primaryCta: 'Skapa dina första rutiner',
    secondaryCta: 'Se appen för hönsägare',
    icon: CalendarDays,
    heroBullets: ['Påminnelser för dagliga och återkommande sysslor', 'Säsongstips för svenska förhållanden', 'Samla rutiner, hälsa och kläckning på ett ställe'],
    sections: [
      { title: 'Från dagliga sysslor till säsongskoll', body: 'Vissa saker görs varje dag, andra varje vecka eller bara några gånger per år. Hönsgården hjälper dig skilja på det viktiga nu och det som kan planeras längre fram.' },
      { title: 'Mindre stress i vardagen', body: 'När rutinerna finns i appen behöver du inte fundera på när du senast rengjorde reden, kollade kvalster eller bytte strö. Det blir tryggare både för dig och flocken.' },
      { title: 'Svensk årstid spelar roll', body: 'Vinter, vår, sommar och höst påverkar höns på olika sätt. Vatten, ljus, värme, ruggning och ohyra kräver olika fokus beroende på säsong.' },
    ],
    practicalTips: ['Ha daglig rutin för vatten och foder.', 'Lägg in veckovis snabbkontroll av reden och strö.', 'Påminn dig om kvalsterkontroll under varmare månader.', 'Planera extra protein vid ruggning.'],
    faq: [
      { q: 'Vad ska finnas i en hönskalender?', a: 'Vatten, foder, rengöring, kvalsterkontroll, hälsokoll, kläckning och säsongsrutiner.' },
      { q: 'Kan jag skapa återkommande påminnelser?', a: 'Ja, Hönsgården stödjer återkommande rutiner och påminnelser.' },
      { q: 'Är kalendern mest för stora flockar?', a: 'Nej. Även små flockar mår bra av regelbunden skötsel och tydliga rutiner.' },
    ],
  },
  'foderkostnad-hons': {
    path: '/foderkostnad-hons',
    title: 'Foderkostnad för höns – räkna kostnad per ägg | Hönsgården',
    description: 'Räkna ut foderkostnad för höns och kostnad per ägg. Hönsgården hjälper dig följa inköp, förbrukning och lönsamhet.',
    eyebrow: 'Foderkostnad och ekonomi',
    h1: 'Vet du vad dina ägg faktiskt kostar?',
    intro: 'Efter några år med höns inser man att “egna ägg” inte alltid är billiga – men de är värda mycket. Foder, strö, el, utrustning och veterinär kan snabbt bli mer än man tror. Med Hönsgården kan du räkna på foderkostnad per ägg och få en ärlig bild av hönsgårdens ekonomi.',
    primaryCta: 'Räkna foderkostnad i appen',
    secondaryCta: 'Börja med äggloggen',
    icon: Wheat,
    heroBullets: ['Registrera foderinköp', 'Se total foderkostnad', 'Räkna ungefärlig kostnad per ägg'],
    sections: [
      { title: 'Foder är ofta den största kostnaden', body: 'För många hobbyhönsägare är fodret den löpande kostnad som märks mest. När du loggar varje inköp kan du se vad flocken faktiskt kostar över tid.' },
      { title: 'Kostnad per ägg gör besluten enklare', body: 'Om du säljer eller ger bort ägg är det bra att veta ungefärlig kostnad per ägg. Det hjälper dig sätta rimliga priser och förstå vad hönsen kostar i praktiken.' },
      { title: 'Mer än bara kronor', body: 'Ekonomi handlar inte om att göra hönsen till en fabrik. Det handlar om att få koll, undvika överraskningar och kunna ta bättre beslut om foder, flockstorlek och försäljning.' },
    ],
    practicalTips: ['Logga foder samma dag du köper det.', 'Skriv gärna vikt i kilo och total kostnad.', 'Jämför kostnad per ägg över flera veckor.', 'Räkna även in strö och större inköp om du vill se helheten.'],
    faq: [
      { q: 'Hur räknar man kostnad per ägg?', a: 'Dela foderkostnaden under en period med antal ägg under samma period. Hönsgården hjälper dig göra detta automatiskt.' },
      { q: 'Måste jag sälja ägg för att använda ekonomin?', a: 'Nej. Många använder funktionen bara för att förstå sina kostnader bättre.' },
      { q: 'Kan jag logga andra kostnader än foder?', a: 'Ja, du kan även följa kostnader och intäkter i ekonomidelen.' },
    ],
  },
  klackningskalender: {
    path: '/klackningskalender',
    title: 'Kläckningskalender för hönsägg – dag 1–21 | Hönsgården',
    description: 'Digital kläckningskalender för hönsägg. Håll koll på startdatum, lysning, vändning, luftfuktighet och beräknad kläckdag.',
    eyebrow: 'Kläckningskalender',
    h1: 'Följ kläckningen dag för dag – från ägg till kyckling',
    intro: 'En kläckning är både spännande och lätt att tappa bort i kalendern. Dag 7 ska man ofta lysa, runt dag 18 slutar man vända och mot slutet blir fuktigheten extra viktig. Hönsgårdens kläckningskalender hjälper dig hålla koll på hela 21-dagarsresan.',
    primaryCta: 'Starta kläckningskalender',
    secondaryCta: 'Läs om hönskalender',
    icon: Egg,
    heroBullets: ['21-dagars nedräkning', 'Milstolpar för lysning och lockdown', 'Anteckningar per kläckning'],
    sections: [
      { title: 'Datumkoll är halva jobbet', body: 'När flera ägg ligger i maskin eller under höna är det lätt att blanda ihop dagar. En tydlig startdag och beräknad kläckdag minskar risken för misstag.' },
      { title: 'Lysning, vändning och fukt', body: 'En bra kläckningsrutin handlar om jämn temperatur, rätt fukt, försiktig vändning och att veta när man ska låta äggen vara ifred.' },
      { title: 'Lär av varje kull', body: 'Genom att notera antal ägg, befruktade ägg och kläckta kycklingar bygger du erfarenhet till nästa gång.' },
    ],
    practicalTips: ['Skriv alltid startdatum direkt när äggen sätts.', 'Lys äggen runt dag 7 och gärna igen runt dag 14.', 'Sluta vända runt dag 18.', 'Anteckna antal kläckta kycklingar för att följa kläckningsgrad.'],
    faq: [
      { q: 'Hur lång tid tar det att kläcka hönsägg?', a: 'Vanligtvis omkring 21 dagar, men någon dags variation kan förekomma.' },
      { q: 'När ska man sluta vända hönsägg?', a: 'Ofta runt dag 18, inför den sista kläckningsfasen.' },
      { q: 'Kan jag följa flera kläckningar samtidigt?', a: 'Ja, Hönsgården är byggd för att kunna hantera flera händelser och kullar.' },
    ],
  },
  'borja-med-hons': {
    path: '/borja-med-hons',
    title: 'Börja med höns – guide för nybörjare | Hönsgården',
    description: 'Börja med höns hemma? Här får du praktiska råd om hönshus, foder, ägg, rutiner och hur du får koll från första veckan.',
    eyebrow: 'För nya hönsägare',
    h1: 'Börja med höns utan att tappa kontrollen första veckan',
    intro: 'Att skaffa höns är fantastiskt – men det är också mer vardag än många tror. Vatten, foder, rovdjurssäkerhet, reden, strö, ägg, ruggning och små hälsotecken blir snabbt en del av rutinen. Hönsgården hjälper dig få ordning redan från start.',
    primaryCta: 'Kom igång gratis',
    secondaryCta: 'Se appen för hönsägare',
    icon: Bird,
    heroBullets: ['Första hönorna och första äggen', 'Rutiner för vatten, foder och rengöring', 'Koll på hälsa, kostnad och säsong'],
    sections: [
      { title: 'Börja enkelt – men börja strukturerat', body: 'Du behöver inte dokumentera allt från dag ett. Men om du lägger in hönornas namn, börjar logga ägg och skapar några enkla rutiner får du snabbt bättre koll.' },
      { title: 'Det du lär dig första månaderna är guld värt', body: 'Du kommer märka vilka hönor som är framåt, vilka som värper mest, när flocken blir stressad och hur foder påverkar vardagen. Skriv ner det – annars glöms det lätt.' },
      { title: 'Tryggare hönsägande med historik', body: 'När något känns fel är historiken ofta avgörande. Har äggproduktionen minskat? Har en höna varit hängig tidigare? När rengjorde du senast? Appen hjälper dig svara.' },
    ],
    practicalTips: ['Börja med en hanterbar flockstorlek.', 'Säkra hönshus och rastgård mot rovdjur.', 'Skapa dagliga rutiner för vatten, foder och ägg.', 'Logga enkla observationer om hälsa och beteende.'],
    faq: [
      { q: 'Hur många hönor ska man börja med?', a: 'Många börjar med 3–5 hönor. Det ger en liten men social flock och är lättare att lära känna.' },
      { q: 'Behöver jag en app direkt?', a: 'Du måste inte, men det hjälper dig få struktur från början och slippa minnas allt själv.' },
      { q: 'Vad är viktigast första veckan?', a: 'Vatten, foder, tryggt hönshus, lugn introduktion och att observera flockens beteende.' },
    ],
  },
};

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.42, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  };
}

export function SeoLandingPage({ pageKey }: { pageKey: PageKey }) {
  const page = pages[pageKey];
  const Icon = page.icon;

  useSeo({
    title: page.title,
    description: page.description,
    path: page.path,
    ogImage: 'https://honsgarden.se/blog-images/hens-garden.jpg',
    jsonLd: [
      {
        '@type': 'WebPage',
        name: page.h1,
        description: page.description,
        url: `https://honsgarden.se${page.path}`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: page.faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  });

  return (
    <main id="main-content" className="min-h-screen bg-background overflow-x-hidden">
      <Suspense fallback={null}><StickyMobileCTA /></Suspense>
      <LandingNavbar />

      <section className="relative pt-24 pb-14 sm:pt-32 sm:pb-20" style={{ background: 'linear-gradient(135deg, #f5f0e8 0%, #eef5ec 55%, #f5f0e8 100%)' }}>
        <div className="container max-w-6xl mx-auto px-5 sm:px-6">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-12 items-center">
            <motion.div {...fadeUp()}>
              <Badge className="bg-primary/10 text-primary border-primary/20 mb-4">{page.eyebrow}</Badge>
              <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl leading-[1.07] text-foreground mb-5">
                {page.h1}
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-6 max-w-2xl">
                {page.intro}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <Button asChild size="lg" className="h-12 px-7 gap-2 rounded-xl">
                  <a href="/login?mode=register">{page.primaryCta}<ArrowRight className="h-4 w-4" /></a>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 px-7 rounded-xl border-primary/30 text-primary hover:bg-primary/5">
                  <a href={page.secondaryCta.includes('foder') ? '/foderkostnad-hons' : page.secondaryCta.includes('ägg') || page.secondaryCta.includes('äggloggen') ? '/agglogg' : page.secondaryCta.includes('hönskalender') ? '/honskalender' : '/app-for-honsagare'}>{page.secondaryCta}</a>
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {page.heroBullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-2 rounded-xl bg-background/70 border border-border/50 p-3 text-sm text-foreground">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.08)} className="relative">
              <Card className="rounded-[2rem] border-primary/15 bg-card/80 shadow-xl overflow-hidden">
                <CardContent className="p-6 sm:p-8">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <p className="data-label mb-2">Praktiskt i vardagen</p>
                  <h2 className="font-serif text-2xl text-foreground mb-4">Det ska vara enkelt att göra rätt saker i tid</h2>
                  <div className="space-y-3">
                    {page.practicalTips.slice(0, 4).map((tip) => (
                      <div key={tip} className="flex gap-3 rounded-xl bg-muted/35 border border-border/40 p-3">
                        <span className="text-lg">🐔</span>
                        <p className="text-sm text-muted-foreground leading-relaxed">{tip}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-background">
        <div className="container max-w-5xl mx-auto px-5 sm:px-6 space-y-5">
          {page.sections.map((section, index) => (
            <motion.article key={section.title} {...fadeUp(index * 0.06)} className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  {[ClipboardCheck, Calculator, BarChart3][index % 3] && React.createElement([ClipboardCheck, Calculator, BarChart3][index % 3], { className: 'h-5 w-5 text-primary' })}
                </div>
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-2">{section.title}</h2>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{section.body}</p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="py-14 sm:py-20" style={{ background: 'linear-gradient(180deg, hsl(var(--secondary)/0.25), hsl(var(--background)))' }}>
        <div className="container max-w-5xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center mb-8">
            <h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">Råd från hönsgården</h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">Små rutiner gör stor skillnad när man vill förstå sin flock och slippa gissa.</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {page.practicalTips.map((tip) => (
              <div key={tip} className="rounded-2xl bg-card border border-border p-4 flex gap-3 shadow-sm">
                <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-background">
        <div className="container max-w-3xl mx-auto px-5 sm:px-6">
          <motion.div {...fadeUp()} className="text-center mb-8">
            <h2 className="font-serif text-2xl sm:text-4xl text-foreground">Vanliga frågor</h2>
          </motion.div>
          <div className="space-y-3">
            {page.faq.map((item) => (
              <Card key={item.q} className="border-border shadow-sm">
                <CardContent className="p-5">
                  <h3 className="font-serif text-lg text-foreground mb-2">{item.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-14 sm:pb-20 bg-background">
        <div className="container max-w-4xl mx-auto px-5 sm:px-6">
          <div className="rounded-3xl bg-gradient-to-br from-primary/12 via-accent/5 to-warning/5 border border-primary/15 p-7 sm:p-10 text-center">
            <span className="text-5xl block mb-4">🥚</span>
            <h2 className="font-serif text-2xl sm:text-4xl text-foreground mb-3">Börja enkelt – bygg erfarenhet över tid</h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed">
              Du behöver inte fylla i allt direkt. Börja med dagens ägg eller din första höna, så växer Hönsgården med din flock.
            </p>
            <Button asChild size="lg" className="h-12 px-8 rounded-xl gap-2">
              <a href="/login?mode=register">Skapa konto gratis<ArrowRight className="h-4 w-4" /></a>
            </Button>
          </div>
        </div>
      </section>

      <Suspense fallback={null}><LandingFooter /></Suspense>
    </main>
  );
}

export default SeoLandingPage;
