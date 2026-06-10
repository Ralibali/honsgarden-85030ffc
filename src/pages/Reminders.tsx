import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Syringe, Bug, Stethoscope, Check, Bell, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PremiumGate } from '@/components/PremiumGate';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createChore, deleteChore, getDailyChores, completeChore, uncompleteChore } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface ReminderViewModel {
  id: string;
  title: string;
  type: 'vaccination' | 'deworming' | 'vet' | 'other';
  date: string;
  done: boolean;
  recurrence?: string | null;
  raw: any;
}

const REMINDER_PREFIX = 'REMINDER_TYPE:';

const typeConfig = {
  vaccination: { icon: Syringe, label: 'Vaccination', color: 'text-primary' },
  deworming: { icon: Bug, label: 'Avmaskning', color: 'text-warning' },
  vet: { icon: Stethoscope, label: 'Veterinär', color: 'text-destructive' },
  other: { icon: Bell, label: 'Övrigt', color: 'text-muted-foreground' },
};

const recurrenceLabels: Record<string, string> = {
  none: 'Ingen upprepning',
  daily: 'Dagligen',
  weekly: 'Varje vecka',
  monthly: 'Varje månad',
};

function daysUntil(dateStr: string) {
  const due = new Date(dateStr);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function parseReminderType(description?: string | null): ReminderViewModel['type'] {
  if (!description?.startsWith(REMINDER_PREFIX)) return 'other';
  const firstLine = description.split('\n')[0];
  const type = firstLine.replace(REMINDER_PREFIX, '').trim();
  if (type === 'vaccination' || type === 'deworming' || type === 'vet' || type === 'other') return type;
  return 'other';
}

function toDateInputValue(value?: string | null) {
  if (!value) return '';
  return value.split('T')[0];
}

function mapChoreToReminder(chore: any): ReminderViewModel | null {
  if (!chore.reminder_enabled && !chore.description?.startsWith(REMINDER_PREFIX)) return null;
  const date = toDateInputValue(chore.next_due_at);
  if (!date) return null;

  return {
    id: chore.id,
    title: chore.title,
    type: parseReminderType(chore.description),
    date,
    done: Boolean(chore.completed),
    recurrence: chore.recurrence || 'none',
    raw: chore,
  };
}

export default function Reminders() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<ReminderViewModel['type']>('vaccination');
  const [newDate, setNewDate] = useState('');
  const [newRecurrence, setNewRecurrence] = useState('none');

  const { data: chores = [], isLoading } = useQuery({
    queryKey: ['daily-chores'],
    queryFn: getDailyChores,
  });

  const reminders = chores
    .map(mapChoreToReminder)
    .filter(Boolean) as ReminderViewModel[];

  const upcoming = reminders
    .filter(r => !r.done)
    .sort((a, b) => a.date.localeCompare(b.date));

  const completedToday = reminders
    .filter(r => r.done)
    .sort((a, b) => a.date.localeCompare(b.date));

  const urgent = upcoming.filter(r => {
    const days = daysUntil(r.date);
    return days <= 3;
  });

  const createMutation = useMutation({
    mutationFn: () => createChore(
      newTitle,
      `${REMINDER_PREFIX}${newType}`,
      {
        recurrence: newRecurrence,
        next_due_at: newDate,
        reminder_enabled: true,
        reminder_hours_before: 24,
      }
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-chores'] });
      toast({ title: 'Påminnelse sparad! 🔔' });
      setNewTitle('');
      setNewDate('');
      setNewType('vaccination');
      setNewRecurrence('none');
      setOpen(false);
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => done ? uncompleteChore(id) : completeChore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-chores'] });
      toast({ title: 'Påminnelse uppdaterad' });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-chores'] });
      toast({ title: 'Påminnelse borttagen' });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const handleAdd = () => {
    if (!newTitle.trim() || !newDate) return;
    createMutation.mutate();
  };

  const renderReminderRow = (r: ReminderViewModel, completed = false) => {
    const config = typeConfig[r.type];
    const days = daysUntil(r.date);
    const isMutating = completeMutation.isPending || deleteMutation.isPending;

    return (
      <div key={r.id} className={`flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-secondary/50 transition-colors group ${completed ? 'opacity-70' : ''}`}>
        <button
          onClick={() => completeMutation.mutate({ id: r.id, done: r.done })}
          disabled={isMutating}
          className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${completed ? 'bg-success/20 border-success' : 'border-border hover:border-primary'}`}
          aria-label={completed ? 'Markera som ej klar' : 'Markera som klar'}
        >
          {completed && <Check className="h-3 w-3 text-success" />}
        </button>
        <config.icon className={`h-4 w-4 shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs sm:text-sm font-medium text-foreground truncate ${completed ? 'line-through' : ''}`}>{r.title}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            {r.date} · {config.label}{r.recurrence && r.recurrence !== 'none' ? ` · ${recurrenceLabels[r.recurrence] || r.recurrence}` : ''}
          </p>
        </div>
        {!completed && (
          <Badge variant={days < 0 ? 'destructive' : days <= 3 ? 'destructive' : days <= 7 ? 'default' : 'secondary'} className="text-[10px] shrink-0">
            {days < 0 ? `${Math.abs(days)} dagar sen` : days === 0 ? 'Idag' : `${days} dagar`}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={() => {
            if (confirm(`Ta bort påminnelsen "${r.title}"?`)) deleteMutation.mutate(r.id);
          }}
          disabled={deleteMutation.isPending}
          aria-label="Ta bort påminnelse"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Påminnelser 💉</h1>
          <p className="text-sm text-muted-foreground mt-1">Spara och följ upp avmaskning, vaccination, veterinärbesök och andra viktiga händelser</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Ny påminnelse
            </Button>
          </DialogTrigger>
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
                <Select value={newType} onValueChange={(value) => setNewType(value as ReminderViewModel['type'])}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vaccination">💉 Vaccination</SelectItem>
                    <SelectItem value="deworming">🐛 Avmaskning</SelectItem>
                    <SelectItem value="vet">🩺 Veterinär</SelectItem>
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
                  <Select value={newRecurrence} onValueChange={setNewRecurrence}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen upprepning</SelectItem>
                      <SelectItem value="weekly">Varje vecka</SelectItem>
                      <SelectItem value="monthly">Varje månad</SelectItem>
                      <SelectItem value="daily">Dagligen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full" onClick={handleAdd} disabled={createMutation.isPending || !newTitle.trim() || !newDate}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Spara påminnelse
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
            {urgent.map(r => {
              const days = daysUntil(r.date);
              return (
                <p key={r.id} className="text-sm text-foreground">
                  <strong>{r.title}</strong> – {r.date} ({days < 0 ? `${Math.abs(days)} dagar sen` : days === 0 ? 'idag' : `om ${days} dagar`})
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
            {upcoming.map(r => renderReminderRow(r))}
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
          <CardTitle className="font-serif text-base sm:text-lg text-muted-foreground">Klara idag ({completedToday.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {completedToday.map(r => renderReminderRow(r, true))}
            {completedToday.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">Inga påminnelser markerade som klara idag</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
