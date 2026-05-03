import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, Check, Bell, BarChart3, Download, TrendingUp, Star, Calculator, Camera, ClipboardCheck, Baby, Loader2, Settings, Sparkles, ArrowRight, CalendarDays, Users, HeartHandshake, ShieldCheck, Bot, ReceiptText, HeartPulse, Wheat } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

const PLANS = {
  monthly: "monthly",
  yearly: "yearly",
} as const;

const valuePillars = [
  {
    icon: Bot,
    title: 'AI som fÃ¶rstÃ¥r hÃ¶nsgÃ¥rden',
    desc: 'FÃ¥ rÃ¥d, veckorapporter och avvikelsevarningar som bygger pÃ¥ dina egna loggar â€“ inte generiska tips.',
    bullets: ['AI-coach pÃ¥ dashboarden', 'AI-veckorapport', 'Avvikelsevarningar'],
  },
  {
    icon: Calculator,
    title: 'Ekonomi som gÃ¥r att anvÃ¤nda',
    desc: 'Se foderkostnad, kostnad per Ã¤gg, intÃ¤kter och obetalda Ã¤ggfÃ¶rsÃ¤ljningar pÃ¥ ett praktiskt sÃ¤tt.',
    bullets: ['Foderkostnad per Ã¤gg', 'SÃ¤lj Ã¤gg-modul', 'Export och rapporter'],
  },
  {
    icon: HeartPulse,
    title: 'Tryggare vardag',
    desc: 'HÃ¥ll koll pÃ¥ flockens rytm, rutiner, hÃ¤lsosignaler, klÃ¤ckning och vad som behÃ¶ver gÃ¶ras hÃ¤rnÃ¤st.',
    bullets: ['FlockhÃ¤lsa-light', 'Smarta rutiner', 'KlÃ¤ckningskalender'],
  },
];

const premiumFeatures = [
  { text: 'AI-hÃ¶nsgÃ¥rdscoach med personliga rÃ¥d', icon: 'ðŸ¤–' },
  { text: 'AI-veckorapport och tydliga nÃ¤sta steg', icon: 'âœ¨' },
  { text: 'Avvikelsevarningar nÃ¤r nÃ¥got Ã¤ndras i flocken', icon: 'ðŸ”Ž' },
  { text: 'Avancerad statistik, trender och Ã¤ggmÃ¥l', icon: 'ðŸ“Š' },
  { text: 'FoderspÃ¥rning och kostnad per Ã¤gg', icon: 'ðŸŒ¾' },
  { text: 'Agdas Bod â€“ din gÃ¥rdsbutik fÃ¶r Ã¤ggfÃ¶rsÃ¤ljning (just nu Ã¶ppet fÃ¶r alla)', icon: 'ðŸ¥š' },
  { text: 'Ekonomi, intÃ¤kter, kostnader och export', icon: 'ðŸ’°' },
  { text: 'FlockhÃ¤lsa-light och bÃ¤ttre hÃ¶nsprofiler', icon: 'ðŸ’š' },
  { text: 'KlÃ¤ckningskalender med milstolpar', icon: 'ðŸ£' },
  { text: 'Smarta pÃ¥minnelser och dagliga uppgifter', icon: 'ðŸ””' },
  { text: 'PDF/CSV-export och rapporter', icon: 'ðŸ“¥' },
  { text: 'Prioriterad support och framtida premiumfunktioner', icon: 'â­' },
];

const freeFeatures = ['Ã„ggloggning', 'Upp till 10 hÃ¶nor', 'Enkel hÃ¤lsologg', 'Grundstatistik', 'Dagbok', 'MobilvÃ¤nlig PWA'];

const highlights = [
  { icon: Bot, title: 'AI-rÃ¥d som inte kÃ¤nns som en robot', desc: 'HÃ¶nsgÃ¥rden tolkar dina siffror och ger korta, snÃ¤lla och praktiska rÃ¥d.' },
  { icon: TrendingUp, title: 'FÃ¶rstÃ¥ varfÃ¶r siffrorna Ã¤ndras', desc: 'Se om produktionen Ã¤r uppÃ¥t, nedÃ¥t eller stabil â€“ och vad du kan gÃ¶ra.' },
  { icon: ReceiptText, title: 'Agdas Bod â€“ sÃ¤lj Ã¤gg utan krÃ¥ngel', desc: 'Skapa sÃ¤ljsidor, ta emot bokningar, hÃ¥ll koll pÃ¥ lager, kunder och Swish-betalningar. Ã–ppet fÃ¶r alla just nu, blir Plus-funktion framÃ¶ver.' },
  { icon: Wheat, title: 'RÃ¤kna pÃ¥ verklig kostnad', desc: 'Se vad fodret kostar och vad varje Ã¤gg ungefÃ¤r landar pÃ¥.' },
  { icon: HeartPulse, title: 'HÃ¥ll koll pÃ¥ flockens rytm', desc: 'FlockhÃ¤lsa-light hjÃ¤lper dig upptÃ¤cka nÃ¤r nÃ¥got Ã¤r vÃ¤rt att observera.' },
  { icon: Bell, title: 'FÃ¥ hjÃ¤lp med rutinerna', desc: 'PÃ¥minnelser gÃ¶r att vatten, foder, rengÃ¶ring och kontroll inte glÃ¶ms bort.' },
  { icon: Baby, title: 'Tryggare klÃ¤ckningar', desc: 'HÃ¥ll koll pÃ¥ dag 7, dag 14, lockdown och berÃ¤knad klÃ¤ckning.' },
  { icon: Download, title: 'Ta ut dina data', desc: 'Exportera rapporter nÃ¤r du vill dela, spara eller bokfÃ¶ra.' },
];

const testimonials = [
  { name: 'Anna-Lena', location: 'Dalarna', text: 'Jag trodde jag hade koll, men fÃ¶rst nÃ¤r jag sÃ¥g kostnad per Ã¤gg fÃ¶rstod jag flocken pÃ¥ riktigt.' },
  { name: 'Per-Olof', location: 'SkÃ¥ne', text: 'KlÃ¤ckningskalendern gjorde att jag slapp dubbelkolla datum hela tiden. Det blev lugnare.' },
  { name: 'Margareta', location: 'Gotland', text: 'PÃ¥minnelserna gÃ¶r stÃ¶rst skillnad. Nu Ã¤r det inte bara jag som behÃ¶ver komma ihÃ¥g allt.' },
];

export default function Premium() {
  const { user, refreshSubscription } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchParams] = useSearchParams();
  const isPremium = user?.subscription_status === 'premium' || user?.is_premium;

  const premiumJsonLd = useMemo(() => ({
    '@type': 'Product',
    name: 'HÃ¶nsgÃ¥rden Plus',
    description:
      'Premiumabonnemang fÃ¶r HÃ¶nsgÃ¥rden med AI-coach, veckorapport, ekonomi och avancerade insikter fÃ¶r hÃ¶nsgÃ¥rdar.',
    brand: { '@type': 'Brand', name: 'HÃ¶nsgÃ¥rden' },
    offers: [
      {
        '@type': 'Offer',
        name: 'HÃ¶nsgÃ¥rden Plus â€“ mÃ¥nad',
        price: '19',
        priceCurrency: 'SEK',
        availability: 'https://schema.org/InStock',
        url: 'https://honsgarden.se/app/premium',
      },
      {
        '@type': 'Offer',
        name: 'HÃ¶nsgÃ¥rden Plus â€“ Ã¥r',
        price: '149',
        priceCurrency: 'SEK',
        availability: 'https://schema.org/InStock',
        url: 'https://honsgarden.se/app/premium',
      },
    ],
  }), []);

  useSeo({
    title: 'HÃ¶nsgÃ¥rden Plus â€“ AI-coach, ekonomi & insikter fÃ¶r hÃ¶nsgÃ¥rden',
    description:
      'Uppgradera till HÃ¶nsgÃ¥rden Plus fÃ¶r AI-coach, veckorapporter, avvikelsevarningar, ekonomiverktyg och klÃ¤ckningskalender. 19 kr/mÃ¥n eller 149 kr/Ã¥r â€“ avsluta nÃ¤r du vill.',
    path: '/app/premium',
    ogType: 'website',
    ogImage: '/og-image.jpg',
    ogImageAlt: 'HÃ¶nsgÃ¥rden Plus â€“ AI och ekonomi fÃ¶r hÃ¶nsgÃ¥rdar',
    noindex: true,
    jsonLd: premiumJsonLd,
  });

  useEffect(() => {
    if (searchParams.get('success') !== 'true') return;
    let cancelled = false;
    const pollSubscription = async () => {
      // 30 fÃ¶rsÃ¶k Ã— 2s = 60 sekunder. Apple Pay tar ofta lÃ¤ngre tid Ã¤n kort.
      for (let attempt = 1; attempt <= 30; attempt++) {
        if (cancelled) return;
        try {
          const { data, error } = await supabase.functions.invoke('check-subscription');
          if (!error && data?.subscribed) {
            await refreshSubscription();
            toast({
              title: 'VÃ¤lkommen till Premium! ðŸŽ‰',
              description: 'Nu har du AI, insikter och ekonomiverktygen.',
            });
            window.location.replace('/app/premium');
            return;
          }
        } catch (err) {
          console.warn('[Premium] check-subscription polling fel, fÃ¶rsÃ¶ker igen:', err);
        }
        if (attempt < 30) await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled)
        toast({
          title: 'Betalningen behandlas fortfarande',
          description:
            'Apple Pay kan ta upp till nÃ¥gon minut. Tryck "Synka premiumstatus" om sidan inte uppdateras automatiskt â€” eller ladda om appen om en stund.',
        });
    };
    pollSubscription();
    return () => { cancelled = true; };
  }, [searchParams, refreshSubscription]);

  const handleSyncPremium = async () => {
    setSyncing(true);
    try {
      await refreshSubscription();
      toast({ title: 'Premiumstatus kontrollerad âœ…', description: 'Vi har synkat din prenumeration mot betalningssystemet.' });
    } catch (err: any) {
      toast({ title: 'Kunde inte synka just nu', description: err?.message || 'FÃ¶rsÃ¶k igen om en stund.', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: 'NÃ¥got gick fel', description: err.message || 'Kunde inte Ã¶ppna kundportalen.', variant: 'destructive' });
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleCheckout = async (plan: "monthly" | "yearly") => {
    if (!user) {
      toast({
        title: "Logga in fÃ¶rst",
        description: "Du behÃ¶ver vara inloggad fÃ¶r att uppgradera.",
        variant: "destructive",
      });
      return;
    }

    setLoadingPlan(plan);

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan },
      });

      if (data?.error === "already_subscribed" && data?.portal_url) {
        toast({
          title: "Du har redan en aktiv prenumeration",
          description: "Vi Ã¶ppnar kundportalen dÃ¤r du kan hantera den.",
        });
        window.location.href = data.portal_url;
        return;
      }

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.message || data.error);
      if (!data?.url) throw new Error("Ingen checkout-URL returnerades");

      window.location.href = data.url;
    } catch (err: any) {
      toast({
        title: "Kunde inte starta betalning",
        description: err.message || "NÃ¥got gick fel.",
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-7 animate-fade-in pb-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/12 via-card to-accent/8 border border-primary/20 p-6 sm:p-10 text-center shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.10),transparent_70%)]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-primary/15 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Sparkles className="h-4 w-4" />
            Premium med AI, insikter och ekonomi
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif text-foreground mb-3 leading-tight">
            GÃ¶r HÃ¶nsgÃ¥rden till din smarta gÃ¥rdsassistent
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto mb-5 leading-relaxed">
            Gratis hjÃ¤lper dig komma igÃ¥ng. Premium hjÃ¤lper dig fÃ¶rstÃ¥ flocken, fÃ¥ AI-rÃ¥d, hÃ¥lla koll pÃ¥ foderkostnad, sÃ¤lja Ã¤gg och veta vad som Ã¤r nÃ¤sta bÃ¤sta steg.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            {!isPremium && (
              <div className="inline-flex items-center gap-2 bg-success/15 text-success-foreground border border-success/25 px-4 py-2 rounded-full text-sm font-medium">
                Premium hjÃ¤lper dig fÃ¥ mer nytta av dina loggar
              </div>
            )}
            <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={handleSyncPremium} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Synka premiumstatus
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/[0.04] shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0"><Bot className="h-5 w-5 text-primary" /></div>
            <div>
              <h2 className="font-serif text-lg text-foreground mb-1">Det hÃ¤r Ã¤r intÃ¤ktsmotorn</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Gratis ska skapa vanan: logga Ã¤gg och lÃ¤gg till hÃ¶nor. Premium ska skapa vÃ¤rdet: AI-rÃ¥d, insikter, ekonomi, foderkostnad, sÃ¤lj Ã¤gg och bÃ¤ttre beslut. Det Ã¤r dÃ¤r HÃ¶nsgÃ¥rden blir svÃ¥r att vara utan.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {valuePillars.map((pillar) => (
          <Card key={pillar.title} className="border-border/60 shadow-sm bg-card">
            <CardContent className="p-5">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <pillar.icon className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-serif text-lg text-foreground mb-2">{pillar.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{pillar.desc}</p>
              <ul className="space-y-2">
                {pillar.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-xs text-foreground"><Check className="h-3.5 w-3.5 text-primary" />{b}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6">
            <h3 className="font-serif text-lg text-foreground mb-1">Gratis</h3>
            <p className="text-muted-foreground text-sm mb-5">Bra fÃ¶r att skapa vanan</p>
            <div className="mb-2"><span className="text-4xl font-bold text-foreground">0</span><span className="text-lg text-muted-foreground ml-1">kr</span></div>
            <p className="text-xs text-muted-foreground mb-4">Ingen tidsgrÃ¤ns</p>
            <ul className="space-y-2.5 mb-6">
              {freeFeatures.map((f) => <li key={f} className="flex items-center gap-2 text-sm text-foreground"><Check className="h-4 w-4 text-primary shrink-0" />{f}</li>)}
            </ul>
            <Button variant="outline" className="w-full h-11" disabled>{isPremium ? 'Gratis finns kvar' : 'Din nuvarande plan'}</Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <h3 className="font-serif text-lg text-foreground mb-1">Plus â€“ MÃ¥nad</h3>
            <p className="text-muted-foreground text-sm mb-5">FÃ¶r dig som vill testa allt</p>
            <div className="mb-2"><span className="text-4xl font-bold text-foreground">19</span><span className="text-lg text-muted-foreground ml-1">kr/mÃ¥n</span></div>
            <p className="text-xs text-primary font-medium mb-4">Premium hjälper dig få mer nytta av dina loggar</p>
            <ul className="space-y-2.5 mb-6">
              {premiumFeatures.slice(0, 6).map((f) => <li key={f.text} className="flex items-center gap-2 text-sm text-foreground"><Check className="h-4 w-4 text-primary shrink-0" />{f.text}</li>)}
              <li className="text-xs text-muted-foreground pl-6">+ allt i Gratis</li>
            </ul>
            <Button variant="outline" className="w-full h-11 gap-2 active:scale-95 transition-transform" onClick={() => handleCheckout("monthly")} disabled={!!loadingPlan || isPremium}>
              {loadingPlan === 'monthly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {isPremium ? 'Du har redan Plus' : 'Prova mÃ¥nadsvis'}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-2 border-primary shadow-lg relative overflow-hidden hover:shadow-xl transition-shadow">
          <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-xs font-semibold py-1.5 text-center tracking-wide uppercase">BÃ¤st vÃ¤rde â€“ spara 35%</div>
          <CardContent className="p-6 pt-10">
            <h3 className="font-serif text-lg text-foreground mb-1">Plus â€“ Ã…r</h3>
            <p className="text-muted-foreground text-sm mb-5">FÃ¶r dig som vill bygga lÃ¥ngsiktig koll</p>
            <div className="mb-2"><span className="text-4xl font-bold text-foreground">149</span><span className="text-lg text-muted-foreground ml-1">kr/Ã¥r</span></div>
            <p className="text-xs text-muted-foreground mb-4"><span className="line-through">228 kr</span> â†’ ungefÃ¤r 12 kr/mÃ¥n</p>
            <ul className="space-y-2.5 mb-6">
              {premiumFeatures.slice(0, 6).map((f) => <li key={f.text} className="flex items-center gap-2 text-sm text-foreground"><Check className="h-4 w-4 text-primary shrink-0" />{f.text}</li>)}
              <li className="text-xs text-muted-foreground pl-6">+ allt i Gratis</li>
            </ul>
            <Button className="w-full h-12 gap-2 active:scale-95 transition-transform text-base font-semibold shadow-[0_4px_14px_0_hsl(var(--primary)/0.3)]" onClick={() => handleCheckout("yearly")} disabled={!!loadingPlan || isPremium}>
              {loadingPlan === 'yearly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              {isPremium ? 'Du har redan Plus' : 'VÃ¤lj Ã¥rsplan â€“ 149 kr'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="font-serif text-xl sm:text-2xl text-foreground text-center mb-5">Allt som ingÃ¥r i Plus</h2>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {premiumFeatures.map((f) => <div key={f.text} className="flex items-center gap-3 py-1.5"><span className="text-base shrink-0">{f.icon}</span><span className="text-sm text-foreground">{f.text}</span></div>)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {highlights.map((f) => (
          <Card key={f.title} className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><f.icon className="h-4 w-4 text-primary" /></div>
              <div><h3 className="font-medium text-foreground text-sm">{f.title}</h3><p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="font-serif text-xl text-foreground text-center mb-4">SÃ¥ beskriver hÃ¶nsÃ¤gare vÃ¤rdet</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {testimonials.map((t) => (
            <Card key={t.name} className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-0.5 mb-2">{[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-warning text-warning" />)}</div>
                <p className="text-xs text-foreground italic mb-2">"{t.text}"</p>
                <p className="text-[10px] text-muted-foreground font-medium">{t.name}, {t.location}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="bg-primary/5 border-primary/15">
        <CardContent className="p-5 sm:p-6 text-center">
          <HeartHandshake className="h-6 w-6 text-primary mx-auto mb-2" />
          <h3 className="font-serif text-lg text-foreground mb-2">Ingen bindningstid</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">Avbryt nÃ¤r du vill. Inga dolda avgifter. Dina data finns kvar om du gÃ¥r tillbaka till gratis.</p>
        </CardContent>
      </Card>

      {isPremium && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 shadow-sm">
          <CardContent className="p-5 sm:p-6 text-center space-y-3">
            <div className="inline-flex items-center gap-2 text-foreground font-semibold text-lg"><Crown className="h-5 w-5 text-warning" />Du har Premium!</div>
            {user?.subscription_end && <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" /><span>Betald t.o.m. <span className="font-medium text-foreground">{format(new Date(user.subscription_end), 'd MMMM yyyy', { locale: sv })}</span></span></div>}
            <p className="text-sm text-muted-foreground">Hantera din prenumeration, byt betalmetod eller avsluta.</p>
            <Button variant="outline" className="gap-2" onClick={handleManageSubscription} disabled={loadingPortal}>{loadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}Hantera prenumeration</Button>
          </CardContent>
        </Card>
      )}

      {!isPremium && (
        <div className="text-center pb-4">
          <Button size="lg" className="h-12 px-10 text-base gap-2 active:scale-95 transition-transform shadow-[0_4px_14px_0_hsl(var(--primary)/0.3)]" onClick={() => handleCheckout("yearly")} disabled={!!loadingPlan}>
            {loadingPlan === 'yearly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}BÃ¶rja med Plus â€“ 149 kr/Ã¥r
          </Button>
          <p className="text-xs text-muted-foreground mt-3">FrÃ¥gor? <a href="mailto:info@auroramedia.se" className="text-primary hover:underline">info@auroramedia.se</a></p>
        </div>
      )}
    </div>
  );
}

