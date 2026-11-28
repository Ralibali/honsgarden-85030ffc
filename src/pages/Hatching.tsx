import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Egg, Thermometer, Droplets, RotateCcw, Trash2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { PremiumGate } from '@/components/PremiumGate';
import EmptyState from '@/components/EmptyState';
import AffiliateProductStrip from '@/components/affiliate/AffiliateProductStrip';
import HatchOutcome from '@/components/hen/HatchOutcome';
import { addDaysIso, daysBetweenIso } from '@/lib/isoDay';
import { todayLocal } from '@/lib/datetime';
import PageHeader from '@/components/PageHeader';

const milestones = [
  { day: 1, label: 'Start', emoji: '🥚' },
  { day: 7, label: 'Lysning', emoji: '🔦' },
  { day: 14, label: 'Lysning 2', emoji: '🔦' },
  { day: 18, label: 'Sluta vända', emoji: '🔄' },
  { day: 19, label: 'Öka fukt', emoji: '💧' },
  { day: 21, label: 'Kläckning!', emoji: '🐣' },
];

export default function Hatching() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newNotes, setNewNotes] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newCount, setNewCount] = useState('1');

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['hatching'],
    queryFn: () => api.getHatchings(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createHatching(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hatching'] });
      toast({ title: 'Kläckningen är startad! 🐣' });
      setOpen(false);
      setNewNotes(''); setNewDate(''); setNewCount('1');
    },
    onError: () => toast({ title: 'Något gick fel', description: 'Vi kunde inte starta kläckningen just nu. Kontrollera anslutningen och försök igen.', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteHatching(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hatching'] });
      toast({ title: 'Kläckningen är borttagen' });
    },
  });

  const handleAdd = () => {
    if (!newDate) return;
    const expectedHatch = addDaysIso(newDate,21);
    if (!expectedHatch || !Number.isInteger(Number(newCount)) || Number(newCount) < 1 || Number(newCount) > 1000) return;
    createMutation.mutate({
      start_date: newDate,
      egg_count: Number(newCount) || 1,
      notes: newNotes || null,
      expected_hatch_date: expectedHatch,
    });
  };

  if (isLoading) {
    return <div className="max-w-5xl mx-auto space-y-4 animate-fade-in"><Skeleton className="h-10 w-48" /><Skeleton className="h-40" /></div>;
  }

  return (
    <PremiumGate feature="Kläckning" featureKey="hatching" blur>
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Kläckning"
        emoji="🐣"
        subtitle="Följ dina ruvningar med 21-dagars nedräkning"
        actions={<Button className="gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Ny kläckning</Button>}
      />
      <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle className="font-serif">Starta ny kläckning</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>Namn eller anteckning</Label>
                <Input className="mt-1.5 rounded-xl" placeholder="T.ex. Vår-kull 2026" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
              </div>
              <div>
                <Label>Startdatum *</Label>
                <Input className="mt-1.5 rounded-xl" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
              </div>
              <div>
                <Label>Antal ägg</Label>
                <Input className="mt-1.5 rounded-xl" placeholder="T.ex. 12" type="number" min={1} max={1000} value={newCount} onChange={(e) => setNewCount(e.target.value)} />
              </div>
              <Button className="w-full rounded-xl" onClick={handleAdd} disabled={createMutation.isPending || !newDate || !Number.isInteger(Number(newCount)) || Number(newCount)<1 || Number(newCount)>1000}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Starta kläckning
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      <Card className="bg-warning/5 border-warning/20 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><Thermometer className="h-5 w-5 text-destructive mx-auto mb-1" /><p className="text-xs font-medium text-foreground">37.5°C</p><p className="text-[10px] text-muted-foreground">Temperatur</p></div>
            <div><Droplets className="h-5 w-5 text-primary mx-auto mb-1" /><p className="text-xs font-medium text-foreground">55-65%</p><p className="text-[10px] text-muted-foreground">Luftfuktighet</p></div>
            <div><RotateCcw className="h-5 w-5 text-accent mx-auto mb-1" /><p className="text-xs font-medium text-foreground">3-5x/dag</p><p className="text-[10px] text-muted-foreground">Vändning</p></div>
          </div>
        </CardContent>
      </Card>

      {batches.length === 0 ? (
        <EmptyState
          icon={Egg}
          title="Ingen kläckning pågår ännu"
          description="Starta en kläckning när du lägger ägg i maskin eller under höna. Hönsgården hjälper dig hålla koll på dag 7, dag 14, vändning, fukt och beräknad kläckning."
          actionLabel="Starta ny kläckning"
          onAction={() => setOpen(true)}
          secondaryLabel="Gå till hönor"
          onSecondaryAction={() => window.location.assign('/app/hens')}
        />
      ) : (
        batches.map((batch) => {
          const batchId = batch.id;
          const startDate = batch.start_date;
          const elapsed = Math.max(0, daysBetweenIso(startDate,todayLocal()) ?? 0);
          const remaining = daysBetweenIso(todayLocal(),batch.expected_hatch_date || addDaysIso(startDate,21)!) ?? 0;
          const progress = Math.min(100,elapsed / 21 * 100);
          const done = ['hatched', 'completed'].includes(batch.status ?? '') || !!batch.outcome_date;
          const resultLabel = done ? (batch.hatched_count == null ? 'Avslutad kläckning' : batch.hatched_count + ' kläckta kycklingar')
            : remaining <= 0 ? 'Beräknad kläckdag nådd' : remaining + ' dagar kvar';
          return (
            <Card key={batchId} className={`bg-card border-border shadow-sm ${done ? 'border-success/50' : ''}`}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-serif text-base text-foreground flex items-center gap-2 break-words">
                      {done ? '🐣' : '🥚'} {batch.notes || `Kläckning ${startDate}`}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{batch.egg_count} ägg · Startade {startDate}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-muted-foreground h-8 w-8 p-0 shrink-0" onClick={() => deleteMutation.mutate(batchId)} aria-label="Ta bort kläckning">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Dag {Math.min(elapsed, 21)} av 21</span>
                    <span className={`font-medium ${done ? 'text-success' : 'text-primary'}`}>
                      {resultLabel}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2.5" />
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {milestones.map((m) => {
                    const reached = m.day === 21 ? done : elapsed >= m.day;
                    const isCurrent = elapsed >= m.day - 1 && elapsed < m.day;
                    return (
                      <div key={m.day} className={`text-center p-1.5 rounded-lg text-[10px] transition-colors ${reached ? 'bg-success/10 text-success' : isCurrent ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'bg-muted/50 text-muted-foreground'}`}>
                        <span className="text-sm">{reached ? '✅' : m.emoji}</span>
                        <p className="mt-0.5 leading-tight">Dag {m.day}</p>
                      </div>
                    );
                  })}
                </div>
                {!done && batch.status === 'incubating' && <HatchOutcome batch={batch}/>}
              </CardContent>
            </Card>
          );
        })
      )}
      <AffiliateProductStrip category="klackning" title="Kläckningsutrustning" />
    </div>
    </PremiumGate>
  );
}

