import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Download, Loader2, Lock, TrendingDown, TrendingUp, Trophy, X } from 'lucide-react';
import type { MonthRecap, RecapEgg } from '@/lib/monthRecap';
import { api } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { readScoped, writeScoped } from '@/lib/userScopedStorage';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { shortSvDate } from '@/lib/farmPulse';

interface RecapHenRow {
  id: string;
  name?: string | null;
  breed?: string | null;
}

interface Props {
  recap: MonthRecap;
  eggs: RecapEgg[];
  hens: RecapHenRow[];
  isPlus: boolean;
  demo?: boolean;
}

const DISMISS_KEY = 'hg_month_recap_dismissed_v1';

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Månadens bokslut på Idag, de första dagarna i en ny månad. Siffrorna är
 * gratis för alla; den färdiga PDF-rapporten med ekonomi och topplista är
 * Plus – samma kapabilitet som rapporterna i övrigt, ingen ny betalvägg.
 */
export default function MonthRecapCard({ recap, eggs, hens, isPlus, demo = false }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(() => readScoped(user?.id, DISMISS_KEY) === recap.monthKey);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!dismissed && !isPlus && !demo) trackEvent('Plus Gate Shown', { feature: 'month_recap' });
  }, [dismissed, isPlus, demo]);

  if (dismissed) return null;

  const month = capitalize(recap.monthLabel);

  const download = async () => {
    setBusy(true);
    try {
      const [{ generateMonthlyReportPdf }, transactions] = await Promise.all([
        import('@/lib/monthlyReportPdf'),
        api.getTransactions(),
      ]);
      const perHen = new Map<string, number>();
      for (const row of eggs) {
        if (!row.hen_id || !row.date?.startsWith(recap.monthKey)) continue;
        perHen.set(row.hen_id, (perHen.get(row.hen_id) || 0) + Math.max(0, Number(row.count) || 0));
      }
      const topHens = [...perHen.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, totalEggs]) => {
          const hen = hens.find((h) => h.id === id);
          return { name: hen?.name ?? 'Namnlös', breed: hen?.breed ?? null, totalEggs };
        });
      await generateMonthlyReportPdf({
        month: new Date(`${recap.monthKey}-15T12:00:00`),
        eggs: eggs.filter((e) => e.date).map((e) => ({ date: e.date as string, count: Math.max(0, Number(e.count) || 0) })),
        transactions: transactions.map((t) => ({ date: t.date, type: t.type, amount: t.amount })),
        henCount: hens.length,
        topHens,
      });
      toast({ title: `${month}rapporten är klar 📄` });
    } catch (error) {
      toast({ title: 'Kunde inte skapa rapporten', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    writeScoped(user?.id, DISMISS_KEY, recap.monthKey);
  };

  return (
    <section className="today-v3__journal" aria-labelledby="month-recap-heading" data-testid="month-recap">
      <div className="today-v3__section-heading">
        <div>
          <p className="today-v3__eyebrow">Månadens bokslut</p>
          <h2 id="month-recap-heading">{month} i hönsgården</h2>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dölj månadens bokslut" className="!p-2">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-end gap-3">
          <strong className="font-serif text-4xl leading-none text-foreground">{recap.totalEggs.toLocaleString('sv-SE')}</strong>
          <span className="pb-1 text-sm text-muted-foreground">ägg på {recap.loggedDays} loggade dagar</span>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-foreground" role="list">
          {recap.changePct !== null && recap.changePct !== 0 && (
            <li className="flex items-center gap-2">
              {recap.changePct > 0 ? <TrendingUp className="h-4 w-4 text-success" aria-hidden="true" /> : <TrendingDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
              {Math.abs(recap.changePct)} % {recap.changePct > 0 ? 'fler' : 'färre'} ägg per dag än i {recap.previousMonthLabel}
            </li>
          )}
          {recap.bestDay && (
            <li className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning" aria-hidden="true" />
              Bästa dagen: {shortSvDate(recap.bestDay.date)} med {recap.bestDay.count} ägg
            </li>
          )}
          {recap.topHen && (
            <li className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-warning" aria-hidden="true" />
              Månadens flitigaste: {recap.topHen.name} ({recap.topHen.eggs} ägg)
            </li>
          )}
        </ul>

        {isPlus ? (
          <button
            type="button"
            onClick={() => void download()}
            disabled={busy}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition active:scale-[.98] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Ladda ner {recap.monthLabel}rapporten (PDF)
          </button>
        ) : (
          <div className="mt-4 rounded-xl bg-muted/60 p-3">
            <p className="flex items-start gap-2 text-sm text-foreground">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>Hela {recap.monthLabel}rapporten – netto, kostnad per ägg, dag-för-dag och topplista som snygg PDF – ingår i Plus.</span>
            </p>
            <button
              type="button"
              onClick={() => {
                trackEvent('Plus Gate Clicked', { feature: 'month_recap' });
                if (demo) window.location.assign('/login?mode=register'); else navigate('/app/premium');
              }}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-primary/30 bg-background px-4 text-sm font-semibold text-primary transition active:scale-[.98]"
            >
              Se vad Plus ger
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
