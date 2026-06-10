import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Egg as EggIcon, Loader2, Trash2, Download, List, LayoutGrid } from 'lucide-react';
import { downloadCSV, downloadPDF } from '@/lib/exportUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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

  const activeHens = (hens as any[]).filter((h: any) => h.is_active && h.hen_type !== 'rooster');

  const { data: feedRecords = [] } = useQuery({ queryKey: ['feed-records'], queryFn: () => api.getFeedRecords(), staleTime: 60_000 });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => api.getTransactions(), staleTime: 60_000 });
  const { data: chores = [] } = useQuery({ queryKey: ['daily-chores'], queryFn: () => api.getDailyChores(), staleTime: 60_000 });

  const unusedFeatures: ('feed' | 'finance' | 'chores')[] = [];
  if ((feedRecords as any[]).length === 0) unusedFeatures.push('feed');
  if ((transactions as any[]).length === 0) unusedFeatures.push('finance');
  if ((chores as any[]).length === 0) unusedFeatures.push('chores');

  const handleAnimationDone = useCallback(() => {
    setShowAnimation(false);
    toast({ title: `Snyggt, ${animCount} ägg är loggade! 🥚` });
    if (unusedFeatures.length > 0) {
      setShowSuggestion(true);
    }
  }, [animCount, unusedFeatures.length]);

  const createMutation = useMutation({
    mutationFn: async (data: { date: string; count: number; hen_id?: string; flock_id?: string }) => {
      const weather = await api.fetchEggLogWeatherSnapshot(data.date);
      return api.createEggRecord({ ...data, weather });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['eggs'] });
      queryClient.invalidateQueries({ queryKey: ['streak'] });
      setAnimCount(variables.count);
      setShowAnimation(true);
      setShowForm(false);

      // Personal record check (delight bump)
      const updatedEggs = [...(eggs as any[]), { date: variables.date, count: variables.count }];
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
    onError: (err: any) => toast({ title: 'Något gick fel', description: 'Vi kunde inte spara äggen just nu. Kontrollera anslutningen och försök igen.', variant: 'destructive' }),
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
    (hens as any[]).forEach((h: any) => { map[h.id] = h.name; });
    return map;
  }, [hens]);

  const henFlockMap = useMemo(() => {
    const map: Record<string, string> = {};
    (hens as any[]).forEach((h: any) => { if (h.flock_id) map[h.id] = h.flock_id; });
    return map;
  }, [hens]);

  const flockNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (flocks as any[]).forEach((f: any) => { map[f.id] = f.name; });
    return map;
  }, [flocks]);

  const resolveFlockName = (e: any) => {
    if (e.flock_id) return flockNameMap[e.flock_id] || '';
    if (e.hen_id && henFlockMap[e.hen_id]) return flockNameMap[henFlockMap[e.hen_id]] || '';
    return '';
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayEggs = eggs.filter((e: any) => e.date === todayStr).reduce((s: number, e: any) => s + (e.count || 0), 0);
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekEggs = eggs.filter((e: any) => new Date(e.date) >= weekAgo).reduce((s: number, e: any) => s + (e.count || 0), 0);
  const monthEggs = eggs.filter((e: any) => new Date(e.date).getMonth() === new Date().getMonth()).reduce((s: number, e: any) => s + (e.count || 0), 0);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
        <Skeleton className="h-60" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Äggloggning 🥚</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Registrera dagens ägg snabbt och följ utvecklingen över tid</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {eggs.length > 0 && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                const rows = eggs.map((e: any) => ({
                  Datum: e.date,
                  Antal: e.count,
                  Flock: resolveFlockName(e),
                  Höna: e.hen_id ? henNameMap[e.hen_id] || '' : '',
                  Anteckningar: e.notes || '',
                }));
                downloadCSV(rows, `agglogg-${todayStr}`);
              }}>
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                downloadPDF(
                  'Ägglogg',
                  ['Datum', 'Antal', 'Flock', 'Höna', 'Anteckningar'],
                  eggs.map((e: any) => [e.date, String(e.count), resolveFlockName(e), e.hen_id ? henNameMap[e.hen_id] || '' : '', e.notes || '']),
                  'agglogg'
                );
              }}>
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
            </>
          )}
          <Button onClick={() => setShowForm(!showForm)} className="gap-2 active:scale-95 transition-transform flex-1 sm:flex-initial">
            <Plus className="h-4 w-4" />
            Logga ägg
          </Button>
        </div>
      </div>

      {showForm && (
        <EggForm
          activeHens={activeHens}
          flocks={flocks as any[]}
          isPending={createMutation.isPending}
          onSubmit={(data) => createMutation.mutate(data)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {eggs.length === 0 && !showForm ? (
        <EmptyState
          icon={EggIcon}
          title="Inga ägg loggade ännu"
          description="Börja med dagens ägg så kan Hönsgården visa veckosammanfattning, trender och statistik över tid. Det tar bara några sekunder."
          actionLabel="Logga dagens ägg"
          onAction={() => setShowForm(true)}
          secondaryLabel="Lägg till höna först"
          onSecondaryAction={() => window.location.assign('/app/hens')}
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {[
              { label: 'Idag', value: todayEggs },
              { label: 'Denna vecka', value: weekEggs },
              { label: 'Denna månad', value: monthEggs },
            ].map((s) => (
              <Card key={s.label} className="bg-card border-border shadow-sm">
                <CardContent className="p-3 sm:p-4 text-center">
                  <p className="stat-number text-xl sm:text-2xl text-foreground">{s.value}</p>
                  <p className="data-label mt-1 text-[10px] sm:text-xs">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="px-4 sm:px-6 flex flex-row items-center justify-between">
              <CardTitle className="text-base sm:text-lg font-serif">Senaste registreringar</CardTitle>
              <div className="flex gap-1">
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'grouped' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  aria-label="Grupperad vy"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  aria-label="Listvy"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
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
            </CardContent>
          </Card>
        </>
      )}

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
