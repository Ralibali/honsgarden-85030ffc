import React from 'react';
import { useSeo } from '@/hooks/useSeo';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Egg, Mail, MapPin, Shield, Heart, BookOpen, ArrowRight, Users, Award, BarChart3, ReceiptText, Bot, CloudSun, Check } from 'lucide-react';
import VisitorWelcomePopup from '@/components/VisitorWelcomePopup';

const team = [
  {
    name: 'Hönsgården-teamet',
    role: 'Produkt, teknik & innehåll',
    bio: 'Vi bygger Hönsgården för svenska hönsägare som vill ha mer koll utan att fastna i kalkylark. Fokus är enkel vardagsloggning, tydlig överblick och praktiska verktyg för ägg, flock, försäljning och rutiner.',
    avatar: '🐔',
  },
];

const values = [
  { icon: Heart, title: 'Byggt för riktig hönsvardag', desc: 'Hönsgården ska fungera när du står vid hönshuset, inte bara när du sitter vid datorn.' },
  { icon: BarChart3, title: 'Från känsla till koll', desc: 'Ägg, foder, väder, hälsa och försäljning blir användbara mönster över tid.' },
  { icon: ReceiptText, title: 'Mindre Excel', desc: 'Agdas äggbod hjälper dig sälja ägg med länk, Swish, bokningar, kundlista och export.' },
  { icon: Users, title: 'Community och feedback', desc: 'Hönsägare kan dela inlägg, frågor och tips – och hjälpa oss bygga rätt saker vidare.' },
  { icon: Bot, title: 'Smart hjälp från Agda', desc: 'AI-stöd, rapporter och förslag ska göra appen mer användbar utan att kännas krånglig.' },
  { icon: Shield, title: 'Din data är din', desc: 'Du ska känna dig trygg med informationen om din flock, dina rutiner och din försäljning.' },
];

const offering = [
  'Ägglogg och historik',
  'Hönsprofiler och flocköversikt',
  'Statistik, trender och rapporter',
  'Foderkostnad och ekonomi',
  'Kalender, rutiner och påminnelser',
  'Kläckningskalender',
  'Väder och påverkan',
  'Community med inlägg',
  'Feedback och produktförslag',
  'Agdas äggbod för lokal äggförsäljning',
  'Bokningar, kunder, betalstatus och export',
  'Agda AI och premiuminsikter',
];

export default function About() {
  useSeo({
    title: 'Om Hönsgården – appen för ägg, flock, försäljning och mer koll',
    description: 'Hönsgården hjälper svenska hönsägare att logga ägg, följa flocken, sälja ägg med Agdas äggbod, få statistik, rapporter, community och AI-stöd.',
    path: '/om-oss',
    ogImage: '/blog-images/hens-garden.jpg',
    jsonLd: [
      {
        '@type': 'AboutPage',
        '@id': 'https://honsgarden.se/om-oss',
        name: 'Om Hönsgården',
        description: 'Hönsgården är en svensk app för hönsägare med ägglogg, flock, försäljning, community, statistik och AI-stöd.',
        url: 'https://honsgarden.se/om-oss',
        isPartOf: { '@id': 'https://honsgarden.se/#website' },
        inLanguage: 'sv-SE',
      },
      {
        '@type': 'Organization',
        '@id': 'https://honsgarden.se/#organization',
        name: 'Hönsgården',
        url: 'https://honsgarden.se',
        logo: { '@type': 'ImageObject', url: 'https://honsgarden.se/favicon.ico', width: 512, height: 512 },
        description: 'Hönsgården hjälper hobbyhönsägare att hålla koll på ägg, flock, foder, ekonomi, rutiner, community och lokal äggförsäljning.',
        email: 'info@auroramedia.se',
        foundingDate: '2024',
        address: { '@type': 'PostalAddress', addressCountry: 'SE' },
        sameAs: [],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Hem', item: 'https://honsgarden.se' },
          { '@type': 'ListItem', position: 2, name: 'Om oss', item: 'https://honsgarden.se/om-oss' },
        ],
      },
    ],
  });

  return (
    <div className="min-h-screen bg-background">
      <VisitorWelcomePopup />

      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-xl">🐔</span>
            <span className="font-serif text-lg text-foreground">Hönsgården</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/salja-agg" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Sälj ägg</Link>
            <Link to="/blogg" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Blogg</Link>
            <Link to="/login">
              <Button size="sm" className="rounded-xl text-xs gap-1">
                <Egg className="h-3 w-3" /> Kom igång
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 sm:py-16">
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 text-primary text-xs font-medium mb-4">
            <Heart className="h-3.5 w-3.5" /> Om Hönsgården
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif text-foreground mb-4 leading-tight">
            Vi bygger kontrollpanelen för svenska hönsägare
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Hönsgården började som en digital ägglogg, men har vuxit till ett komplett verktyg för dig som vill följa flocken, förstå kostnader, sköta rutiner, sälja ägg, dela erfarenheter och få smartare hjälp i vardagen.
          </p>
        </div>

        <section className="mb-14 sm:mb-20">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-10">
            <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-4 flex items-center gap-2">
              <span className="text-2xl">📖</span> Varför Hönsgården finns
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              <p>
                Hönsägande är fullt av små detaljer: dagens ägg, hönornas beteende, foder, väder, rengöring, kvalster, ruggning, kläckningar och ibland lokal äggförsäljning. Mycket hamnar annars i huvudet, i mobilen, på lappar eller i Excel.
              </p>
              <p>
                Hönsgården samlar allt detta på ett ställe. Du kan logga snabbt, se mönster över tid och få bättre överblick utan att det känns som administration.
              </p>
              <p>
                Med Agdas äggbod kan du dessutom skapa säljsidor, ta emot bokningar, hålla koll på kunder och följa betalning och hämtning. Det gör Hönsgården till både gårdsdagbok, dashboard och försäljningsstöd.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-14 sm:mb-20">
          <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-6 text-center">Det Hönsgården erbjuder</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {offering.map((item) => (
              <div key={item} className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-14 sm:mb-20">
          <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-6 text-center">Vad vi tror på</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {values.map((v) => (
              <div key={v.title} className="p-5 rounded-2xl bg-card border border-border">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <v.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-serif text-base text-foreground mb-1">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-14 sm:mb-20">
          <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-6 text-center">Teamet</h2>
          <div className="max-w-md mx-auto">
            {team.map((member) => (
              <div key={member.name} className="p-6 rounded-2xl bg-card border border-border text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl mx-auto mb-4">
                  {member.avatar}
                </div>
                <h3 className="font-serif text-lg text-foreground">{member.name}</h3>
                <p className="text-xs text-primary font-medium mb-3">{member.role}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{member.bio}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-14 sm:mb-20">
          <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-6 text-center">Kontakta oss</h2>
          <div className="max-w-md mx-auto bg-card border border-border rounded-2xl p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">E-post</p>
                  <a href="mailto:info@auroramedia.se" className="text-sm text-primary hover:underline">info@auroramedia.se</a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Land</p>
                  <p className="text-sm text-foreground">Sverige 🇸🇪</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Award className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Grundat</p>
                  <p className="text-sm text-foreground">2024</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="text-center bg-gradient-to-br from-primary/5 via-card to-accent/5 rounded-3xl p-8 sm:p-12 border border-border/30">
          <span className="text-3xl mb-3 block">🥚</span>
          <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-2">
            Vill du få mer koll på din hönsgård?
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
            Skapa konto gratis och börja med äggloggen, flocken eller din första säljsida i Agdas äggbod.
          </p>
          <Link to="/login?mode=register">
            <Button size="lg" className="rounded-xl gap-2">
              <Egg className="h-4 w-4" /> Kom igång nu <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </main>

      <footer className="border-t border-border/50 mt-16 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Hönsgården</span>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-foreground transition-colors">Startsidan</Link>
            <Link to="/salja-agg" className="hover:text-foreground transition-colors">Sälj ägg</Link>
            <Link to="/blogg" className="hover:text-foreground transition-colors">Blogg</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Villkor</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
