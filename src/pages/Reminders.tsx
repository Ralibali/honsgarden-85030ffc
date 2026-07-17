import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Syringe, Bug, Stethoscope, Wheat, Brush as Broom, Check, Bell, AlertTriangle, Loader2, Trash2, Archive } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PremiumGate } from '@/components/PremiumGate';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import PageHeader from '@/components/PageHeader';

type ReminderType = 'vaccination' | 'deworming' | 'vet' | 'feed' | 'cleaning' | 'other';
type ReminderStatus = 'upcoming' | 'overdue' | 'done' | 'archived';
type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface ReminderRow {
  id: string;
  user_id: string;
  hen_id: string | null;
  flock_id: string | null;
  title: string;
  notes: string | null;
  reminder_type: ReminderType;
  recurrence: Recurrence;
  due_date: string;
  status: ReminderStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const typeConfig: Record<ReminderType, { icon: any; label: string; color: string }> = {
  vaccination: { icon: Syringe, label: 'Vaccination', color: 'text-primary' },
  deworming: { icon: Bug, label: 'Avmaskning', color: 'text-warning' },
  vet: { icon: Stethoscope, label: 'Veterinär', color: 'text-destructive' },
  feed: { icon: Wheat, label: 'Foder', color: 'text-success' },
  cleaning: { icon: Broom, label: 'Städ', color: 'text-muted-foreground' },
  other: { icon: Bell, label: 'Övrigt', color: 'text-muted-foreground' },
};

const recurrenceLabels: Record<Recurrence, string> = {
  none: 'Ingen upprepning',
  daily: 'Dagligen',
  weekly: 'Varje vecka',
  monthly: 'Varje månad',
  quarterly: 'Varje kvartal',
  yearly: 'Varje år',
};

function daysUntil(dateStr: string) {
  const due = new Date(dateStr);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function addToDate(dateStr: string, recurrence: Recurrence): string {
  const d = new Date(dateStr);
  switch (recurrence) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
    default: return dateStr;
  }
  return d.toISOString().split('T')[0];
}

export default function Reminders() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<ReminderType>('vaccination');
  const [newDate, setNewDate] = useState('');
  const [newRecurrence, setNewRecurrence] = useState<Recurrence>('none');
  const [newHenId, setNewHenId] = useState<string>('none');
  const [newFlockId, setNewFlockId] = useState<string>('none');
  const [newNotes, setNewNotes] = useState('');

  const { data: hens = [] } = useQuery({ queryKey: ['hens'], queryFn: () => api.getHens(), staleTime: 60_000 });
  const { data: flocks = [] } = useQuery({ queryKey: ['flocks'], queryFn: () => api.getFlocks(), staleTime: 60_000 });

  const { data: reminders = [], isLoading } = useQuery<ReminderRow[]>({
    queryKey: ['reminders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .neq('status', 'archived')
        .order('due_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReminderRow[];
    },
  });

  const upcoming = useMemo(
    () => reminders.filter((r) => r.status === 'upcoming' || r.status === 'overdue'),
    [reminders]
  );
  const doneList = useMemo(() => reminders.filter((r) => r.status === 'done'), [reminders]);
  const urgent = upcoming.filter((r) => daysUntil(r.due_date) <= 3);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Ej inloggad');
      const overdue = daysUntil(newDate) < 0;
      const { error } = await supabase.from('reminders').insert({
        user_id: user.id,
        title: newTitle.trim(),
        notes: newNotes.trim() || null,
        reminder_type: newType,
        recurrence: newRecurrence,
        due_date: newDate,
        status: overdue ? 'overdue' : 'upcoming',
        hen_id: newHenId === 'none' ? null : newHenId,
        flock_id: newFlockId === 'none' ? null : newFlockId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast({ title: 'Påminnelse sparad! 🔔' });
      setNewTitle(''); setNewDate(''); setNewType('vaccination'); setNewRecurrence('none');
      setNewHenId('none'); setNewFlockId('none'); setNewNotes('');
      setOpen(false);
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const completeMutation = useMutation({
    mutationFn: async (r: ReminderRow) => {
      if (r.status === 'done') {
        // Undo
        const { error } = await supabase.from('reminders')
          .update({ status: daysUntil(r.due_date) < 0 ? 'overdue' : 'upcoming', completed_at: null })
          .eq('id', r.id);
        if (error) throw error;
      } else {
        // Mark done. If recurring, also insert next occurrence.
        const { error } = await supabase.from('reminders')
          .update({ status: 'done', completed_at: new Date().toISOString() })
          .eq('id', r.id);
        if (error) throw error;
        if (r.recurrence !== 'none' && user?.id) {
          const nextDate = addToDate(r.due_date, r.recurrence);
          await supabase.from('reminders').insert({
            user_id: user.id,
            title: r.title,
            notes: r.notes,
            reminder_type: r.reminder_type,
            recurrence: r.recurrence,
            due_date: nextDate,
            status: 'upcoming',
            hen_id: r.hen_id,
            flock_id: r.flock_id,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reminders').update({ status: 'archived' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast({ title: 'Arkiverad' });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reminders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast({ title: 'Påminnelse borttagen' });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const handleAdd = () => {
    if (!newTitle.trim() || !newDate) return;
    createMutation.mutate();
  };

  const renderRow = (r: ReminderRow, completed = false) => {
    const config = typeConfig[r.reminder_type] ?? typeConfig.other;
    const days = daysUntil(r.due_date);
    const hen = (hens as any[]).find((h) => h.id === r.hen_id);
    const flock = (flocks as any[]).find((f) => f.id === r.flock_id);
    const contextLabel = hen ? `· ${hen.name}` : flock ? `· ${flock.name}` : '';
    const isMutating = completeMutation.isPending || deleteMutation.isPending;
    const Icon = config.icon;

    return (
      <div key={r.id} className={`flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-secondary/50 transition-colors group ${completed ? 'opacity-70' : ''}`}>
        <button
          onClick={() => completeMutation.mutate(r)}
          disabled={isMutating}
          className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${completed ? 'bg-success/20 border-success' : 'border-border hover:border-primary'}`}
          aria-label={completed ? 'Markera som ej klar' : 'Markera som klar'}
        >
          {completed && <Check className="h-3 w-3 text-success" />}
        </button>
        <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs sm:text-sm font-medium text-foreground truncate ${completed ? 'line-through' : ''}`}>{r.title}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
            {r.due_date} · {config.label}{r.recurrence !== 'none' ? ` · ${recurrenceLabels[r.recurrence]}` : ''} {contextLabel}
          </p>
        </div>
        {!completed && (
          <Badge variant={days < 0 ? 'destructive' : days <= 3 ? 'destructive' : days <= 7 ? 'default' : 'secondary'} className="text-[10px] shrink-0">
            {days < 0 ? `${Math.abs(days)} dagar sen` : days === 0 ? 'Idag' : `${days} dagar`}
          </Badge>
        )}
        {completed ? (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => archiveMutation.mutate(r.id)} aria-label="Arkivera">
            <Archive className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            onClick={() => { if (confirm(`Ta bort påminnelsen "${r.title}"?`)) deleteMutation.mutate(r.id); }}
            disabled={deleteMutation.isPending}
            aria-label="Ta bort påminnelse">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Påminnelser"
        emoji="💉"
        subtitle="Spara och följ upp avmaskning, vaccination, veterinärbesök och andra viktiga händelser"
        actions={<Button className="gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Ny påminnelse</Button>}
      />
      <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">Ny påminnelse</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>Titel</Label>
                <Input className="mt-1.5" placeholder="T.ex. Avmaskning – alla hönor" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </div>
              <div>
                <Label>Typ</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as ReminderType)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vaccination">💉 Vaccination</SelectItem>
                    <SelectItem value="deworming">🐛 Avmaskning</SelectItem>
                    <SelectItem value="vet">🩺 Veterinär</SelectItem>
                    <SelectItem value="feed">🌾 Foder</SelectItem>
                    <SelectItem value="cleaning">🧹 Städ</SelectItem>
                    <SelectItem value="other">🔔 Övrigt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Datum</Label>
                  <Input className="mt-1.5" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </div>
                <div>
                  <Label>Upprepning</Label>
                  <Select value={newRecurrence} onValueChange={(v) => setNewRecurrence(v as Recurrence)}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen upprepning</SelectItem>
                      <SelectItem value="weekly">Varje vecka</SelectItem>
                      <SelectItem value="monthly">Varje månad</SelectItem>
                      <SelectItem value="quarterly">Varje kvartal</SelectItem>
                      <SelectItem value="yearly">Varje år</SelectItem>
                      <SelectItem value="daily">Dagligen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Koppla till höna (valfritt)</Label>
                  <Select value={newHenId} onValueChange={setNewHenId}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Ingen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Ingen —</SelectItem>
                      {(hens as any[]).map((h) => (
                        <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Koppla till flock (valfritt)</Label>
                  <Select value={newFlockId} onValueChange={setNewFlockId}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Ingen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Ingen —</SelectItem>
                      {(flocks as any[]).map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Anteckningar</Label>
                <Textarea className="mt-1.5" placeholder="Valfritt" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleAdd} disabled={createMutation.isPending || !newTitle.trim() || !newDate}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Spara påminnelse
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      <PremiumGate soft feature="push-notiser & hälsohistorik" featureKey="reminders">
        <div />
      </PremiumGate>

      {urgent.length > 0 && (
        <Card className="bg-destructive/5 border-destructive/30 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="font-serif text-sm text-destructive">Behöver uppmärksamhet</span>
            </div>
            {urgent.map((r) => {
              const days = daysUntil(r.due_date);
              return (
                <p key={r.id} className="text-sm text-foreground">
                  <strong>{r.title}</strong> – {r.due_date} ({days < 0 ? `${Math.abs(days)} dagar sen` : days === 0 ? 'idag' : `om ${days} dagar`})
                </p>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">Kommande ({upcoming.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {upcoming.map((r) => renderRow(r))}
            {upcoming.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Inga kommande påminnelser ännu. Lägg till en för vaccination, avmaskning, veterinärbesök eller annat viktigt.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg text-muted-foreground">Klara ({doneList.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {doneList.map((r) => renderRow(r, true))}
            {doneList.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">Inga påminnelser markerade som klara ännu</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
