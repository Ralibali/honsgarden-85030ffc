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

const PRICES = {
  monthly: 'price_1T3joGHzffTezY82dRQc7GTO',
  yearly: 'price_1T3jwRHzffTezY829aWQVXZr',
};

const valuePillars = [
  {
    icon: Bot,
    title: 'AI som förstår hönsgården',
    desc: 'Få råd, veckorapporter och avvikelsevarningar som bygger på dina egna loggar – inte generiska tips.',
    bullets: ['AI-coach på dashboarden', 'AI-veckorapport', 'Avvikelsevarningar'],
  },
  {
    icon: Calculator,
    title: 'Ekonomi som går att använda',
    desc: 'Se foderkostnad, kostnad per ägg, intäkter och obetalda äggförsäljningar på ett praktiskt sätt.',
    bullets: ['Foderkostnad per ägg', 'Sälj ägg-modul', 'Export och rapporter'],
  },
  {
    icon: HeartPulse,
    title: 'Tryggare vardag',
    desc: 'Håll koll på flockens rytm, rutiner, hälsosignaler, kläckning och vad som behöver göras härnäst.',
    bullets: ['Flockhälsa-light', 'Smarta rutiner', 'Kläckningskalender'],
  },
];

const premiumFeatures = [
  { text: 'AI-hönsgårdscoach med personliga råd', icon: '🤖' },
  { text: 'AI-veckorapport och tydliga nästa steg', icon: '✨' },
  { text: 'Avvikelsevarningar när något ändras i flocken', icon: '🔎' },
  { text: 'Avancerad statistik, trender och äggmål', icon: '📊' },
  { text: 'Foderspårning och kostnad per ägg', icon: '🌾' },
  { text: 'Agdas Bod – din gårdsbutik för äggförsäljning (just nu öppet för alla)', icon: '🥚' },
  { text: 'Ekonomi, intäkter, kostnader och export', icon: '💰' },
  { text: 'Flockhälsa-light och bättre hönsprofiler', icon: '💚' },
  { text: 'Kläckningskalender med milstolpar', icon: '🐣' },
  { text: 'Smarta påminnelser och dagliga uppgifter', icon: '🔔' },
  { text: 'PDF/CSV-export och rapporter', icon: '📥' },
  { text: 'Prioriterad support och framtida premiumfunktioner', icon: '⭐' },
];

const freeFeatures = ['Äggloggning', 'Upp till 10 hönor', 'Enkel hälsologg', 'Grundstatistik', 'Dagbok', 'Mobilvänlig PWA'];

const highlights = [
  { icon: Bot, title: 'AI-råd som inte känns som en robot', desc: 'Hönsgården tolkar dina siffror och ger korta, snälla och praktiska råd.' },
  { icon: TrendingUp, title: 'Förstå varför siffrorna ändras', desc: 'Se om produktionen är uppåt, nedåt eller stabil – och vad du kan göra.' },
  { icon: ReceiptText, title: 'Agdas Bod – sälj ägg utan krångel', desc: 'Skapa säljsidor, ta emot bokningar, håll koll på lager, kunder och Swish-betalningar. Öppet för alla just nu, blir Plus-funktion framöver.' },
  { icon: Wheat, title: 'Räkna på verklig kostnad', desc: 'Se vad fodret kostar och vad varje ägg ungefär landar på.' },
  { icon: HeartPulse, title: 'Håll koll på flockens rytm', desc: 'Flockhälsa-light hjälper dig upptäcka när något är värt att observera.' },
  { icon: Bell, title: 'Få hjälp med rutinerna', desc: 'Påminnelser gör att vatten, foder, rengöring och kontroll inte glöms bort.' },
  { icon: Baby, title: 'Tryggare kläckningar', desc: 'Håll koll på dag 7, dag 14, lockdown och beräknad kläckning.' },
  { icon: Download, title: 'Ta ut dina data', desc: 'Exportera rapporter när du vill dela, spara eller bokföra.' },
];

const testimonials = [
  { name: 'Anna-Lena', location: 'Dalarna', text: 'Jag trodde jag hade koll, men först när jag såg kostnad per ägg förstod jag flocken på riktigt.' },
  { name: 'Per-Olof', location: 'Skåne', text: 'Kläckningskalendern gjorde att jag slapp dubbelkolla datum hela tiden. Det blev lugnare.' },
  { name: 'Margareta', location: 'Gotland', text: 'Påminnelserna gör störst skillnad. Nu är det inte bara jag som behöver komma ihåg allt.' },
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
    name: 'Hönsgården Plus',
    description:
      'Premiumabonnemang för Hönsgården med AI-coach, veckorapport, ekonomi och avancerade insikter för hönsgårdar.',
    brand: { '@type': 'Brand', name: 'Hönsgården' },
    offers: [
      {
        '@type': 'Offer',
        name: 'Hönsgården Plus – månad',
        price: '19',
        priceCurrency: 'SEK',
        availability: 'https://schema.org/InStock',
        url: 'https://honsgarden.se/app/premium',
      },
      {
        '@type': 'Offer',
        name: 'Hönsgården Plus – år',
        price: '149',
        priceCurrency: 'SEK',
        availability: 'https://schema.org/InStock',
        url: 'https://honsgarden.se/app/premium',
      },
    ],
  }), []);

  useSeo({
    title: 'Hönsgården Plus – AI-coach, ekonomi & insikter för hönsgården',
    description:
      'Uppgradera till Hönsgården Plus för AI-coach, veckorapporter, avvikelsevarningar, ekonomiverktyg och kläckningskalender. 19 kr/mån eller 149 kr/år – avsluta när du vill.',
    path: '/app/premium',
    ogType: 'website',
    ogImage: '/og-image.jpg',
    ogImageAlt: 'Hönsgården Plus – AI och ekonomi för hönsgårdar',
    noindex: true,
    jsonLd: premiumJsonLd,
  });

  useEffect(() => {
    if (searchParams.get('success') !== 'true') return;
    let cancelled = false;
    const pollSubscription = async () => {
      for (let attempt = 1; attempt <= 10; attempt++) {
        if (cancelled) return;
        try {
          const { data, error } = await supabase.functions.invoke('check-subscription');
          if (!error && data?.subscribed) {
            await refreshSubscription();
            toast({ title: 'Välkommen till Premium! 🎉', description: 'Nu har du AI, insikter och ekonomiverktygen för bättre koll på flocken.' });
            window.location.replace('/app/premium');
            return;
          }
        } catch (err) {
          console.warn('[Premium] check-subscription polling fel, försöker igen:', err);
        }
        if (attempt < 10) await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) toast({ title: 'Betalningen behandlas', description: 'Det kan ta en liten stund. Tryck på Synka premiumstatus om sidan inte uppdateras.' });
    };
    pollSubscription();
    return () => { cancelled = true; };
  }, [searchParams, refreshSubscription]);

  const handleSyncPremium = async () => {
    setSyncing(true);
    try {
      await refreshSubscription();
      toast({ title: 'Premiumstatus kontrollerad ✅', description: 'Vi har synkat din prenumeration mot betalningssystemet.' });
    } catch (err: any) {
      toast({ title: 'Kunde inte synka just nu', description: err?.message || 'Försök igen om en stund.', variant: 'destructive' });
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
      toast({ title: 'Något gick fel', description: err.message || 'Kunde inte öppna kundportalen.', variant: 'destructive' });
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleCheckout = async (priceId: string, planName: string) => {
    if (!user) {
      toast({ title: 'Logga in först', description: 'Du behöver vara inloggad för att uppgradera.', variant: 'destructive' });
      return;
    }
    setLoadingPlan(planName);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', { body: { priceId } });
      if (data?.error === 'already_subscribed' && data?.portal_url) {
        toast({ title: 'Du har redan en aktiv prenumeration', description: 'Vi öppnar kundportalen där du kan hantera den.' });
        window.location.href = data.portal_url;
        return;
      }
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.message || data.error);
      if (data?.url) window.location.href = data.url;
      else throw new Error('Ingen checkout-URL returnerades');
    } catch (err: any) {
      toast({ title: 'Kunde inte starta betalning', description: err.message || 'Något gick fel.', variant: 'destructive' });
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
            Gör Hönsgården till din smarta gårdsassistent
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto mb-5 leading-relaxed">
            Gratis hjälper dig komma igång. Premium hjälper dig förstå flocken, få AI-råd, hålla koll på foderkostnad, sälja ägg och veta vad som är nästa bästa steg.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            {!isPremium && (
              <div className="inline-flex items-center gap-2 bg-success/15 text-success-foreground border border-success/25 px-4 py-2 rounded-full text-sm font-medium">
                🎁 Sju dagars gratis provperiod – känn efter i din egen hönsgård
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
              <h2 className="font-serif text-lg text-foreground mb-1">Det här är intäktsmotorn</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Gratis ska skapa vanan: logga ägg och lägg till hönor. Premium ska skapa värdet: AI-råd, insikter, ekonomi, foderkostnad, sälj ägg och bättre beslut. Det är där Hönsgården blir svår att vara utan.
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
            <p className="text-muted-foreground text-sm mb-5">Bra för att skapa vanan</p>
            <div className="mb-2"><span className="text-4xl font-bold text-foreground">0</span><span className="text-lg text-muted-foreground ml-1">kr</span></div>
            <p className="text-xs text-muted-foreground mb-4">Ingen tidsgräns</p>
            <ul className="space-y-2.5 mb-6">
              {freeFeatures.map((f) => <li key={f} className="flex items-center gap-2 text-sm text-foreground"><Check className="h-4 w-4 text-primary shrink-0" />{f}</li>)}
            </ul>
            <Button variant="outline" className="w-full h-11" disabled>{isPremium ? 'Gratis finns kvar' : 'Din nuvarande plan'}</Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <h3 className="font-serif text-lg text-foreground mb-1">Plus – Månad</h3>
            <p className="text-muted-foreground text-sm mb-5">För dig som vill testa allt</p>
            <div className="mb-2"><span className="text-4xl font-bold text-foreground">19</span><span className="text-lg text-muted-foreground ml-1">kr/mån</span></div>
            <p className="text-xs text-primary font-medium mb-4">Sju dagars gratis provperiod</p>
            <ul className="space-y-2.5 mb-6">
              {premiumFeatures.slice(0, 6).map((f) => <li key={f.text} className="flex items-center gap-2 text-sm text-foreground"><Check className="h-4 w-4 text-primary shrink-0" />{f.text}</li>)}
              <li className="text-xs text-muted-foreground pl-6">+ allt i Gratis</li>
            </ul>
            <Button variant="outline" className="w-full h-11 gap-2 active:scale-95 transition-transform" onClick={() => handleCheckout(PRICES.monthly, 'monthly')} disabled={!!loadingPlan || isPremium}>
              {loadingPlan === 'monthly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {isPremium ? 'Du har redan Plus' : 'Prova månadsvis'}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-2 border-primary shadow-lg relative overflow-hidden hover:shadow-xl transition-shadow">
          <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-xs font-semibold py-1.5 text-center tracking-wide uppercase">Bäst värde – spara 35%</div>
          <CardContent className="p-6 pt-10">
            <h3 className="font-serif text-lg text-foreground mb-1">Plus – År</h3>
            <p className="text-muted-foreground text-sm mb-5">För dig som vill bygga långsiktig koll</p>
            <div className="mb-2"><span className="text-4xl font-bold text-foreground">149</span><span className="text-lg text-muted-foreground ml-1">kr/år</span></div>
            <p className="text-xs text-muted-foreground mb-4"><span className="line-through">228 kr</span> → ungefär 12 kr/mån</p>
            <ul className="space-y-2.5 mb-6">
              {premiumFeatures.slice(0, 6).map((f) => <li key={f.text} className="flex items-center gap-2 text-sm text-foreground"><Check className="h-4 w-4 text-primary shrink-0" />{f.text}</li>)}
              <li className="text-xs text-muted-foreground pl-6">+ allt i Gratis</li>
            </ul>
            <Button className="w-full h-12 gap-2 active:scale-95 transition-transform text-base font-semibold shadow-[0_4px_14px_0_hsl(var(--primary)/0.3)]" onClick={() => handleCheckout(PRICES.yearly, 'yearly')} disabled={!!loadingPlan || isPremium}>
              {loadingPlan === 'yearly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              {isPremium ? 'Du har redan Plus' : 'Välj årsplan – 149 kr'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="font-serif text-xl sm:text-2xl text-foreground text-center mb-5">Allt som ingår i Plus</h2>
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
        <h2 className="font-serif text-xl text-foreground text-center mb-4">Så beskriver hönsägare värdet</h2>
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
          <p className="text-sm text-muted-foreground max-w-md mx-auto">Avbryt när du vill. Inga dolda avgifter. Dina data finns kvar om du går tillbaka till gratis.</p>
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
          <Button size="lg" className="h-12 px-10 text-base gap-2 active:scale-95 transition-transform shadow-[0_4px_14px_0_hsl(var(--primary)/0.3)]" onClick={() => handleCheckout(PRICES.yearly, 'yearly')} disabled={!!loadingPlan}>
            {loadingPlan === 'yearly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}Börja med Plus – 149 kr/år
          </Button>
          <p className="text-xs text-muted-foreground mt-3">Frågor? <a href="mailto:info@auroramedia.se" className="text-primary hover:underline">info@auroramedia.se</a></p>
        </div>
      )}
    </div>
  );
}
