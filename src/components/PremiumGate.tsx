import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Crown, Lock, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getGateCopy } from '@/components/premium/gateCopy';
import { trackClick } from '@/hooks/useTracking';

interface PremiumGateProps {
  children: React.ReactNode;
  /** What feature this gate protects – shown in the upsell (fallback) */
  feature?: string;
  /** Contextual copy key (overrides feature). See gateCopy.ts */
  featureKey?: string;
  /** If true, show blurred preview instead of full block */
  blur?: boolean;
  /** If true, allow content but show a subtle banner on top */
  soft?: boolean;
  /** If true, render children blurred and locked beneath an overlay (real-data safe variant of blur). */
  preview?: boolean;
}

/**
 * Wraps content that requires Premium.
 * Free users see a compelling upsell overlay.
 */
export function PremiumGate({ children, feature, featureKey, blur = true, soft = false, preview = false }: PremiumGateProps) {
  const { user } = useAuth();
  const isPremium = user?.subscription_status === 'premium';
  const copy = getGateCopy(featureKey);

  React.useEffect(() => {
    if (isPremium || soft) return;
    trackClick('paywall_view', { metadata: { featureKey: featureKey || null, feature: feature || null } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium]);

  if (isPremium) return <>{children}</>;

  if (soft) {
    return (
      <div className="relative">
        <PremiumBannerInline feature={feature} featureKey={featureKey} />
        {children}
      </div>
    );
  }

  // Preview mode: render children blurred, non-interactive, hidden from a11y, with overlay.
  if (preview) {
    return (
      <div className="relative min-h-[420px]">
        <div
          className="pointer-events-none select-none blur-md opacity-60 saturate-50"
          aria-hidden="true"
          {...({ inert: '' } as any)}
        >
          {children}
        </div>
        <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]" aria-hidden="true" />
        <div className="absolute inset-0 flex items-start justify-center pt-12 sm:pt-20 px-4 z-10">
          <PremiumUpsellCard feature={feature} featureKey={featureKey} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Blurred preview */}
      {blur && (
        <div className="pointer-events-none select-none" aria-hidden="true">
          <div className="blur-[6px] opacity-50 saturate-50">
            {children}
          </div>
        </div>
      )}

      {/* Overlay */}
      <div className={`${blur ? 'absolute inset-0' : ''} flex items-center justify-center z-10`}>
        <PremiumUpsellCard feature={feature} featureKey={featureKey} />
      </div>
    </div>
  );
}

function PremiumUpsellCard({ feature, featureKey }: { feature?: string; featureKey?: string }) {
  const navigate = useNavigate();
  const copy = getGateCopy(featureKey);
  const title = copy?.title ?? (feature ? `${feature} kräver Premium` : 'Premium-funktion');
  const body = copy?.body ?? 'Lås upp alla funktioner med Premium.';

  const handleClick = () => {
    trackClick('paywall_click', { metadata: { featureKey: featureKey || null, feature: feature || null } });
    navigate('/app/premium');
  };

  return (
    <div className="max-w-sm w-full mx-auto animate-fade-in-scale">
      <div className="bg-card/95 backdrop-blur-xl border border-primary/15 rounded-2xl p-6 shadow-xl text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-warning/20 to-accent/20 flex items-center justify-center mx-auto">
          <Crown className="h-7 w-7 text-warning" />
        </div>
        <div>
          <h3 className="font-serif text-lg text-foreground mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
          <p className="text-xs text-muted-foreground mt-2">Prova sju dagar gratis – sedan 19 kr/mån</p>
        </div>
        <Button
          className="w-full h-11 gap-2 text-sm font-semibold rounded-xl shadow-[0_4px_14px_0_hsl(var(--primary)/0.25)]"
          onClick={handleClick}
        >
          <Sparkles className="h-4 w-4" />
          Prova Premium gratis
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-[10px] text-muted-foreground">Ingen bindningstid · Avbryt när du vill</p>
      </div>
    </div>
  );
}

/** Small inline banner for soft gates */
function PremiumBannerInline({ feature, featureKey }: { feature?: string; featureKey?: string }) {
  const navigate = useNavigate();
  const copy = getGateCopy(featureKey);
  const label = copy?.title ?? (feature ? `Lås upp ${feature.toLowerCase()} med Premium` : 'Uppgradera till Premium');

  return (
    <button
      onClick={() => {
        trackClick('paywall_click', { metadata: { featureKey: featureKey || null, feature: feature || null, variant: 'soft' } });
        navigate('/app/premium');
      }}
      className="w-full flex items-center gap-3 p-3 mb-4 rounded-xl bg-gradient-to-r from-warning/8 via-accent/5 to-primary/8 border border-warning/15 hover:border-warning/30 transition-all group"
    >
      <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
        <Crown className="h-4 w-4 text-warning" />
      </div>
      <div className="flex-1 text-left">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">Sju dagar gratis – sedan 19 kr/mån</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
    </button>
  );
}

/** Dashboard-style premium nudge card */
export function PremiumNudge() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPremium = user?.subscription_status === 'premium';

  if (isPremium) return null;

  return (
    <button
      onClick={() => {
        trackClick('paywall_click', { metadata: { variant: 'nudge' } });
        navigate('/app/premium');
      }}
      className="w-full text-left group animate-fade-in-scale"
    >
      <div className="relative overflow-hidden rounded-2xl border border-warning/20 bg-gradient-to-br from-warning/8 via-accent/5 to-primary/5 p-5 transition-all hover:border-warning/35 hover:shadow-lg">
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-warning/8 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-primary/8 blur-xl" />
        
        <div className="relative flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-warning/25 to-accent/20 flex items-center justify-center shrink-0 shadow-sm">
            <Crown className="h-6 w-6 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-serif text-sm text-foreground">Gör mer med Premium</h3>
              <span className="text-[9px] font-bold uppercase tracking-wider text-warning bg-warning/12 px-2 py-0.5 rounded-full">Nytt</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Statistik, prognoser, kläckning, foderspårning och mycket mer. Prova sju dagar helt gratis!
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary group-hover:text-primary/80 transition-colors">
                Prova gratis →
              </span>
              <span className="text-[10px] text-muted-foreground">19 kr/mån</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

/** Limit counter – e.g. "3 av 3 hönor (gratis)" */
export function FreeLimitBadge({ current, limit, label }: { current: number; limit: number; label: string }) {
  const { user } = useAuth();
  const isPremium = user?.subscription_status === 'premium';
  const navigate = useNavigate();

  if (isPremium) return null;

  const atLimit = current >= limit;

  return (
    <button
      onClick={() => navigate('/app/premium')}
      className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full transition-colors ${
        atLimit
          ? 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15'
          : 'bg-muted/60 text-muted-foreground border border-border/50 hover:bg-muted'
      }`}
    >
      {atLimit ? <Lock className="h-3 w-3" /> : null}
      {current}/{limit} {label}
      {atLimit && ' · Uppgradera'}
    </button>
  );
}
