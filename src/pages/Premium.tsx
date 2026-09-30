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
import { logClientError } from '@/lib/errorLogger';
import { isNativeIos, isNativeAndroid } from '@/lib/nativePlatform';
import {
  isIosBillingAvailable,
  loadStoreKitProducts,
  openAppStoreSubscriptions,
  purchaseStoreKitPlan,
  restoreStoreKitTransactions,
  syncAppleTransactions,
  type StoreKitProduct,
} from '@/lib/appleIapClient';
import { isGoogleBillingAvailable, loadGooglePlayProducts, openGooglePlaySubscriptions, purchaseGooglePlayPlan, restoreGooglePlayTransactions, syncGooglePlayTransactions, GooglePurchasePending } from '@/lib/googlePlayClient';
import PremiumValueStats from '@/components/premium/PremiumValueStats';

type BillingPlan = 'monthly' | 'yearly';
const NATIVE_PRODUCTS_TIMEOUT_MS = 20_000;

// Ikoner för Plus-funktionerna (i samma ordning som i locale-filerna)
const FEATURE_ICONS = [Bot, FileText, Coins, BellRing, CalendarDays, BarChart3];

export default function Premium() {
  const { t, i18n } = useTranslation('premium');
  const { user, refreshSubscription } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<BillingPlan | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [storeProducts, setStoreProducts] = useState<StoreKitProduct[]>([]);
  const [storeProductsReady, setStoreProductsReady] = useState(!(isNativeIos() || isNativeAndroid()));
  const [storeProductsAttempt, setStoreProductsAttempt] = useState(0);
  const nativeIos = isNativeIos();
  const nativeBilling = nativeIos || isNativeAndroid();
  const storeCopy = nativeIos ? 'ios' : 'android';
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
    if (!nativeBilling) return;
    let cancelled = false;
    setStoreProductsReady(false);
    setStoreProducts([]);
    // A stalled native request must not leave the customer waiting indefinitely.
    const timeout = window.setTimeout(() => {
      cancelled = true;
      setStoreProductsReady(true);
      console.warn('[Premium] Native store product request timed out');
    }, NATIVE_PRODUCTS_TIMEOUT_MS);
    (async () => {
      try {
        const supported = await (nativeIos ? isIosBillingAvailable() : isGoogleBillingAvailable());
        if (cancelled) return;
        const products = supported ? await (nativeIos ? loadStoreKitProducts() : loadGooglePlayProducts()) : [];
        if (!cancelled) {
          const pricedProducts = products.filter((product) => product.priceString?.trim());
          setStoreProducts(pricedProducts);
          if (pricedProducts.length < 2) console.warn('[Premium] Native store did not return all Plus prices');
        }
      } catch (err) {
        console.warn('[Premium] Native store products unavailable', err);
        if (!cancelled) setStoreProducts([]);
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setStoreProductsReady(true);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [nativeBilling, nativeIos, storeProductsAttempt]);

  useEffect(() => {
    if (searchParams.get('success') !== 'true') return;

    let cancelled = false;

    const pollSubscription = async () => {
      for (let attempt = 1; attempt <= 30; attempt += 1) {
        if (cancelled) return;

        try {
          const { data, error } = await supabase.functions.invoke('check-subscription');
          if (!error && data?.subscribed === true && data.premium_type === 'paid'
            && (!data.source || data.source === 'stripe')) {
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
      if (nativeBilling) {
        await (nativeIos ? openAppStoreSubscriptions() : openGooglePlaySubscriptions());
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
    if (!nativeBilling) return;
    setRestoring(true);
    try {
      const jwsList = await (nativeIos ? restoreStoreKitTransactions() : restoreGooglePlayTransactions());
      if (jwsList.length === 0) {
        await refreshSubscription();
        toast({
          title: t(`${storeCopy}.restore_none_title`),
          description: t(`${storeCopy}.restore_none_desc`),
        });
        return;
      }
      const result = await (nativeIos ? syncAppleTransactions(jwsList) : syncGooglePlayTransactions(jwsList));
      await refreshSubscription();
      toast({
        title: result.subscribed ? t('toasts.welcome_title') : t(`${storeCopy}.restore_none_title`),
        description: result.subscribed ? t('toasts.welcome_desc') : t(`${storeCopy}.restore_none_desc`),
      });
    } catch (err: any) {
      toast({
        title: t(`${storeCopy}.restore_fail_title`),
        description: err.message || t(`${storeCopy}.restore_fail_desc`),
        variant: 'destructive',
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleNativePurchase = async (plan: BillingPlan) => {
    if (!user) {
      toast({
        title: t('toasts.login_required_title'),
        description: t('toasts.login_required_desc'),
        variant: 'destructive',
      });
      return;
    }
    trackClick('checkout_start', { metadata: { plan, source: nativeIos ? 'storekit' : 'google_play' } });
    setLoadingPlan(plan);
    try {
      const jws = await (nativeIos ? purchaseStoreKitPlan(plan, user.id) : purchaseGooglePlayPlan(plan, user.id));
      const result = await (nativeIos ? syncAppleTransactions([jws]) : syncGooglePlayTransactions([jws]));
      await refreshSubscription();
      if (result.subscribed) trackEvent('Premium Purchased', {
        plan: 'plus',
        billing_interval: plan,
      });
      toast({
        title: result.subscribed ? t('toasts.welcome_title') : t(`${storeCopy}.restore_none_title`),
        description: result.subscribed ? t('toasts.welcome_desc') : t(`${storeCopy}.restore_none_desc`),
      });
    } catch (err: any) {
      if (err instanceof GooglePurchasePending) {
        toast({ title: t('android.pending_title'), description: t('android.pending_desc') });
        return;
      }
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
    if (nativeBilling) {
      await handleNativePurchase(plan);
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
    } catch (err: unknown) {
      void logClientError(err, { context: { source: 'plus_checkout', plan } });
      toast({
        title: t('toasts.checkout_fail_title'),
        description: err instanceof Error ? err.message : t('toasts.checkout_fail_desc'),
        variant: 'destructive',
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="premium-page max-w-3xl mx-auto space-y-6 pb-8">
      <section className="premium-intro">
        <div className="premium-intro__badge"><Crown className="h-4 w-4" aria-hidden="true" />{t('hero.badge')}</div>
        <h1 className="font-serif">{t('hero.title', { brand })}</h1>
        <p className="premium-intro__description">{t('hero.description')}</p>
        {showFreeTrialCta && <p className="premium-intro__free"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />{t('hero.free_trial')}</p>}
        {showTrialStatus && <p className="premium-intro__free">{trialDaysLeft === null ? t('hero.trial_status') : t('hero.trial_status_days', { count: trialDaysLeft })}</p>}
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
              {nativeBilling ? t(`${storeCopy}.manage_appstore`) : t('active.manage')}
            </Button>}
          </CardContent>
        </Card>
      )}

      {showFreeTrialCta && !intl && (
        <p className="text-center text-xs text-muted-foreground -mb-2">
          {t('social_proof')}
        </p>
      )}

      {nativeBilling && storeProductsReady && plans.some((plan) => !storeProducts.some((product) => product.plan === plan.id)) && (
        <div className="rounded-2xl border border-border bg-muted/40 p-4 text-center space-y-3">
          <p role="status" className="text-sm text-muted-foreground">{t(`${storeCopy}.products_unavailable`)}</p>
          <Button variant="outline" onClick={() => setStoreProductsAttempt((attempt) => attempt + 1)} disabled={loadingPlan !== null}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {t(`${storeCopy}.retry_prices`)}
          </Button>
        </div>
      )}

      <section className="premium-plans grid sm:grid-cols-2 gap-4 items-stretch">
        {plans.map((plan, i) => {
          const price = nativeBilling ? storeProducts.find((product) => product.plan === plan.id)?.priceString : plan.price;
          return (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 + i * 0.12 }}
                        className="h-full"
          >
          <Card
            className={`premium-plan relative h-full overflow-hidden shadow-sm ${
              plan.highlighted
                ? 'premium-plan--recommended border-primary bg-primary/[0.03]'
                : 'border-border'
            }`}
          >
            {plan.badge && (
              <div className="premium-plan__badge">
                {plan.badge}
              </div>
            )}
            <CardContent className="premium-plan__content p-5 sm:p-6 space-y-4">
              <div>
                <div className="flex items-center gap-2 text-primary mb-2">
                  <h2 className="font-serif text-2xl text-foreground">{plan.name}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <div>
                <div className="flex min-h-11 items-end gap-1" aria-live="polite" aria-busy={nativeBilling && !storeProductsReady}>
                  {price ? <>
                    <span className="text-4xl font-bold text-foreground">{price}</span>
                    <span className="pb-1 text-muted-foreground">{plan.period}</span>
                  </> : <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {!storeProductsReady && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
                    {t(`${storeCopy}.${storeProductsReady ? 'price_unavailable' : 'loading_price'}`)}
                  </span>}
                </div>
                {plan.subPrice && !nativeBilling && (
                  <p className="text-xs text-muted-foreground mt-1">{plan.subPrice}</p>
                )}
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">{t(plan.id === 'yearly' ? 'plans.yearly.billing' : 'plans.monthly.billing')}</p>

              <Button
                className="w-full rounded-xl"
                variant={plan.highlighted ? 'default' : 'outline'}
                onClick={() => handleCheckout(plan.id)}
                disabled={loadingPlan !== null || !allowPaidCheckout || !price}
              >
                {loadingPlan === plan.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!allowPaidCheckout ? t('plans.active_label') : (plan.id === 'monthly' ? t('plans.monthly.cta') : t('plans.yearly.cta'))}
              </Button>
            </CardContent>
          </Card>
          </motion.div>
          );
        })}
      </section>

      <div className="premium-account-actions flex flex-wrap justify-center gap-2">
        <Button variant="ghost" size="sm" className="gap-2" onClick={handleSyncPremium} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          {t('hero.sync_status')}
        </Button>
        {nativeBilling && <Button variant="ghost" size="sm" className="gap-2" onClick={handleRestorePurchases} disabled={restoring}>
          {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          {t(`${storeCopy}.restore`)}
        </Button>}
      </div>

      {/* Förtroenderad – tar bort sista riskkänslan före köp */}
      {showFreeTrialCta && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" />{nativeBilling ? t(`${storeCopy}.trust_appstore`) : t('trust.stripe')}</span>
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

      <Card className="premium-benefits">
        <CardContent className="p-5 sm:p-6">
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

      {allowPaidCheckout && user && <PremiumValueStats />}

      <div className="text-center text-sm text-muted-foreground space-y-2">
        <p>{t('free_reassurance')}</p>
        <p className="flex justify-center gap-5"><Link to="/terms" className="underline min-h-11 inline-flex items-center">{t('terms_link')}</Link><Link to="/integritet" className="underline min-h-11 inline-flex items-center">{t('privacy_link')}</Link></p>
      </div>

      {showFreeTrialCta && (!nativeBilling || storeProducts.some((product) => product.plan === 'yearly')) && (
        <StickyMobileUpgradeCTA
          label={nativeBilling ? `${t('plans.yearly.cta')} · ${storeProducts.find((p) => p.plan === 'yearly')?.priceString ?? ''} ${t('plans.yearly.period')}` : t('sticky_cta')}
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
