import React, { useCallback, useMemo, useState } from 'react';
import { localCalendarDate, todayLocal } from '@/lib/datetime';
import { Button } from '@/components/ui/button';
import { BookOpen, Download, Egg as EggIcon, LayoutGrid, List, Plus, Sparkles } from 'lucide-react';
import { downloadCSV, downloadPDF } from '@/lib/exportUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type EggLog } from '@/lib/api';

type EggFormInput = { date: string; count: number; hen_id?: string; flock_id?: string };
type OfflineEggResult = { __offline: true; client_id: string } & EggFormInput;
type CreateEggResult = EggLog | OfflineEggResult;
type PendingEggLog = EggLog & { pending?: boolean; client_id?: string };

import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { EggForm } from '@/components/eggs/EggForm';
import { EggGroupedView } from '@/components/eggs/EggGroupedView';
import { EggListView } from '@/components/eggs/EggListView';
import { EggSuccessAnimation } from '@/components/EggSuccessAnimation';
import { PersonalRecordToast, type PersonalRecordToastData } from '@/components/PersonalRecordToast';
import { FeatureSuggestionToast } from '@/components/FeatureSuggestionToast';
import EmptyState from '@/components/EmptyState';
import { checkPersonalRecords, recordLabel } from '@/lib/personalRecords';
import { feedbackCelebrate } from '@/lib/feedback';
import { useAuth } from '@/hooks/useAuth';
import { enqueueEggLog } from '@/lib/offlineQueue';
import { trackFirstEggIfNew } from '@/lib/analytics';

function localDateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localCalendarDate(date, Intl.DateTimeFormat().resolvedOptions().timeZone);
}

function formatMonthLabel(date = new Date()) {
  const label = new Intl.DateTimeFormat('sv-SE', { month: 'long' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function Eggs() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [showAnimation, setShowAnimation] = useState(false);
  const [animCount, setAnimCount] = useState(0);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [recordToast, setRecordToast] = useState<PersonalRecordToastData | null>(null);

  const { data: eggs = [], isLoading } = useQuery({
    queryKey: ['eggs'],
    queryFn: () => api.getEggs(),
  });

  const { data: hens = [] } = useQuery({
    queryKey: ['hens'],
    queryFn: () => api.getHens(),
    staleTime: 60_000,
  });

  const { data: flocks = [] } = useQuery({
    queryKey: ['flocks'],
    queryFn: () => api.getFlocks(),
    staleTime: 60_000,
  });

  const activeHens = hens.filter((h) => h.is_active && h.hen_type !== 'rooster');

  const { data: feedRecords = [] } = useQuery({ queryKey: ['feed-records'], queryFn: () => api.getFeedRecords(), staleTime: 60_000 });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => api.getTransactions(), staleTime: 60_000 });
  const { data: chores = [] } = useQuery({ queryKey: ['daily-chores'], queryFn: () => api.getDailyChores(), staleTime: 60_000 });

  const unusedFeatures: ('feed' | 'finance' | 'chores')[] = [];
  if (feedRecords.length === 0) unusedFeatures.push('feed');
  if (transactions.length === 0) unusedFeatures.push('finance');
  if (chores.length === 0) unusedFeatures.push('chores');

  const handleAnimationDone = useCallback(() => {
    setShowAnimation(false);
    toast({ title: `Snyggt, ${animCount} ägg är loggade! 🥚` });
    if (unusedFeatures.length > 0) setShowSuggestion(true);
  }, [animCount, unusedFeatures.length]);

  const createMutation = useMutation({
    mutationFn: async (data: EggFormInput): Promise<CreateEggResult> => {
      const client_id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const queued = await enqueueEggLog({ ...data, client_id });
        return { __offline: true, client_id: queued.client_id, ...data };
      }
      try {
        const weather = await api.fetchEggLogWeatherSnapshot(data.date);
        return await api.createEggRecord({ ...data, weather, client_id });
      } catch (err) {
        const msg = (err instanceof Error ? err.message : '').toLowerCase();
        const isNet = msg.includes('failed to fetch') || msg.includes('network') || (typeof navigator !== 'undefined' && !navigator.onLine);
        if (isNet) {
          const queued = await enqueueEggLog({ ...data, client_id });
          return { __offline: true, client_id: queued.client_id, ...data };
        }
        throw err;
      }
    },
    onSuccess: (result, variables) => {
      const isOffline = '__offline' in result;
      if (isOffline) {
        queryClient.setQueryData<PendingEggLog[]>(['eggs'], (old) => {
          const next = [...(old ?? [])];
          next.unshift({
            id: `pending-${result.client_id}`,
            client_id: result.client_id,
            date: variables.date,
            count: variables.count,
            hen_id: variables.hen_id ?? null,
            flock_id: variables.flock_id ?? null,
            pending: true,
          } as PendingEggLog);
          return next;
        });
        toast({ title: 'Sparat offline 📡', description: 'Synkas automatiskt när du får täckning.' });
      } else {
        queryClient.invalidateQueries({ queryKey: ['eggs'] });
        queryClient.invalidateQueries({ queryKey: ['streak'] });
      }

      setAnimCount(variables.count);
      setShowAnimation(true);
      setShowForm(false);
      if (!isOffline) trackFirstEggIfNew('eggs_page');

      const updatedEggs = [...eggs, { date: variables.date, count: variables.count }];
      const records = checkPersonalRecords(user?.id, updatedEggs, variables.date);
      if (records.length > 0) {
        const r = records[0];
        setTimeout(() => {
          setRecordToast({
            id: `${r.type}-${Date.now()}`,
            title: recordLabel(r.type),
            subtitle: r.previous > 0 ? `Tidigare: ${r.previous} ägg` : 'Första riktiga toppnoteringen',
            value: r.value,
            unit: r.type === 'day' ? 'ägg / dag' : 'ägg / 7 dagar',
          });
          feedbackCelebrate();
        }, 600);
      }
    },
    onError: (err) => toast({
      title: 'Något gick fel',
      description: err instanceof Error ? err.message : 'Vi kunde inte spara äggen just nu.',
      variant: 'destructive',
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteEggRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eggs'] });
      queryClient.invalidateQueries({ queryKey: ['streak'] });
      toast({ title: 'Äggregistreringen är borttagen' });
    },
  });

  const henNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    hens.forEach((h) => { map[h.id] = h.name; });
    return map;
  }, [hens]);

  const henFlockMap = useMemo(() => {
    const map: Record<string, string> = {};
    hens.forEach((h) => { if (h.flock_id) map[h.id] = h.flock_id; });
    return map;
  }, [hens]);

  const flockNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    flocks.forEach((f) => { map[f.id] = f.name; });
    return map;
  }, [flocks]);

  const resolveFlockName = (egg: Pick<EggLog, 'flock_id' | 'hen_id'>) => {
    if (egg.flock_id) return flockNameMap[egg.flock_id] || '';
    if (egg.hen_id && henFlockMap[egg.hen_id]) return flockNameMap[henFlockMap[egg.hen_id]] || '';
    return '';
  };

  const todayStr = todayLocal();
  const yesterdayStr = localDateOffset(-1);
  const sevenDaysAgo = localDateOffset(-6);
  const fourteenDaysAgo = localDateOffset(-13);
  const currentMonth = todayStr.slice(0, 7);

  const todayEggs = eggs.filter((egg) => egg.date === todayStr).reduce((sum, egg) => sum + (egg.count || 0), 0);
  const yesterdayEggs = eggs.filter((egg) => egg.date === yesterdayStr).reduce((sum, egg) => sum + (egg.count || 0), 0);
  const weekEggs = eggs
    .filter((egg) => egg.date >= sevenDaysAgo && egg.date <= todayStr)
    .reduce((sum, egg) => sum + (egg.count || 0), 0);
  const previousWeekEggs = eggs
    .filter((egg) => egg.date >= fourteenDaysAgo && egg.date < sevenDaysAgo)
    .reduce((sum, egg) => sum + (egg.count || 0), 0);
  const monthEggs = eggs
    .filter((egg) => egg.date.startsWith(currentMonth))
    .reduce((sum, egg) => sum + (egg.count || 0), 0);

  const weekDelta = weekEggs - previousWeekEggs;
  const dailyAverage = activeHens.length > 0 ? weekEggs / 7 : 0;
  const todayComparison = todayEggs === yesterdayEggs
    ? 'Samma antal som igår hittills.'
    : todayEggs > yesterdayEggs
      ? `${todayEggs - yesterdayEggs} fler än igår hittills.`
      : `${yesterdayEggs - todayEggs} färre än igår hittills.`;

  const weekStory = previousWeekEggs === 0
    ? `Du har loggat ${weekEggs} ägg de senaste sju dagarna.`
    : weekDelta === 0
      ? `Flocken ligger precis i samma takt som förra sjudagarsperioden: ${weekEggs} ägg.`
      : weekDelta > 0
        ? `Flocken har lagt ${weekDelta} fler ägg än under förra sjudagarsperioden.`
        : `Det har blivit ${Math.abs(weekDelta)} färre ägg än under förra sjudagarsperioden.`;

  const exportRows = () => eggs.map((egg) => ({
    Datum: egg.date,
    Antal: egg.count,
    Flock: resolveFlockName(egg),
    Höna: egg.hen_id ? henNameMap[egg.hen_id] || '' : '',
    Anteckningar: egg.notes || '',
  }));

  if (isLoading) {
    return (
      <div className="eggbook-v10 max-w-4xl mx-auto space-y-4 animate-fade-in">
        <Skeleton className="h-28 rounded-[28px]" />
        <Skeleton className="h-40 rounded-[28px]" />
        <Skeleton className="h-72 rounded-[28px]" />
      </div>
    );
  }

  return (
    <div className="eggbook-v10 max-w-4xl mx-auto animate-fade-in">
      <header className="eggbook-v10__header">
        <div className="eggbook-v10__heading">
          <span className="eggbook-v10__mark" aria-hidden="true">🥚</span>
          <div>
            <p className="eggbook-v10__eyebrow">Gårdens äggbok</p>
            <h1>Ägg</h1>
            <p>En enkel dagbok över skörden från redena.</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="eggbook-v10__log-button gap-2 active:scale-95 transition-transform">
          <Plus className="h-4 w-4" />
          {showForm ? 'Stäng' : 'Logga ägg'}
        </Button>
      </header>

      {showForm && (
        <div className="eggbook-v10__composer">
          <EggForm
            activeHens={activeHens}
            flocks={flocks}
            isPending={createMutation.isPending}
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {eggs.length === 0 && !showForm ? (
        <div className="eggbook-v10__empty">
          <EmptyState
            icon={EggIcon}
            title="Första sidan är tom ännu"
            description="Logga dagens skörd så börjar äggboken fyllas. Efter några dagar kan Hönsgården hjälpa dig se flockens egen rytm."
            actionLabel="Logga dagens ägg"
            onAction={() => setShowForm(true)}
            secondaryLabel="Lägg till höna först"
            onSecondaryAction={() => window.location.assign('/app/hens')}
          />
        </div>
      ) : eggs.length > 0 ? (
        <>
          <section className="eggbook-v10__today" aria-labelledby="eggbook-today-heading">
            <div className="eggbook-v10__today-copy">
              <p className="eggbook-v10__eyebrow">Dagens skörd</p>
              <div className="eggbook-v10__today-number">
                <strong>{todayEggs}</strong>
                <span>ägg</span>
              </div>
              <p id="eggbook-today-heading">{todayComparison}</p>
            </div>
            <button type="button" className="eggbook-v10__today-action" onClick={() => setShowForm(true)}>
              <Plus className="h-5 w-5" />
              Lägg till
            </button>
          </section>

          <section className="eggbook-v10__rhythm" aria-labelledby="eggbook-rhythm-heading">
            <div className="eggbook-v10__rhythm-intro">
              <span className="eggbook-v10__spark" aria-hidden="true"><Sparkles className="h-4 w-4" /></span>
              <div>
                <p className="eggbook-v10__eyebrow">Veckans rytm</p>
                <h2 id="eggbook-rhythm-heading">{weekStory}</h2>
                {activeHens.length > 0 && (
                  <p>Det motsvarar ungefär {dailyAverage.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} ägg per dag från {activeHens.length} aktiva hönor.</p>
                )}
              </div>
            </div>

            <div className="eggbook-v10__numbers" aria-label="Sammanfattning">
              <div>
                <strong>{todayEggs}</strong>
                <span>idag</span>
              </div>
              <div>
                <strong>{weekEggs}</strong>
                <span>7 dagar</span>
              </div>
              <div>
                <strong>{monthEggs}</strong>
                <span>{formatMonthLabel()}</span>
              </div>
            </div>
          </section>

          <section className="eggbook-v10__history" aria-labelledby="eggbook-history-heading">
            <div className="eggbook-v10__history-header">
              <div className="eggbook-v10__history-title">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
                <div>
                  <p className="eggbook-v10__eyebrow">Äggboken</p>
                  <h2 id="eggbook-history-heading">Senaste sidorna</h2>
                </div>
              </div>
              <div className="eggbook-v10__view-switch" aria-label="Välj visning">
                <button
                  onClick={() => setViewMode('grouped')}
                  className={viewMode === 'grouped' ? 'is-active' : ''}
                  aria-label="Grupperad vy"
                  aria-pressed={viewMode === 'grouped'}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={viewMode === 'list' ? 'is-active' : ''}
                  aria-label="Listvy"
                  aria-pressed={viewMode === 'list'}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="eggbook-v10__entries">
              {viewMode === 'grouped' ? (
                <EggGroupedView
                  eggs={eggs}
                  henNameMap={henNameMap}
                  flockNameMap={flockNameMap}
                  henFlockMap={henFlockMap}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ) : (
                <EggListView
                  eggs={eggs}
                  henNameMap={henNameMap}
                  flockNameMap={flockNameMap}
                  henFlockMap={henFlockMap}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              )}
            </div>
          </section>

          <details className="eggbook-v10__export">
            <summary><Download className="h-4 w-4" /> Spara eller exportera äggboken</summary>
            <div>
              <Button variant="outline" size="sm" onClick={() => downloadCSV(exportRows(), `agglogg-${todayStr}`)}>
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                downloadPDF(
                  'Ägglogg',
                  ['Datum', 'Antal', 'Flock', 'Höna', 'Anteckningar'],
                  eggs.map((egg) => [egg.date, String(egg.count), resolveFlockName(egg), egg.hen_id ? henNameMap[egg.hen_id] || '' : '', egg.notes || '']),
                  'agglogg',
                );
              }}>
                PDF
              </Button>
            </div>
          </details>
        </>
      ) : null}

      <EggSuccessAnimation show={showAnimation} count={animCount} onDone={handleAnimationDone} />
      <PersonalRecordToast record={recordToast} onDone={() => setRecordToast(null)} />
      <FeatureSuggestionToast
        show={showSuggestion}
        unusedFeatures={unusedFeatures}
        onDismiss={() => setShowSuggestion(false)}
      />
    </div>
  );
}
