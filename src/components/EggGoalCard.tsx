import { useEffect, useMemo, useState } from 'react';
import { todayLocal } from '@/lib/datetime';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, Egg, Save, TrendingUp, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { getSyncedEggGoal, saveSyncedEggGoal } from '@/lib/syncedProductState';
import { toast } from '@/hooks/use-toast';

function todayString() {
  return todayLocal();
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function monthStart() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function progress(value: number, goal: number) {
  if (!goal) return 0;
  return Math.min(100, Math.round((value / goal) * 100));
}

export default function EggGoalCard({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: syncedGoal, isLoading: goalLoading } = useQuery({
    queryKey: ['egg-goal'],
    queryFn: getSyncedEggGoal,
    staleTime: 30_000,
  });

  const [daily, setDaily] = useState('');
  const [weekly, setWeekly] = useState('');
  const [monthly, setMonthly] = useState('');

  useEffect(() => {
    if (!syncedGoal) return;
    setDaily(String(syncedGoal.daily || ''));
    setWeekly(String(syncedGoal.weekly || ''));
    setMonthly(String(syncedGoal.monthly || ''));
  }, [syncedGoal]);

  const { data: eggs = [] } = useQuery({ queryKey: ['eggs'], queryFn: () => api.getEggs().catch(() => []) });

  const stats = useMemo(() => {
    const today = todayString();
    const weekStart = daysAgo(7);
    const month = monthStart();
    const list = eggs as any[];
    return {
      today: list.filter((e) => e.date === today).reduce((sum, e) => sum + (e.count || 0), 0),
      week: list.filter((e) => new Date(e.date) >= weekStart).reduce((sum, e) => sum + (e.count || 0), 0),
      month: list.filter((e) => new Date(e.date) >= month).reduce((sum, e) => sum + (e.count || 0), 0),
    };
  }, [eggs]);

  const goals = {
    daily: Number(daily) || 0,
    weekly: Number(weekly) || 0,
    monthly: Number(monthly) || 0,
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveSyncedEggGoal({ ...goals, updatedAt: new Date().toISOString() });
      await queryClient.invalidateQueries({ queryKey: ['egg-goal'] });
      setEditing(false);
      toast({ title: 'Äggmålen är sparade 🥚', description: 'Målen synkas nu mellan mobil, dator och surfplatta.' });
    } catch (err: any) {
      toast({ title: 'Kunde inte spara äggmål', description: err?.message || 'Försök igen om en stund.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    { label: 'Idag', value: stats.today, goal: goals.daily },
    { label: '7 dagar', value: stats.week, goal: goals.weekly },
    { label: 'Månad', value: stats.month, goal: goals.monthly },
  ];
  const hasGoal = rows.some((r) => r.goal > 0);

  return (
    <Card className="border-border/50 shadow-sm bg-card">
      <CardContent className={compact ? 'p-4' : 'p-4 sm:p-5'}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="data-label mb-1">Äggmål</p>
              <h2 className="font-serif text-lg text-foreground">Följ din progress</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                Sätt mål för dag, vecka och månad. Målen synkas mellan dina enheter.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={() => setEditing(!editing)} disabled={goalLoading}>
            {goalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Stäng' : hasGoal ? 'Ändra' : 'Sätt mål'}
          </Button>
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Mål per dag</span>
                <Input inputMode="numeric" type="number" min="0" value={daily} onChange={(e) => setDaily(e.target.value)} className="rounded-xl h-11" placeholder="T.ex. 50" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Mål per vecka</span>
                <Input inputMode="numeric" type="number" min="0" value={weekly} onChange={(e) => setWeekly(e.target.value)} className="rounded-xl h-11" placeholder="T.ex. 350" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Mål per månad</span>
                <Input inputMode="numeric" type="number" min="0" value={monthly} onChange={(e) => setMonthly(e.target.value)} className="rounded-xl h-11" placeholder="T.ex. 1500" />
              </label>
            </div>
            <Button className="rounded-xl gap-2 w-full sm:w-auto" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Spara äggmål
            </Button>
          </div>
        ) : hasGoal ? (
          <div className="space-y-3">
            {rows.filter((r) => r.goal > 0).map((row) => {
              const pct = progress(row.value, row.goal);
              return (
                <div key={row.label} className="rounded-2xl bg-muted/20 border border-border/40 p-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Egg className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium text-foreground">{row.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{row.value}/{row.goal} ägg</span>
                  </div>
                  <div className="h-2 rounded-full bg-background overflow-hidden border border-border/30">
                    <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">{pct >= 100 ? 'Målet är nått. Snyggt jobbat!' : `${pct}% av målet`}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="w-full rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-center hover:bg-muted/30 transition-colors active:scale-[0.99]">
            <TrendingUp className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="font-serif text-base text-foreground">Sätt ditt första äggmål</p>
            <p className="text-sm text-muted-foreground mt-1">Till exempel 300 ägg i månaden eller 50 ägg per dag.</p>
          </button>
        )}
      </CardContent>
    </Card>
  );
}
