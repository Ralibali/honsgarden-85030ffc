import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Target, Plus, Pencil, Trash2, Trophy, Flame, TrendingUp, Egg } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, format } from 'date-fns';

interface EggGoalsWidgetProps {
  eggs: any[];
}

function sumEggsBetween(eggs: any[], start: Date, end: Date) {
  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');
  return eggs
    .filter((e: any) => e.date >= startStr && e.date <= endStr)
    .reduce((s: number, e: any) => s + (e.count || 0), 0);
}

export default function EggGoalsWidget({ eggs }: EggGoalsWidgetProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<any>(null);
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [targetCount, setTargetCount] = useState(7);

  const { data: goals = [] } = useQuery({
    queryKey: ['egg-goals'],
    queryFn: () => api.getEggGoals(),
    staleTime: 60_000,
  });

  const upsertMutation = useMutation({
    mutationFn: (goal: { period: string; target_count: number; id?: string }) => api.upsertEggGoal(goal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['egg-goals'] });
      toast({ title: '🎯 Mål sparat!' });
      setDialogOpen(false);
      setEditGoal(null);
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteEggGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['egg-goals'] });
      toast({ title: 'Mål borttaget' });
    },
  });

  const activeGoals = goals.filter((g: any) => g.is_active);

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subDays(now, 7), { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const weekCount = sumEggsBetween(eggs, weekStart, weekEnd);
  const lastWeekCount = sumEggsBetween(eggs, lastWeekStart, lastWeekEnd);
  const monthCount = sumEggsBetween(eggs, monthStart, monthEnd);
  const weekDiff = weekCount - lastWeekCount;
  const avgPerDayThisWeek = Math.round((weekCount / Math.max(1, now.getDay() === 0 ? 7 : now.getDay())) * 10) / 10;

  const getProgress = (goal: any) => {
    const count = goal.period === 'weekly'
      ? weekCount
      : monthCount;
    const pct = Math.min(100, Math.round((count / goal.target_count) * 100));
    return { count, pct };
  };

  const handleOpenNew = () => {
    setEditGoal(null);
    setPeriod('weekly');
    setTargetCount(Math.max(7, Math.ceil(weekCount * 1.15) || 7));
    setDialogOpen(true);
  };

  const handleEdit = (goal: any) => {
    setEditGoal(goal);
    setPeriod(goal.period);
    setTargetCount(goal.target_count);
    setDialogOpen(true);
  };

  const handleSave = () => {
    upsertMutation.mutate({ period, target_count: targetCount, id: editGoal?.id });
  };

  const InsightSummary = () => (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-xl bg-primary/5 border border-primary/10 p-3 text-center">
        <Egg className="h-4 w-4 text-primary mx-auto mb-1" />
        <p className="text-lg font-bold tabular-nums text-foreground leading-none">{weekCount}</p>
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">veckan</p>
      </div>
      <div className="rounded-xl bg-muted/30 border border-border/40 p-3 text-center">
        <TrendingUp className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
        <p className="text-lg font-bold tabular-nums text-foreground leading-none">{avgPerDayThisWeek}</p>
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">ägg/dag</p>
      </div>
      <div className="rounded-xl bg-accent/5 border border-accent/10 p-3 text-center">
        <Flame className="h-4 w-4 text-accent mx-auto mb-1" />
        <p className="text-lg font-bold tabular-nums text-foreground leading-none">{weekDiff >= 0 ? '+' : ''}{weekDiff}</p>
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">mot förra</p>
      </div>
    </div>
  );

  if (activeGoals.length === 0) {
    return (
      <Card className="border-border/50 shadow-sm border-dashed">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/8 flex items-center justify-center shrink-0">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-serif text-sm text-foreground">Sätt ett äggmål</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Följ om produktionen ligger i fas och få en tydligare anledning att komma tillbaka varje dag.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleOpenNew} className="w-full rounded-xl gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Sätt veckomål
          </Button>
          <GoalDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            period={period}
            setPeriod={setPeriod}
            targetCount={targetCount}
            setTargetCount={setTargetCount}
            onSave={handleSave}
            isEdit={false}
            saving={upsertMutation.isPending}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="font-serif text-sm text-foreground">Äggmål & produktion</span>
            </div>
            <Button size="sm" variant="ghost" onClick={handleOpenNew} className="h-7 w-7 p-0 rounded-lg">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          <InsightSummary />

          <AnimatePresence>
            {activeGoals.map((goal: any) => {
              const { count, pct } = getProgress(goal);
              const isComplete = pct >= 100;
              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2 rounded-2xl border border-border/40 bg-muted/20 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-background">
                        {goal.period === 'weekly' ? 'Vecka' : 'Månad'}
                      </Badge>
                      {isComplete && <Trophy className="h-3.5 w-3.5 text-warning animate-pulse" />}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(goal)} className="p-1 rounded hover:bg-muted/70 text-muted-foreground">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(goal.id)} className="p-1 rounded hover:bg-muted/70 text-muted-foreground">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-end justify-between mb-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold tabular-nums text-foreground">{count}</span>
                      <span className="text-sm text-muted-foreground">/ {goal.target_count}</span>
                    </div>
                    <span className={`text-xs font-semibold tabular-nums ${isComplete ? 'text-primary' : 'text-muted-foreground'}`}>
                      {pct}%
                    </span>
                  </div>

                  <Progress value={pct} className="h-2.5 rounded-full" />

                  {isComplete ? (
                    <p className="text-xs text-primary flex items-center gap-1">
                      <Flame className="h-3 w-3" /> Mål uppnått – fantastiskt jobbat! 🎉
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {goal.target_count - count} ägg kvar till {goal.period === 'weekly' ? 'veckomålet' : 'månadsmålet'}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </CardContent>
      </Card>

      <GoalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        period={period}
        setPeriod={setPeriod}
        targetCount={targetCount}
        setTargetCount={setTargetCount}
        onSave={handleSave}
        isEdit={!!editGoal}
        saving={upsertMutation.isPending}
      />
    </>
  );
}

function GoalDialog({
  open, onOpenChange, period, setPeriod, targetCount, setTargetCount, onSave, isEdit, saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  period: 'weekly' | 'monthly';
  setPeriod: (v: 'weekly' | 'monthly') => void;
  targetCount: number;
  setTargetCount: (v: number) => void;
  onSave: () => void;
  isEdit: boolean;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif">{isEdit ? 'Redigera mål' : 'Nytt äggmål'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Period</label>
            <div className="grid grid-cols-2 gap-2">
              {(['weekly', 'monthly'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPeriod(p);
                    setTargetCount(p === 'weekly' ? 7 : 30);
                  }}
                  className={`py-2 rounded-xl text-sm font-medium transition-all border ${
                    period === p
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  {p === 'weekly' ? '📅 Vecka' : '🗓️ Månad'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Antal ägg</label>
            <Input
              type="number"
              min={1}
              max={999}
              value={targetCount}
              onChange={(e) => setTargetCount(parseInt(e.target.value) || 1)}
              className="rounded-xl text-center text-lg font-semibold"
            />
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              {period === 'weekly'
                ? `≈ ${Math.round(targetCount / 7 * 10) / 10} ägg/dag`
                : `≈ ${Math.round(targetCount / 30 * 10) / 10} ägg/dag`
              }
            </p>
          </div>

          <Button onClick={onSave} disabled={saving} className="w-full rounded-xl gap-2">
            <Target className="h-4 w-4" />
            {isEdit ? 'Spara ändringar' : 'Sätt mål'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
