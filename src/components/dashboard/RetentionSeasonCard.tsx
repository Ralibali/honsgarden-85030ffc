import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Egg, Snowflake, Sun, Leaf, Flower2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getSeasonalGuidance, type SeasonalMode } from '@/lib/seasonalMode';
import { getLogRecency } from '@/lib/retentionLoop';

const MODE_ICONS: Record<SeasonalMode, LucideIcon> = {
  winter: Snowflake,
  spring: Flower2,
  summer: Sun,
  autumn: Leaf,
};

interface RetentionSeasonCardProps {
  /** Senaste loggdatum (yyyy-mm-dd) eller null. */
  lastLogDate: string | null;
  /** Dagens datum (yyyy-mm-dd). */
  todayIso: string;
  mode: SeasonalMode;
  /** Scrolla/fokusera snabblogg-kortet när användaren vill logga. */
  onLogClick?: () => void;
}

/**
 * Fri retention-loop + säsongsutbildning i ett kort:
 *  - Recency-nudge (varsam) om användaren börjar tappa loggvanan.
 *  - Annars säsongs-guidning — på vintern framför allt "lugnet är normalt".
 * Kortet är stängbart; vinterkortet kommer inte tillbaka samma säsong.
 */
export default function RetentionSeasonCard({
  lastLogDate,
  todayIso,
  mode,
  onLogClick,
}: RetentionSeasonCardProps) {
  const dismissKey = `hg_retention_card_dismissed_${mode}_${todayIso.slice(0, 7)}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(dismissKey) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const recency = getLogRecency(lastLogDate, todayIso, mode);
  const showNudge = recency.state === 'gentle_reminder'
    || recency.state === 'at_risk'
    || recency.state === 'dormant';

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey, '1');
    } catch {
      // privat läge — kortet bara döljs tills nästa render
    }
  };

  if (showNudge) {
    return (
      <Card className="border-primary/20 bg-primary/[0.04] shadow-sm rounded-2xl">
        <CardContent className="p-4 sm:p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Egg className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground text-sm">{recency.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">{recency.body}</p>
            {onLogClick && (
              <Button size="sm" className="mt-3 h-8 rounded-lg text-xs gap-1.5" onClick={onLogClick}>
                <Egg className="h-3.5 w-3.5" /> Logga dagens ägg
              </Button>
            )}
          </div>
          <button
            onClick={dismiss}
            aria-label="Stäng"
            className="text-muted-foreground/60 hover:text-foreground shrink-0 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </CardContent>
      </Card>
    );
  }

  if (mode !== 'winter') return null;

  const guidance = getSeasonalGuidance(mode);
  const Icon = MODE_ICONS[mode];

  return (
    <Card className="border-border/60 bg-muted/30 shadow-sm rounded-2xl">
      <CardContent className="p-4 sm:p-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm">{guidance.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">{guidance.body}</p>
          <Link
            to={guidance.ctaHref}
            className="inline-flex items-center text-xs font-medium text-primary hover:underline mt-2"
          >
            {guidance.ctaLabel}
          </Link>
        </div>
        <button
          onClick={dismiss}
          aria-label="Stäng"
          className="text-muted-foreground/60 hover:text-foreground shrink-0 p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}
