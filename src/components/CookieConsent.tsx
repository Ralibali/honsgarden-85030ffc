import { useBottomInset } from '@/hooks/useBottomInset';
import { readPrivacyConsent, storePrivacyConsent } from '@/lib/privacyConsent';
import { setAnalyticsConsent } from '@/lib/ga4Runtime';
import { initMetaPixel, readAdsConsent, storeAdsConsent } from '@/lib/metaPixel';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Cookie } from 'lucide-react';

const CONSENT_KEY = 'honsgarden_ga4_consent_v2';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [ads, setAds] = useState(false);
  const bannerRef = useBottomInset(visible);

  useEffect(() => {
    initMetaPixel();
    const a = readPrivacyConsent(CONSENT_KEY);
    const m = readAdsConsent();
    setAnalytics(a?.analytics ?? false);
    setAds(m?.ads ?? false);
    if (!a || !m) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const save = (nextAnalytics: boolean, nextAds: boolean) => {
    storePrivacyConsent(CONSENT_KEY, nextAnalytics);
    setAnalyticsConsent(nextAnalytics);
    storeAdsConsent(nextAds);
    setAnalytics(nextAnalytics);
    setAds(nextAds);
    setVisible(false);
  };

  if (!visible) return (
    <div className="flex justify-center border-t bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <button type="button" onClick={() => setVisible(true)} className="min-h-11 rounded border px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Cookieinställningar</button>
    </div>
  );

  return (
    <div ref={bannerRef} data-cookie-consent-banner className="fixed bottom-0 inset-x-0 z-[60] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-4xl mx-auto bg-card border border-border rounded-xl sm:rounded-2xl shadow-xl p-3 sm:p-5">
        <div className="flex items-center sm:items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
          <Cookie className="h-4 w-4 text-primary shrink-0 sm:hidden" />
          <div className="hidden sm:flex w-9 h-9 rounded-xl bg-primary/10 items-center justify-center shrink-0">
            <Cookie className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-foreground">Cookies och mätning</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug sm:leading-relaxed mt-0.5">
              Hönsgården fungerar med nödvändiga cookies. Du väljer själv om vi får använda Google Analytics 4 för statistik och Meta Pixel för att mäta om våra annonser på Facebook och Instagram leder till nya konton. Du kan ändra dig när som helst under Cookieinställningar.{' '}
              <a href="/integritet" className="text-primary underline">Läs mer</a>
            </p>
          </div>
        </div>
        <div className="space-y-1.5 mb-2 sm:mb-3">
          <label className="flex items-center gap-2 text-xs sm:text-sm text-foreground min-h-9">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
            Statistik (Google Analytics 4)
          </label>
          <label className="flex items-center gap-2 text-xs sm:text-sm text-foreground min-h-9">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={ads} onChange={(e) => setAds(e.target.checked)} />
            Annonsmätning (Meta, Facebook och Instagram)
          </label>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <Button onClick={() => save(true, true)} variant="outline" size="sm" className="min-h-11 text-xs sm:text-sm">
            Acceptera alla
          </Button>
          <Button onClick={() => save(analytics, ads)} variant="outline" size="sm" className="min-h-11 text-xs sm:text-sm">
            Spara val
          </Button>
          <Button onClick={() => save(false, false)} variant="outline" size="sm" className="min-h-11 text-xs sm:text-sm">
            Endast nödvändiga
          </Button>
        </div>
      </div>
    </div>
  );
}
