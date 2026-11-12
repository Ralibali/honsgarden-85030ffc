import { invalidateEggQueries } from '@/lib/eggQueryCache';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Egg, Loader2, ChevronRight, Check, Moon } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { hapticTap, hapticSuccess } from '@/lib/haptics';
import { todayLocal } from '@/lib/datetime';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { saveEggLog } from '@/lib/saveEggLog';
import type { EggLog } from '@/lib/api';

export interface FlockHen {
  id: string;
  name: string;
  image_url?: string | null;
  hen_type?: string | null;
}

interface Props {
  todayEggs: number;
  todayEggRowIds: string[];
  /** Sant när dagen har någon registrering – även en äggfri (0 ägg). */
  loggedToday?: boolean;
  /** Visa "Inga ägg idag" (bara meningsfullt när det finns hönor). */
  allowZeroDay?: boolean;
  /** Aktiva hönor. Ett tryck på en höna loggar ett ägg på just henne. */
  hens?: FlockHen[];
  /** Dagens ägg per höna (hen_id → antal). */
  todayByHen?: Record<string, number>;
  yesterdayEggs?: number;
  streak?: number;
}

const CARTON_ROW = 6;
/** Samma objekt varje gång, så att effekten på todayByHen inte körs i onödan. */
const NO_HEN_COUNTS: Record<string, number> = {};
/** Så länge efter sista trycket visas dagens sammanfattning. */
const SUMMARY_DELAY_MS = 1600;
/** Serverns lista hämtas om först när tryckandet har lugnat sig. */
const REFRESH_DELAY_MS = 1200;

function summaryLine(count: number, yesterdayEggs?: number, streak?: number): string {
  const parts = [`${count} ägg i dag`];
  if (typeof yesterdayEggs === 'number' && yesterdayEggs > 0) {
    if (count > yesterdayEggs) parts.push(`${count - yesterdayEggs} fler än i går`);
    else if (count === yesterdayEggs) parts.push('lika många som i går');
  }
  if (typeof streak === 'number' && streak >= 2) parts.push(`${streak} dagar i rad`);
  return parts.join(' · ');
}

export default function QuickEggLogCard({
  todayEggs,
  todayEggRowIds,
  loggedToday = todayEggs > 0,
  allowZeroDay = false,
  hens = [],
  todayByHen = NO_HEN_COUNTS,
  yesterdayEggs,
  streak,
}: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  // Ägg som användaren har tryckt in men som servern inte har bekräftat än.
  const [pending, setPending] = useState(0);
  const [pendingByHen, setPendingByHen] = useState<Record<string, number>>({});
  // Sparade ägg som ligger i cachen men ännu inte har nått hit som props.
  // Utan dem hoppar siffran ner ett steg och upp igen efter varje sparning.
  const [landing, setLanding] = useState(0);
  const [landingByHen, setLandingByHen] = useState<Record<string, number>>({});
  const seenTotal = useRef(todayEggs);
  const seenByHen = useRef(todayByHen);
  const [taps, setTaps] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const refreshTimer = useRef<number | null>(null);
  const offlineNoticeShown = useRef(false);

  const count = todayEggs + pending + landing;

  useEffect(() => {
    const arrived = todayEggs - seenTotal.current;
    seenTotal.current = todayEggs;
    if (arrived > 0) setLanding((value) => Math.max(0, value - arrived));
  }, [todayEggs]);

  useEffect(() => {
    const previous = seenByHen.current;
    seenByHen.current = todayByHen;
    setLandingByHen((value) => {
      let next = value;
      for (const henId of Object.keys(value)) {
        const arrived = (todayByHen[henId] ?? 0) - (previous[henId] ?? 0);
        if (arrived > 0 && value[henId] > 0) {
          if (next === value) next = { ...value };
          next[henId] = Math.max(0, value[henId] - arrived);
        }
      }
      return next;
    });
  }, [todayByHen]);

  useEffect(() => () => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
  }, []);

  // Dagens sammanfattning kommer när användaren har tryckt klart.
  useEffect(() => {
    if (taps === 0) return;
    setShowSummary(false);
    if (pending > 0) return;
    const timer = window.setTimeout(() => setShowSummary(true), SUMMARY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [taps, pending]);

  const scheduleRefresh = () => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      // Efter en full omhämtning är props sanningen, så inget ska ligga kvar här.
      void Promise.resolve(invalidateEggQueries(queryClient)).finally(() => {
        setLanding(0);
        setLandingByHen({});
      });
    }, REFRESH_DELAY_MS);
  };

  /** Trycket är färdigbehandlat. `inCache` betyder att raden nu ligger i ['eggs']. */
  const settle = (henId: string | undefined, inCache: boolean) => {
    setPending((value) => Math.max(0, value - 1));
    if (inCache) setLanding((value) => value + 1);
    if (henId) {
      setPendingByHen((value) => ({ ...value, [henId]: Math.max(0, (value[henId] ?? 0) - 1) }));
      if (inCache) setLandingByHen((value) => ({ ...value, [henId]: (value[henId] ?? 0) + 1 }));
    }
  };

  /**
   * Loggar ett ägg direkt. Knappen låses aldrig: varje tryck är en egen
   * registrering med eget client_id, så flera snabba tryck kan varken tappas
   * bort eller dubbelräknas.
   */
  const logEgg = (henId?: string) => {
    hapticTap();
    if ((count + 1) % CARTON_ROW === 0) hapticSuccess();
    setPending((value) => value + 1);
    if (henId) setPendingByHen((value) => ({ ...value, [henId]: (value[henId] ?? 0) + 1 }));
    setTaps((value) => value + 1);

    const record = { date: todayLocal(), count: 1, analytics_source: 'quick_log_card' as const, ...(henId ? { hen_id: henId } : {}) };
    let inCache = false;
    saveEggLog(user?.id, record, api.createEggRecord)
      .then((result) => {
        if (result && typeof result === 'object' && '__offline' in result) {
          queryClient.setQueryData<EggLog[]>(['eggs'], (old) => [
            { ...result, id: `pending-${result.client_id}`, user_id: user!.id, created_at: new Date().toISOString(), hen_id: henId ?? null, flock_id: null, notes: null } as unknown as EggLog,
            ...(old ?? []),
          ]);
          inCache = true;
          if (!offlineNoticeShown.current) {
            offlineNoticeShown.current = true;
            toast({ title: 'Sparat på enheten', description: 'Äggen synkas när du får täckning.' });
          }
        } else {
          const row = result as EggLog | undefined;
          if (row?.id) {
            // Lägg raden i listan direkt, så att siffran inte hoppar tillbaka
            // i väntan på att hela listan hämtas om.
            queryClient.setQueryData<EggLog[]>(['eggs'], (old) => {
              if (!old || old.some((existing) => existing.id === row.id)) return old;
              inCache = true;
              return [row, ...old];
            });
          }
          scheduleRefresh();
        }
      })
      .catch((err: Error) => {
        toast({ title: 'Fel', description: err.message, variant: 'destructive' });
      })
      .finally(() => settle(henId, inCache));
  };

  // "Inga ägg idag": en registrering med 0 ägg. Håller streaken och veckoringen
  // vid liv när hönorna pausar, och gör att statistiken slipper gissa.
  const logZero = useMutation({
    mutationFn: async () => saveEggLog(user?.id, { date: todayLocal(), count: 0, analytics_source: 'quick_log_card' }, api.createEggRecord),
    onSuccess: (result) => {
      if ('__offline' in result) {
        queryClient.setQueryData<EggLog[]>(['eggs'], old => [{ ...result, id: `pending-${result.client_id}`, user_id: user!.id, created_at: new Date().toISOString(), hen_id: null, flock_id: null, notes: null } as unknown as EggLog, ...(old ?? [])]);
      } else {
        void invalidateEggQueries(queryClient);
      }
      hapticSuccess();
      toast({ title: 'Äggfri dag registrerad 🌙', description: 'Dagen räknas i din streak – det är helt normalt med uppehåll.' });
    },
    onError: (err: Error) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
    onSettled: () => setBusy(false),
  });

  const removeOne = useMutation({
    mutationFn: async () => {
      if (todayEggRowIds.length === 0) throw new Error('Inga ägg att ta bort idag');
      const lastId = todayEggRowIds.find(id => !id.startsWith('pending-') && !id.startsWith('temp-'));
      if (!lastId || !navigator.onLine) throw new Error('Synka loggningarna innan du korrigerar antalet.');
      await api.removeOneEgg(lastId);
    },
    onSuccess: () => {
      void invalidateEggQueries(queryClient);
      toast({ title: '−1 ägg borttaget' });
    },
    onError: (err: Error) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
    onSettled: () => setBusy(false),
  });

  const handleRemove = () => {
    hapticTap();
    setBusy(true);
    setShowSummary(false);
    removeOne.mutate();
  };

  // Minus väntar tills alla tryck är sparade, annars finns inget säkert att ta bort.
  const disableMinus = busy || pending > 0 || landing > 0 || todayEggs === 0 || !todayEggRowIds.some(id => !id.startsWith('pending-') && !id.startsWith('temp-'));

  const slots = count <= CARTON_ROW ? CARTON_ROW : CARTON_ROW * 2;
  const overflow = Math.max(0, count - slots);
  const layingHens = hens.filter((hen) => hen.hen_type !== 'rooster');

  return (
    <Card className="egg-counter-v3 overflow-hidden">
      <CardContent className="p-0">
        <div className="egg-counter-v3__top">
          <div>
            <p className="egg-counter-v3__eyebrow">Dagens ägg</p>
            <p className="egg-counter-v3__hint">
              {layingHens.length > 0 ? 'Tryck på hönan som värpt, eller på plus' : 'Tryck när du hämtar ett ägg'}
            </p>
          </div>
          <a href="/app/eggs" className="egg-counter-v3__details">
            Historik <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="egg-counter-v3__controls">
          <Button
            variant="outline"
            size="icon"
            className="egg-counter-v3__button egg-counter-v3__button--minus"
            onClick={handleRemove}
            disabled={disableMinus}
            aria-label="Ta bort ett ägg"
          >
            {busy && removeOne.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Minus className="h-6 w-6" />}
          </Button>
          <div className="egg-counter-v3__count" aria-live="polite">
            <span className="egg-counter-v3__eggmark" aria-hidden="true"><Egg className="h-4 w-4" /></span>
            <strong key={taps} className={taps > 0 ? 'is-popping' : undefined}>{count}</strong>
            <span>ägg</span>
          </div>
          <Button
            size="icon"
            className="egg-counter-v3__button egg-counter-v3__button--plus"
            onClick={() => logEgg()}
            aria-label="Lägg till ett ägg"
          >
            <Plus className="h-7 w-7" />
          </Button>
        </div>

        <div className="egg-carton" data-testid="egg-carton" aria-hidden="true">
          <div className="egg-carton__tray" style={{ gridTemplateColumns: `repeat(${CARTON_ROW}, minmax(0, 1fr))` }}>
            {Array.from({ length: slots }, (_, index) => (
              <span
                key={`${index}-${index < count ? 'full' : 'empty'}`}
                className={`egg-carton__slot ${index < count ? 'is-filled' : ''}`}
              />
            ))}
          </div>
          {overflow > 0 && <span className="egg-carton__more">+{overflow}</span>}
        </div>

        {layingHens.length > 0 && (
          <ul className="egg-flock" aria-label="Logga ägg per höna">
            {layingHens.map((hen) => {
              const laid = (todayByHen[hen.id] ?? 0) + (pendingByHen[hen.id] ?? 0) + (landingByHen[hen.id] ?? 0);
              return (
                <li key={hen.id}>
                  <button
                    type="button"
                    className={`egg-flock__hen ${laid > 0 ? 'has-laid' : ''}`}
                    onClick={() => logEgg(hen.id)}
                    aria-label={`Logga ett ägg från ${hen.name}${laid > 0 ? `, ${laid} i dag` : ''}`}
                  >
                    <span className="egg-flock__avatar">
                      {hen.image_url
                        ? <img src={hen.image_url} alt="" loading="lazy" />
                        : <span aria-hidden="true">🐔</span>}
                      {laid > 0 && <span key={laid} className="egg-flock__badge">{laid}</span>}
                    </span>
                    <span className="egg-flock__name">{hen.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {showSummary && count > 0 && (
          <p className="egg-counter-v3__summary" role="status" data-testid="egg-day-summary">
            <Check className="h-4 w-4" aria-hidden="true" />
            {summaryLine(count, yesterdayEggs, streak)}
          </p>
        )}

        {count === 0 && loggedToday ? (
          <p className="flex min-h-11 items-center justify-center gap-1.5 px-4 pb-3 text-center text-sm text-muted-foreground" data-testid="zero-day-logged">
            <Check className="h-4 w-4 text-success" aria-hidden="true" />
            Äggfri dag registrerad – streaken lever.
          </p>
        ) : null}
        <div className="flex min-h-11 flex-wrap items-center justify-center gap-x-5 gap-y-1 px-4 pb-3 text-sm font-medium">
          {allowZeroDay && count === 0 && !loggedToday && (
            <button
              type="button"
              onClick={() => { hapticTap(); setBusy(true); logZero.mutate(); }}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-1.5 text-muted-foreground underline underline-offset-4 disabled:opacity-60"
            >
              {busy && logZero.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
              Inga ägg idag
            </button>
          )}
          <a href="/app/eggs?log=1" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Logga en annan dag</a>
        </div>
      </CardContent>
    </Card>
  );
}
