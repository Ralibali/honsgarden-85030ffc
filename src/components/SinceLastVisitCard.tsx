import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Egg, Sparkles, X, ClipboardList, HeartPulse } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { readScoped, writeScoped } from '@/lib/userScopedStorage';
import { motion } from 'framer-motion';

const KEY = 'last-visit-at';

interface Props {
  eggs: any[];
  healthLogs: any[];
  choreCompletions?: any[];
}

/**
 * "Det här hände sedan sist" — closes the loop for users who log in often
 * but don't act. Shows a friendly summary of activity since their previous
 * dashboard visit, then updates the timestamp so it disappears.
 */
export default function SinceLastVisitCard({ eggs, healthLogs }: Props) {
  const { user } = useAuth();
  const [lastVisit, setLastVisit] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const raw = readScoped(user.id, KEY);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed)) setLastVisit(parsed);

    // Update last-visit AFTER reading so the next render reflects "this visit"
    const t = window.setTimeout(() => {
      writeScoped(user.id, KEY, String(Date.now()));
    }, 800);
    return () => window.clearTimeout(t);
  }, [user?.id]);

  const summary = useMemo(() => {
    if (!lastVisit) return null;
    const since = new Date(lastVisit);
    const now = new Date();
    const diffH = (now.getTime() - since.getTime()) / 36e5;
    if (diffH < 6) return null; // skip tiny gaps

    const newEggs = eggs
      .filter((e: any) => new Date(e.created_at ?? e.date) > since)
      .reduce((s: number, e: any) => s + (e.count || 0), 0);

    const newHealth = healthLogs.filter(
      (l: any) => new Date(l.created_at ?? l.date) > since && l.type !== 'diary'
    ).length;
    const newDiary = healthLogs.filter(
      (l: any) => new Date(l.created_at ?? l.date) > since && l.type === 'diary'
    ).length;

    if (newEggs === 0 && newHealth === 0 && newDiary === 0) return null;

    return { since, diffH, newEggs, newHealth, newDiary };
  }, [lastVisit, eggs, healthLogs]);

  if (!summary || dismissed) return null;

  const { since, diffH, newEggs, newHealth, newDiary } = summary;
  const ago =
    diffH >= 24
      ? `${Math.floor(diffH / 24)} dag${Math.floor(diffH / 24) === 1 ? '' : 'ar'} sedan`
      : `${Math.round(diffH)} timmar sedan`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="border-accent/25 bg-gradient-to-br from-accent/8 via-card to-primary/5 shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-accent/15 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="data-label mb-1">Sedan du var här sist</p>
              <h3 className="font-serif text-base text-foreground leading-snug">
                Det här hände på din gård
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {ago} · {since.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>

              <div className="grid grid-cols-3 gap-2 mt-3">
                <Stat icon={<Egg className="h-3.5 w-3.5" />} value={newEggs} label="ägg" />
                <Stat icon={<ClipboardList className="h-3.5 w-3.5" />} value={newDiary} label="dagbok" />
                <Stat icon={<HeartPulse className="h-3.5 w-3.5" />} value={newHealth} label="hälsa" />
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              aria-label="Stäng"
              className="text-muted-foreground hover:text-foreground p-1 -mr-1 -mt-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  const muted = value === 0;
  return (
    <div className={`rounded-xl border border-border/40 p-2.5 text-center ${muted ? 'bg-muted/30 opacity-60' : 'bg-background/60'}`}>
      <div className="flex items-center justify-center gap-1 text-primary">
        {icon}
        <span className="text-base font-bold tabular-nums">{value}</span>
      </div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
