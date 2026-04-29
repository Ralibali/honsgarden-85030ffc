import React, { useState, useCallback } from 'react';
import { Egg, Plus, Minus, Check, X, CalendarMinus, Bird } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EggSuccessAnimation } from './EggSuccessAnimation';
import DashboardFocusPortal from './DashboardFocusPortal';
import SettingsTrustPortal from './SettingsTrustPortal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { readScoped, writeScoped } from '@/lib/userScopedStorage';

const LAST_HEN_KEY = 'honsgarden-last-hen';

export function QuickEggFAB() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [selectedHenId, setSelectedHenId] = useState<string>(() => readScoped(user?.id, LAST_HEN_KEY) || 'all');
  const [showAnimation, setShowAnimation] = useState(false);
  const [animCount, setAnimCount] = useState(0);
  const [useYesterday, setUseYesterday] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  const handleAnimationDone = useCallback(() => {
    setShowAnimation(false);
    toast({ title: `🥚 ${animCount} ägg registrerade!${useYesterday ? ' (igår)' : ''}` });
  }, [animCount, useYesterday]);

  const activeHens = (hens as any[]).filter((h: any) => h.is_active && h.hen_type !== 'rooster');
  const hasHens = activeHens.length > 0;

  const mutation = useMutation({
    mutationFn: ({ count, hen_id, flock_id }: { count: number; hen_id?: string; flock_id?: string }) => {
      const date = useYesterday
        ? new Date(Date.now() - 86400000).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      return api.createEggRecord({
        date,
        count,
        hen_id: hen_id || undefined,
        flock_id: flock_id || undefined,
      });
    },
    onMutate: async ({ count }) => {
      await queryClient.cancelQueries({ queryKey: ['eggs'] });
      const prev = queryClient.getQueryData(['eggs']);
      queryClient.setQueryData(['eggs'], (old: any[]) => {
        if (!old) return old;
        const date = useYesterday
          ? new Date(Date.now() - 86400000).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
        return [...old, { date, count, id: `temp-${Date.now()}`, hen_id: null, flock_id: null }];
      });
      return { prev };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eggs'] });
      setAnimCount(count);
      setShowAnimation(true);
      setOpen(false);
      setCount(1);
      setUseYesterday(false);
      writeScoped(user?.id, LAST_HEN_KEY, selectedHenId);
    },
    onError: (err: any, _, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['eggs'], ctx.prev);
      toast({ title: 'Fel', description: err.message, variant: 'destructive' });
    },
  });

  const handleSave = () => {
    const isFlockSelection = selectedHenId.startsWith('flock:');
    const hen_id = !isFlockSelection && selectedHenId !== 'all' ? selectedHenId : undefined;
    const flock_id = isFlockSelection ? selectedHenId.replace('flock:', '') : undefined;
    mutation.mutate({ count, hen_id, flock_id });
  };

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'e' && !e.metaKey && !e.ctrlKey && !e.altKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <DashboardFocusPortal />
      <SettingsTrustPortal />

      {open && <div className="fixed inset-0 z-[60] bg-foreground/20 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />}

      {open && (
        <div className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:w-80 z-[70] animate-fade-in">
          <div className="bg-card border border-border/60 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center"><Egg className="h-4 w-4 text-primary" /></div>
                <h3 className="font-serif text-sm text-foreground">Snabbregistrering</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            {!hasHens ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                    <Bird className="h-5 w-5 text-primary" />
                  </div>
                  <p className="font-serif text-base text-foreground">Lägg till din första höna först</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Då kan Hönsgården koppla äggloggar till flocken och visa bättre statistik per höna.
                  </p>
                </div>
                <Button
                  className="w-full h-11 text-sm font-semibold gap-2 rounded-xl"
                  onClick={() => {
                    setOpen(false);
                    navigate('/app/hens');
                  }}
                >
                  <Plus className="h-4 w-4" /> Lägg till höna
                </Button>
                <button
                  onClick={() => setOpen(false)}
                  className="w-full text-center text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  Stäng
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-xl bg-primary/5 border border-primary/10 px-3 py-2">
                  <p className="text-[11px] text-primary font-medium">Tips: tryck E på tangentbordet för att öppna snabbregistrering.</p>
                </div>

                <div className="flex items-center justify-center gap-4">
                  <button onClick={() => setCount(Math.max(1, count - 1))} className="w-12 h-12 rounded-full border-2 border-border hover:border-primary flex items-center justify-center transition-colors active:scale-95"><Minus className="h-5 w-5 text-muted-foreground" /></button>
                  <div className="text-center min-w-[80px]"><p className="text-4xl font-bold text-foreground tabular-nums">{count}</p><p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">ägg</p></div>
                  <button onClick={() => setCount(count + 1)} className="w-12 h-12 rounded-full border-2 border-border hover:border-primary flex items-center justify-center transition-colors active:scale-95"><Plus className="h-5 w-5 text-muted-foreground" /></button>
                </div>

                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 5, 8].map((n) => (
                    <button key={n} onClick={() => setCount(n)} className={`min-w-[44px] min-h-[44px] rounded-full text-xs font-semibold transition-all active:scale-90 ${count === n ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}>{n}</button>
                  ))}
                </div>

                <button onClick={() => setUseYesterday(!useYesterday)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${useYesterday ? 'bg-accent/10 border border-accent/30 text-accent' : 'bg-muted/40 border border-border/30 text-muted-foreground hover:bg-muted/60'}`}>
                  <CalendarMinus className="h-3.5 w-3.5" />{useYesterday ? 'Loggar för igår ✓' : 'Logga igår istället'}
                </button>

                {(activeHens.length > 0 || (flocks as any[]).length > 0) && (
                  <Select value={selectedHenId} onValueChange={setSelectedHenId}>
                    <SelectTrigger className="h-9 text-xs rounded-xl border-border/50"><SelectValue placeholder="Alla (generellt)" /></SelectTrigger>
                    <SelectContent className="z-[90]">
                      <SelectItem value="all">🥚 Alla (generellt)</SelectItem>
                      {(flocks as any[]).map((flock: any) => {
                        const flockHens = activeHens.filter((h: any) => h.flock_id === flock.id);
                        return <SelectItem key={flock.id} value={`flock:${flock.id}`}><span className="font-semibold">👥 {flock.name}</span><span className="text-muted-foreground ml-1 text-[10px]">({flockHens.length} höns)</span></SelectItem>;
                      })}
                      {activeHens.filter((h: any) => !h.flock_id).length > 0 && <><div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t border-border/30 mt-1 pt-2">Utan flock</div>{activeHens.filter((h: any) => !h.flock_id).map((hen: any) => <SelectItem key={hen.id} value={hen.id}>🐔 {hen.name}</SelectItem>)}</>}
                    </SelectContent>
                  </Select>
                )}

                <Button className="w-full h-11 text-sm font-semibold gap-2 rounded-xl" onClick={handleSave} disabled={mutation.isPending}>
                  <Check className="h-4 w-4" />Logga {count} ägg{useYesterday ? ' från igår' : ' idag'}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[35] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 animate-fade-in" aria-label="Registrera ägg (E)">
          <div className="relative"><Egg className="h-6 w-6" /><Plus className="h-3 w-3 absolute -top-1 -right-1.5 bg-primary-foreground text-primary rounded-full" /></div>
        </button>
      )}

      <EggSuccessAnimation show={showAnimation} count={animCount} onDone={handleAnimationDone} />
    </>
  );
}
