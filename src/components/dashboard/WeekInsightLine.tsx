import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Crown, Lock } from 'lucide-react';
import type { PremiumInsight } from '@/lib/premiumInsights';
import { trackEvent } from '@/lib/analytics';

/** Vad en gratisanvändare får veta om insikten – aldrig själva siffrorna. */
const TEASERS: Record<PremiumInsight['id'], string> = {
  best_layer_week: 'Se vilken höna som toppar veckan',
  flock_trend: 'Se åt vilket håll flocken är på väg',
  best_week_ever: 'Du har slagit ett rekord – se vilket',
  cost_per_egg: 'Se vad ett ägg kostar dig i foder just nu',
};

interface Props {
  insights: PremiumInsight[];
  isPlus: boolean;
  demo?: boolean;
}

/**
 * Veckans insikt i "Flockens vecka". Plus ser insikten; gratis ser vilken
 * sorts insikt som väntar, utan att användarens egna siffror hamnar i DOM:en.
 */
export default function WeekInsightLine({ insights, isPlus, demo = false }: Props) {
  const navigate = useNavigate();
  const first = insights[0];

  useEffect(() => {
    if (first && !isPlus && !demo) trackEvent('Plus Gate Shown', { feature: 'week_insight' });
  }, [first, isPlus, demo]);

  if (!first) return null;

  if (isPlus) {
    return (
      <div className="mt-3 rounded-2xl border border-warning/25 bg-warning/[0.06] p-3.5" data-testid="week-insight">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Crown className="h-3.5 w-3.5 text-warning" aria-hidden="true" /> Veckans insikt
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">{first.title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{first.body}</p>
        {insights.length > 1 && (
          <button type="button" onClick={() => navigate('/app/statistics')} className="mt-1 inline-flex min-h-10 items-center gap-0.5 text-xs font-semibold text-primary">
            {insights.length - 1} till i Insikter <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        trackEvent('Plus Gate Clicked', { feature: 'week_insight' });
        if (demo) window.location.assign('/login?mode=register');
        else navigate('/app/premium');
      }}
      className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left shadow-sm transition active:scale-[.99]"
      data-testid="week-insight-teaser"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15" aria-hidden="true">
        <Lock className="h-4 w-4 text-warning" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{first.title}</span>
        <span className="block text-xs text-muted-foreground">{TEASERS[first.id]} · ingår i Plus</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
