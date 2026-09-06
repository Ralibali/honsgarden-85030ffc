import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot, Crown, Loader2, ShieldCheck, Sparkles, RefreshCcw, MessageCircle, FileText, Coins, BellRing, CalendarDays, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSeo } from '@/hooks/useSeo';
import { trackClick } from '@/hooks/useTracking';
import { brandName, isInternationalDomain } from '@/lib/brand';
import { isLegacyPriceId } from '@/lib/legacyPricing';
import { trackEvent, parseAnalyticsSource } from '@/lib/analytics';
import { getPremiumEntryState } from '@/lib/premiumEntry';
import { isNativeIos } from '@/lib/nativePlatform';
import {
  isIosBillingAvailable,
  loadStoreKitProducts,
  openAppStoreSubscriptions,
  purchaseStoreKitPlan,
  restoreStoreKitTransactions,
  syncAppleTransactions,
  type StoreKitProduct,
} from '@/lib/appleIapClient';
import PremiumValueStats from '@/components/premium/PremiumValueStats';

type BillingPlan = 'monthly' | 'yearly';

// Ikoner för Plus-funktionerna (i samma ordning som i locale-filerna)
const FEATURE_ICONS = [Bot, FileText, Coins, BellRing, CalendarDays, BarChart3];

export default function Premium() {
  const { t, i18n } = useTranslation('premium');
  const { user, refreshSubscription } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<BillingPlan | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [iosProducts, setIosProducts] = useState<StoreKitProduct[]>([]);
  const [iosProductsReady, setIosProductsReady] = useState(!isNativeIos());
  const nativeIos = isNativeIos();
  const [searchParams] = useSearchParams();
  const entrySource = parseAnalyticsSource(searchParams.get('source'), 'premium_page');
  const premiumType = user?.premium_type;
  const {
    isPaidPremium,
    isTrialing,
    showFreeTrialCta,
    showTrialStatus,
    showManageSubscription,
    allowPaidCheckout,
    trialDaysLeft,
  } = getPremiumEntryState({
    premiumType,
    subscriptionEnd: user?.subscription_end,
  });
  const intl = isInternationalDomain();
  const lang = (i18n.language || 'sv').startsWith('en') ? 'en' : 'sv';
  const brand = brandName();

  const premiumFeatures = (t('features.items', { returnObjects: true }) as string[]) || [];

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
      name: t('plans.yearly.name'),
      price: t('plans.yearly.price'),
      period: t('plans.yearly.period'),
      description: t('plans.yearly.description'),
      badge: t('plans.yearly.badge'),
      highlighted: true,
      subPrice: t('plans.yearly.sub_price'),
    },
    {
      id: 'monthly',
      name: t('plans.monthly.name'),
      price: t('plans.monthly.price'),
      period: t('plans.monthly.period'),
      description: t('plans.monthly.description'),
      subPrice: t('plans.monthly.sub_price'),
    },
  ];

  const premiumJsonLd = useMemo(() => {
    const currency = lang === 'en' ? 'USD' : 'SEK';
    const monthlyPrice = lang === 'en' ? '3.99' : '39';
    const yearlyPrice = lang === 'en' ? '29.99' : '299';
    return {
      '@type': 'Product',
      name: `${brand} Plus`,
      description: t('seo.description'),
      brand: { '@type': 'Brand', name: brand },
      offers: [
        {
          '@type': 'Offer',
          name: `${brand} Plus – ${t('plans.monthly.name')}`,
          price: monthlyPrice,
          priceCurrency: currency,
          availability: 'https://schema.org/InStock',
          url: 'https://honsgarden.se/app/premium',
        },
        {
          '@type': 'Offer',
          name: `${brand} Plus – ${t('plans.yearly.name')}`,
          price: yearlyPrice,
          priceCurrency: currency,
          availability: 'https://schema.org/InStock',
          url: 'https://honsgarden.se/app/premium',
        },
      ],
    };
  }, [brand, lang, t]);

  useSeo({
    title: t('seo.title'),
    description: t('seo.description'),
    path: '/app/premium',
    ogType: 'website',
    ogImage: '/og-image.jpg',
    ogImageAlt: t('seo.og_image_alt'),
    noindex: true,
    jsonLd: premiumJsonLd,
  });

  useEffect(() => {
    trackClick('premium_page_view');
    trackEvent('Premium Viewed', { source: entrySource });
  }, [entrySource]);

  useEffect(() => {
    if (!nativeIos) return;
    let cancelled = false;
    (async () => {
      try {
        const supported = await isIosBillingAvailable();
        const products = supported ? await loadStoreKitProducts() : [];
        if (!cancelled) setIosProducts(products);
      } catch (err) {
        console.warn('[Premium] StoreKit products unavailable', err);
        if (!cancelled) setIosProducts([]);
      } finally {
        if (!cancelled) setIosProductsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nativeIos]);

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
            // Analytics: faktisk verifierad prenumeration (server-side bekräftad).
            trackEvent('Premium Purchased', {
              plan: 'plus',
              billing_interval: data?.billing_interval === 'yearly' ? 'yearly' : 'monthly',
            });
            toast({
              title: t('toasts.welcome_title'),
              description: t('toasts.welcome_desc'),
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
          title: t('toasts.still_processing_title'),
          description: t('toasts.still_processing_desc'),
        });
      }
    };

    pollSubscription();
    return () => {
      cancelled = true;
    };
  }, [searchParams, refreshSubscription, t]);

  const handleSyncPremium = async () => {
    setSyncing(true);
    try {
      await refreshSubscription();
      toast({
        title: t('toasts.sync_ok_title'),
        description: t('toasts.sync_ok_desc'),
      });
    } catch (err: any) {
      toast({
        title: t('toasts.sync_fail_title'),
        description: err?.message || t('toasts.sync_fail_desc'),
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      if (nativeIos) {
        await openAppStoreSubscriptions();
        return;
      }
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({
        title: t('toasts.portal_error_title'),
        description: err.message || t('toasts.portal_error_desc'),
        variant: 'destructive',
      });
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (!nativeIos) return;
    setRestoring(true);
    try {
      const jwsList = await restoreStoreKitTransactions();
      if (jwsList.length === 0) {
        await refreshSubscription();
        toast({
          title: t('ios.restore_none_title'),
          description: t('ios.restore_none_desc'),
        });
        return;
      }
      const result = await syncAppleTransactions(jwsList);
      await refreshSubscription();
      toast({
        title: result.subscribed ? t('toasts.welcome_title') : t('ios.restore_none_title'),
        description: result.subscribed ? t('toasts.welcome_desc') : t('ios.restore_none_desc'),
      });
    } catch (err: any) {
      toast({
        title: t('ios.restore_fail_title'),
        description: err.message || t('ios.restore_fail_desc'),
        variant: 'destructive',
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleIosPurchase = async (plan: BillingPlan) => {
    if (!user) {
      toast({
        title: t('toasts.login_required_title'),
        description: t('toasts.login_required_desc'),
        variant: 'destructive',
      });
      return;
    }
    trackClick('checkout_start', { metadata: { plan, source: 'storekit' } });
    setLoadingPlan(plan);
    try {
      const jws = await purchaseStoreKitPlan(plan, user.id);
      const result = await syncAppleTransactions([jws]);
      await refreshSubscription();
      trackEvent('Premium Purchased', {
        plan: 'plus',
        billing_interval: plan,
      });
      toast({
        title: t('toasts.welcome_title'),
        description: result.subscribed ? t('toasts.welcome_desc') : t('ios.restore_none_desc'),
      });
    } catch (err: any) {
      const message = String(err?.message || '');
      if (/cancel|user cancelled|paymentcancelled/i.test(message)) return;
      toast({
        title: t('toasts.checkout_fail_title'),
        description: message || t('toasts.checkout_fail_desc'),
        variant: 'destructive',
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleCheckout = async (plan: BillingPlan) => {
    if (nativeIos) {
      await handleIosPurchase(plan);
      return;
    }

    if (!user) {
      toast({
        title: t('toasts.login_required_title'),
        description: t('toasts.login_required_desc'),
        variant: 'destructive',
      });
      return;
    }

    trackClick('checkout_start', { metadata: { plan } });
    setLoadingPlan(plan);
    try {
      const checkoutResult = await supabase.functions.invoke('create-checkout', {
        body: { plan },
      });
      let data = checkoutResult.data;
      const error = checkoutResult.error;

      if (error && !data && (error as any).context?.json) {
        try { data = await (error as any).context.json(); } catch { /* ignore */ }
      } else if (error && !data && (error as any).context?.text) {
        try { data = JSON.parse(await (error as any).context.text()); } catch { /* ignore */ }
      }

      if (data?.error === 'already_subscribed' && data?.portal_url) {
        toast({
          title: t('toasts.already_sub_title'),
          description: t('toasts.already_sub_desc'),
        });
        window.location.href = data.portal_url;
        return;
      }

      if (data?.error) throw new Error(data.message || data.error);
      if (error) throw new Error(error.message);
      if (data?.url) {
        // Analytics: efter faktiskt lyckad checkout-session (URL genererad), precis innan redirect.
        trackEvent('Premium Checkout Started', {
          plan: 'plus',
          billing_interval: plan,
          source: entrySource,
        });
        window.location.href = data.url;
      } else throw new Error(t('toasts.no_checkout_url'));
    } catch (err: any) {
      toast({
        title: t('toasts.checkout_fail_title'),
        description: err.message || t('toasts.checkout_fail_desc'),
        variant: 'destructive',
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-7 animate-fade-in pb-8">
      <section className="relative overflow-hidden rounded-3xl border border-primary/25 p-6 sm:p-12 text-center bg-gradient-to-br from-primary/15 via-card to-accent/10 shadow-[0_24px_60px_-24px_hsl(var(--primary)/0.4)]">
        {/* Levande glöd bakom innehållet */}
        <motion.div
          className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-accent/25 blur-3xl"
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.6, 0.4, 0.6] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative">
          {/* Krona med pulserande glöd */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center"
          >
            <motion.div
              className="absolute inset-0 rounded-3xl bg-primary/30"
              animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
            />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-primary/75 shadow-lg shadow-primary/30">
              <Crown className="h-8 w-8 text-primary-foreground" />
            </div>
          </motion.div>

          <div className="inline-flex items-center gap-2 bg-primary/15 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Sparkles className="h-4 w-4" />
            {t('hero.badge')}
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif text-foreground mb-5 leading-tight">
            {t('hero.title', { brand })}
          </h1>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            {showFreeTrialCta && (
              <div className="inline-flex items-center gap-2 bg-success/15 text-success-foreground border border-success/25 px-4 py-2 rounded-full text-sm font-medium">
                {t('hero.free_trial')}
              </div>
            )}
            {showTrialStatus && (
              <div className="inline-flex items-center gap-2 bg-primary/15 text-primary border border-primary/25 px-4 py-2 rounded-full text-sm font-medium">
                {trialDaysLeft === null
                  ? t('hero.trial_status')
                  : t('hero.trial_status_days', { count: trialDaysLeft })}
              </div>
            )}
            <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={handleSyncPremium} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {t('hero.sync_status')}
            </Button>
            {nativeIos && (
              <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={handleRestorePurchases} disabled={restoring}>
                {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                {t('ios.restore')}
              </Button>
            )}
          </div>
        </div>
      </section>

      {showManageSubscription && (
        <Card className="border-primary/25 bg-primary/[0.04]">
          <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl text-foreground">
                {isTrialing ? t('trial.title') : t('active.title')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isTrialing
                  ? trialDaysLeft === null
                    ? t('trial.subtitle')
                    : t('trial.subtitle_days', { count: trialDaysLeft })
                  : t('active.subtitle')}
              </p>
            </div>
            {isTrialing ? <Button asChild className="rounded-xl"><Link to="/app/statistics">{t('trial.explore')}</Link></Button> : <Button onClick={handleManageSubscription} disabled={loadingPortal} className="rounded-xl">
              {loadingPortal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {nativeIos ? t('ios.manage_appstore') : t('active.manage')}
            </Button>}
          </CardContent>
        </Card>
      )}

      {/* Personligt värdebevis: användarens egen uppbyggda data */}
      {allowPaidCheckout && user && <PremiumValueStats />}

      {showFreeTrialCta && !intl && (
        <p className="text-center text-xs text-muted-foreground -mb-2">
          {t('social_proof')}
        </p>
      )}

      {nativeIos && iosProductsReady && iosProducts.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {t('ios.products_unavailable')}
        </p>
      )}

      <section className="grid md:grid-cols-2 gap-4 items-stretch">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 + i * 0.12 }}
            whileHover={{ y: -4 }}
            className="h-full"
          >
          <Card
            className={`relative h-full overflow-hidden shadow-sm transition-shadow hover:shadow-xl ${
              plan.highlighted
                ? 'border-2 border-primary shadow-[0_8px_30px_-10px_hsl(var(--primary)/0.35)] md:scale-[1.02] bg-primary/[0.03]'
                : 'border-primary/20 opacity-95'
            }`}
          >
            {plan.highlighted && (
              <motion.div
                className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                animate={{ x: ['-120%', '260%'] }}
                transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 4.5, ease: 'easeInOut' }}
              />
            )}
            {plan.badge && (
              <div className="absolute right-4 top-4 rounded-full bg-gradient-to-r from-primary to-primary/80 px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
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

              <div>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold text-foreground">{nativeIos ? (iosProducts.find((p) => p.plan === plan.id)?.priceString ?? '—') : plan.price}</span>
                  <span className="pb-1 text-muted-foreground">{plan.period}</span>
                </div>
                {plan.subPrice && !nativeIos && (
                  <p className="text-xs text-muted-foreground mt-1">{plan.subPrice}</p>
                )}
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">{t(plan.id === 'yearly' ? 'plans.yearly.billing' : 'plans.monthly.billing')}</p>

              {!(nativeIos && iosProductsReady && iosProducts.length === 0) && (
              <Button
                className="w-full rounded-xl"
                variant={plan.highlighted ? 'default' : 'outline'}
                onClick={() => handleCheckout(plan.id)}
                disabled={loadingPlan !== null || !allowPaidCheckout || (nativeIos && !iosProducts.some((p) => p.plan === plan.id))}
              >
                {loadingPlan === plan.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!allowPaidCheckout ? t('plans.active_label') : (plan.id === 'monthly' ? t('plans.monthly.cta') : t('plans.yearly.cta'))}
              </Button>
              )}
            </CardContent>
          </Card>
          </motion.div>
        ))}
      </section>

      {/* Förtroenderad – tar bort sista riskkänslan före köp */}
      {showFreeTrialCta && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" />{nativeIos ? t('ios.trust_appstore') : t('trust.stripe')}</span>
          <span className="flex items-center gap-1.5"><RefreshCcw className="h-3.5 w-3.5 text-primary" />{t('trust.cancel')}</span>
          <span className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-primary" />{t('trust.support')}</span>
        </motion.div>
      )}

      {isPaidPremium && isLegacyPriceId(user?.stripe_price_id) && (
        <p className="text-center text-sm text-muted-foreground -mt-1">
          <Sparkles className="inline h-4 w-4 mr-1 text-primary" />
          {t('plans.legacy_notice')}
        </p>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-serif text-2xl text-foreground">{t('features.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('features.subtitle')}</p>
            </div>
          </div>

          <motion.div
            className="grid sm:grid-cols-2 gap-3"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            variants={{ show: { transition: { staggerChildren: 0.06 } } }}
          >
            {premiumFeatures.map((feature, i) => {
              const FeatureIcon = FEATURE_ICONS[i % FEATURE_ICONS.length];
              return (
                <motion.div
                  key={feature}
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/60 p-3.5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <FeatureIcon className="h-4 w-4 text-primary" />
                  </span>
                  <span className="text-sm text-foreground/90 leading-snug pt-1">{feature}</span>
                </motion.div>
              );
            })}
          </motion.div>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-muted-foreground space-y-2">
        <p>{t('free_reassurance')}</p>
        <p className="flex justify-center gap-5"><Link to="/terms" className="underline min-h-11 inline-flex items-center">{t('terms_link')}</Link><Link to="/integritet" className="underline min-h-11 inline-flex items-center">{t('privacy_link')}</Link></p>
      </div>

      {showFreeTrialCta && (!nativeIos || iosProducts.some((product) => product.plan === 'yearly')) && (
        <StickyMobileUpgradeCTA
          label={nativeIos ? `${t('plans.yearly.cta')} · ${iosProducts.find((p) => p.plan === 'yearly')?.priceString ?? ''} ${t('plans.yearly.period')}` : t('sticky_cta')}
          onClick={() => handleCheckout('yearly')}
          loading={loadingPlan !== null}
        />
      )}
    </div>
  );
}

function StickyMobileUpgradeCTA({ onClick, loading, label }: { onClick: () => void; loading: boolean; label: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.6);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!visible) return null;
  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 md:hidden px-4">
      <Button
        onClick={onClick}
        disabled={loading}
        className="w-full h-12 text-base font-semibold rounded-2xl shadow-[0_8px_30px_-4px_hsl(var(--primary)/0.5)]"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        {label}
      </Button>
    </div>
  );
}
