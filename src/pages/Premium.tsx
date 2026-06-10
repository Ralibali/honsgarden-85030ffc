import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, Check, Crown, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSeo } from '@/hooks/useSeo';

type BillingPlan = 'monthly' | 'yearly';

const premiumFeatures = [
  'Agda AI-coachen — personliga råd om just dina hönor',
  'Veckorapport varje söndag med tydliga nästa steg',
  'Vet vad varje ägg kostar — foder, ekonomi och export',
  'Larm när något avviker i flocken, innan det blir ett problem',
  'Kläckningskalender som håller koll på alla 21 dagarna',
  'Full statistik, äggmål, PDF/CSV och alla framtida funktioner',
];

const plans: Array<{
  id: BillingPlan;
  name: string;
  price: string;
  period: string;
  description: string;
  subPrice?: string;
  badge?: string;
  highlighted?: boolean;
}> = [
  {
    id: 'yearly',
    name: 'Plus årsvis',
    price: '149 kr',
    period: '/ år',
    description: 'Spara 79 kr — motsvarar 12,40 kr/mån',
    badge: 'Bäst värde',
    highlighted: true,
  },
  {
    id: 'monthly',
    name: 'Plus månadsvis',
    price: '19 kr',
    period: '/ månad',
    description: 'Flexibelt abonnemang. Avsluta när du vill.',
    subPrice: '= mindre än en kartong ägg',
  },
];

export default function Premium() {
  const { user, refreshSubscription } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<BillingPlan | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchParams] = useSearchParams();
  const premiumType = user?.premium_type;
  const isPaidPremium = premiumType === 'paid' || premiumType === 'lifetime';
  // Visa "Premium aktivt" endast för betalande/lifetime – trialanvändare ska kunna teckna Plus
  const isPremium = isPaidPremium;
  const isTrial = premiumType === 'trial';

  const premiumJsonLd = useMemo(() => ({
    '@type': 'Product',
    name: 'Hönsgården Plus',
    description: 'Premiumabonnemang för Hönsgården med AI-coach, veckorapport, ekonomi och avancerade insikter för hönsgårdar.',
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
    description: 'Uppgradera till Hönsgården Plus för AI-coach, veckorapporter, avvikelsevarningar, ekonomiverktyg och kläckningskalender. 19 kr/mån eller 149 kr/år – avsluta när du vill.',
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
      for (let attempt = 1; attempt <= 30; attempt += 1) {
        if (cancelled) return;

        try {
          const { data, error } = await supabase.functions.invoke('check-subscription');
          if (!error && data?.subscribed) {
            await refreshSubscription();
            toast({
              title: 'Välkommen till Premium! 🎉',
              description: 'Nu har du AI, insikter och ekonomiverktygen.',
            });
            window.location.replace('/app/premium');
            return;
          }
        } catch (err) {
          console.warn('[Premium] check-subscription polling fel, försöker igen:', err);
        }

        if (attempt < 30) await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (!cancelled) {
        toast({
          title: 'Betalningen behandlas fortfarande',
          description: 'Apple Pay och vissa kortbetalningar kan ta någon minut. Tryck på Synka premiumstatus om sidan inte uppdateras automatiskt.',
        });
      }
    };

    pollSubscription();
    return () => {
      cancelled = true;
    };
  }, [searchParams, refreshSubscription]);

  const handleSyncPremium = async () => {
    setSyncing(true);
    try {
      await refreshSubscription();
      toast({
        title: 'Premiumstatus kontrollerad ✅',
        description: 'Vi har synkat din prenumeration mot betalningssystemet.',
      });
    } catch (err: any) {
      toast({
        title: 'Kunde inte synka just nu',
        description: err?.message || 'Försök igen om en stund.',
        variant: 'destructive',
      });
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
      toast({
        title: 'Något gick fel',
        description: err.message || 'Kunde inte öppna kundportalen.',
        variant: 'destructive',
      });
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleCheckout = async (plan: BillingPlan) => {
    if (!user) {
      toast({
        title: 'Logga in först',
        description: 'Du behöver vara inloggad för att uppgradera.',
        variant: 'destructive',
      });
      return;
    }

    setLoadingPlan(plan);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan },
      });

      if (data?.error === 'already_subscribed' && data?.portal_url) {
        toast({
          title: 'Du har redan en aktiv prenumeration',
          description: 'Vi öppnar kundportalen där du kan hantera den.',
        });
        window.location.href = data.portal_url;
        return;
      }

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.message || data.error);
      if (data?.url) window.location.href = data.url;
      else throw new Error('Ingen checkout-URL returnerades');
    } catch (err: any) {
      toast({
        title: 'Kunde inte starta betalning',
        description: err.message || 'Något gick fel.',
        variant: 'destructive',
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-7 animate-fade-in pb-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/12 via-card to-accent/8 border border-primary/20 p-6 sm:p-10 text-center shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.10),transparent_70%)]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-primary/15 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Sparkles className="h-4 w-4" />
            Premium med AI, insikter och ekonomi
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif text-foreground mb-5 leading-tight">
            Gör Hönsgården till din smarta gårdsassistent
          </h1>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            {!isPremium && (
              <div className="inline-flex items-center gap-2 bg-success/15 text-success-foreground border border-success/25 px-4 py-2 rounded-full text-sm font-medium">
                🎁 Sju dagars gratis premium för nya användare
              </div>
            )}
            <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={handleSyncPremium} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Synka premiumstatus
            </Button>
          </div>
        </div>
      </section>

      {isPremium && (
        <Card className="border-primary/25 bg-primary/[0.04]">
          <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl text-foreground">Du har Premium aktivt</h2>
              <p className="text-sm text-muted-foreground">Hantera abonnemang, kort och kvitton via Stripe kundportal.</p>
            </div>
            <Button onClick={handleManageSubscription} disabled={loadingPortal} className="rounded-xl">
              {loadingPortal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hantera abonnemang
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="grid md:grid-cols-2 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className="relative overflow-hidden border-primary/20 shadow-sm">
            {plan.badge && (
              <div className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                {plan.badge}
              </div>
            )}
            <CardContent className="p-6 space-y-5">
              <div>
                <div className="flex items-center gap-2 text-primary mb-2">
                  <Crown className="h-5 w-5" />
                  <h2 className="font-serif text-2xl text-foreground">{plan.name}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="pb-1 text-muted-foreground">{plan.period}</span>
              </div>

              <Button className="w-full rounded-xl" onClick={() => handleCheckout(plan.id)} disabled={loadingPlan !== null || isPremium}>
                {loadingPlan === plan.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPremium ? 'Premium är aktivt' : `Välj ${plan.id === 'monthly' ? 'månadsplan' : 'årsplan'}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-serif text-2xl text-foreground">Det här ingår i Plus</h2>
              <p className="text-sm text-muted-foreground">Trial, betalande premium och lifetime hålls isär i systemet.</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {premiumFeatures.map((feature) => (
              <div key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
