import { ArrowRight, BarChart3, Bot, ClipboardCheck, CloudSun, MessageCircle } from 'lucide-react';
import LandingNavbar from '@/components/LandingNavbar';
import LandingFooter from '@/components/LandingFooter';
import { Button } from '@/components/ui/button';
import { useSeo } from '@/hooks/useSeo';

const features = {
  'agda-ai': {
    icon: Bot, title: 'Agda AI', headline: 'Hjälp att förstå din hönsgård', plan: 'Ingår i Plus',
    intro: 'Fråga Agda om vardagen med höns och få hjälp att tolka det du loggat. Du kan fortsätta samtalet och ställa följdfrågor när du vill förstå mer.',
    items: [
      ['Ställ din fråga', 'Fråga om foder, skötsel eller förändringar i värpningen.'],
      ['Utgå från din gård', 'Agda kan använda din gårds registrerade uppgifter som sammanhang för sina råd.'],
      ['Ta nästa steg', 'Få förslag att undersöka vidare och hjälp att sammanfatta dina funderingar.'],
    ],
    note: 'Agda är AI och kan ha fel. Vid misstänkt sjukdom behöver en veterinär bedöma hönan.',
  },
  statistik: {
    icon: BarChart3, title: 'Statistik & insikter', headline: 'Se mönstren bakom dagens ägg', plan: 'Grundstatistik gratis · fler insikter med Plus',
    intro: 'Dina äggnoteringar blir en översikt över hur flocken värper. Följ utvecklingen över tid och få bättre underlag när något förändras.',
    items: [
      ['Följ värpningen', 'Se äggproduktion, snitt och förändringar mellan perioder.'],
      ['Jämför hönor och flockar', 'När du loggar per höna eller flock kan du följa deras resultat var för sig.'],
      ['Fördjupa med Plus', 'Utforska prognoser, avvikelser och samband med bland annat foder och säsong.'],
    ],
    note: 'Statistik och prognoser bygger på de uppgifter du registrerar. Mer historik ger bättre underlag.',
  },
  vader: {
    icon: CloudSun, title: 'Väder & påverkan', headline: 'Planera hönsvardagen efter vädret', plan: 'Ingår i Plus',
    intro: 'Samla väderprognosen och råd för hönsgården på samma ställe. Förbered vatten, skugga och skydd när vädret skiftar.',
    items: [
      ['Vädret där du är', 'Se aktuell temperatur, vind och luftfuktighet för gårdens plats.'],
      ['Tio dagar framåt', 'Följ prognosen för temperatur, nederbörd och vind.'],
      ['Råd och historik', 'Ta del av väderbaserade råd från Agda och gå tillbaka till tidigare väder och råd.'],
    ],
    note: 'Prognoser och AI-råd är stöd för din planering och kan förändras.',
  },
  community: {
    icon: MessageCircle, title: 'Community', headline: 'Dela hönsvardagen med andra', plan: 'Tillgängligt med konto',
    intro: 'Ett utrymme för frågor, tips och erfarenheter från andra hönsägare. Läs inlägg, dela en fundering och delta i samtalet.',
    items: [
      ['Skriv ett inlägg', 'Berätta om din flock eller ställ en fråga till andra hönsägare.'],
      ['Dela erfarenheter', 'Läs andras inlägg och reagera på sådant du uppskattar.'],
      ['Hjälp till att hålla god ton', 'Inlägg kan rapporteras och modereras.'],
    ],
    note: 'Du behöver logga in för att delta. Inlägg från medlemmar visas inte på den här informationssidan.',
  },
  rapporter: {
    icon: ClipboardCheck, title: 'Rapporter & export', headline: 'Ta med dig översikten från hönsgården', plan: 'Rapporter med Plus',
    intro: 'Sammanställ gårdens uppgifter och spara dem för egen uppföljning. Rapporter och export gör det lättare att se helheten över tid.',
    items: [
      ['Välj din period', 'Skapa sammanställningar för månad, kvartal eller år.'],
      ['Spara en rapport', 'Generera PDF-rapporter med gårdens registrerade uppgifter.'],
      ['Arbeta vidare med dina siffror', 'Exportera bokningar och kundlistor som CSV från Agdas äggbod och statistik till Excel.'],
    ],
    note: 'Rapporternas innehåll beror på vad du har registrerat och vilken rapport du väljer.',
  },
} as const;

export type FeatureKey = keyof typeof features;

export default function FeatureOverview({ feature }: { feature: FeatureKey }) {
  const page = features[feature];
  const Icon = page.icon;
  useSeo({ title: `${page.title} | Hönsgården`, description: page.intro, path: `/funktioner/${feature}` });

  return (
    <div className="min-h-dvh bg-background">
      <LandingNavbar />
      <main id="main-content" className="container max-w-5xl mx-auto px-5 pt-24 pb-16">
        <a href="/#funktioner" className="text-sm text-primary underline underline-offset-4">Alla funktioner</a>
        <header className="max-w-3xl py-10 sm:py-14">
          <Icon className="h-10 w-10 text-primary mb-5" aria-hidden="true" />
          <p className="text-sm font-medium text-primary mb-3">{page.title} · {page.plan}</p>
          <h1 className="font-serif text-3xl sm:text-5xl leading-tight mb-5">{page.headline}</h1>
          <p className="text-lg leading-relaxed text-muted-foreground">{page.intro}</p>
        </header>
        <section className="grid gap-4 md:grid-cols-3" aria-label={`Det här kan du göra med ${page.title}`}>
          {page.items.map(([title, description]) => (
            <article key={title} className="rounded-2xl border bg-card p-6">
              <h2 className="font-serif text-xl mb-3">{title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            </article>
          ))}
        </section>
        <p className="my-6 text-sm text-muted-foreground">{page.note}</p>
        <section className="mt-10 rounded-3xl bg-primary/5 border border-primary/15 p-6 sm:p-8">
          <h2 className="font-serif text-2xl mb-3">Lär känna Hönsgården i din egen takt</h2>
          <p className="text-muted-foreground mb-6">Börja med den interaktiva appdemon utan konto, eller skapa ett konto för din egen flock.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="h-12"><a href="/login?mode=register">Kom igång gratis <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></a></Button>
            <Button asChild variant="outline" className="h-12"><a href="/demo">Prova appdemon utan konto</a></Button>
            <Button asChild variant="ghost" className="h-12"><a href="/#priser">Se priser och vad som ingår</a></Button>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
