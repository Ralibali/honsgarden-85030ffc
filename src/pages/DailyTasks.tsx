import React, { useState } from 'react';
import { todayLocal } from '@/lib/datetime';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Check, Plus, Trash2, Sparkles, ChevronRight, ChevronDown, Clock, AlertTriangle, CalendarDays } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { PremiumGate } from '@/components/PremiumGate';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/PageHeader';

const SUGGESTED_CHORES = [
  { title: 'Samla ägg', description: 'Kolla boet och plocka dagens ägg', emoji: '🥚' },
  { title: 'Fyll på vatten', description: 'Se till att vattenskålarna är fulla och rena', emoji: '💧' },
  { title: 'Fyll på foder', description: 'Kontrollera foderbehållarna', emoji: '🌾' },
  { title: 'Stäng luckan', description: 'Stäng hönsluckan på kvällen för säkerheten', emoji: '🌙' },
  { title: 'Öppna luckan', description: 'Öppna luckan på morgonen så hönsen kommer ut', emoji: '☀️' },
  { title: 'Kontrollera hälsa', description: 'Snabb koll att alla hönor mår bra', emoji: '❤️' },
  { title: 'Rengör hönshuset', description: 'Byt strö och rengör ströbädden', emoji: '🧹' },
  { title: 'Kontrollera stängslet', description: 'Se till att inhägnaden är hel och säker', emoji: '🔒' },
];

const RECURRENCE_LABELS: Record<string, string> = {
  none: 'Engång',
  daily: 'Dagligen',
  weekly: 'Veckovis',
  monthly: 'Månadsvis',
};

function isDueToday(dateStr: string) {
  const today = todayLocal();
  return dateStr.split('T')[0] === today;
}

function isPastDue(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}

function formatDueDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

export default function DailyTasks() {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newRecurrence, setNewRecurrence] = useState('none');
  const [newDueDate, setNewDueDate] = useState('');
  const [newReminder, setNewReminder] = useState(false);
  const [newReminderHours, setNewReminderHours] = useState('24');
  const [editingChore, setEditingChore] = useState<string | null>(null);

  const { data: chores = [], isLoading } = useQuery({
    queryKey: ['daily-chores'],
    queryFn: () => api.getDailyChores(),
  });

  const completeMutation = useMutation({
    mutationFn: (choreId: string) => api.completeChore(choreId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['daily-chores'] }),
  });

  const uncompleteMutation = useMutation({
    mutationFn: (choreId: string) => api.uncompleteChore(choreId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['daily-chores'] }),
  });

  const createMutation = useMutation({
    mutationFn: ({ title, description, options }: { title: string; description?: string; options?: any }) =>
      api.createChore(title, description, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-chores'] });
      toast({ title: '✅ Uppgift tillagd!' });
      setNewTitle('');
      setNewRecurrence('none');
      setNewDueDate('');
      setNewReminder(false);
      setShowAdvanced(false);
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ choreId, updates }: { choreId: string; updates: any }) =>
      api.updateChore(choreId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-chores'] });
      toast({ title: '✅ Uppgift uppdaterad' });
      setEditingChore(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (choreId: string) => api.deleteChore(choreId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-chores'] });
      toast({ title: '🗑️ Uppgift borttagen' });
    },
  });

  const toggleChore = (chore: any) => {
    if (chore.completed) {
      uncompleteMutation.mutate(chore.id);
    } else {
      completeMutation.mutate(chore.id);
    }
  };

  const addSuggested = (s: typeof SUGGESTED_CHORES[0]) => {
    const alreadyExists = chores.some((c: any) => c.title.toLowerCase() === s.title.toLowerCase());
    if (alreadyExists) {
      toast({ title: 'Uppgiften finns redan' });
      return;
    }
    createMutation.mutate({ title: s.title, description: s.description });
  };

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createMutation.mutate({
      title: newTitle.trim(),
      options: {
        recurrence: newRecurrence,
        next_due_at: newDueDate ? new Date(newDueDate).toISOString() : undefined,
        reminder_enabled: newReminder,
        reminder_hours_before: Number(newReminderHours),
      },
    });
  };

  const completedCount = chores.filter((c: any) => c.completed).length;
  const progress = chores.length > 0 ? Math.round((completedCount / chores.length) * 100) : 0;

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <motion.div
      className="max-w-5xl mx-auto space-y-4 sm:space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <PageHeader title="Dagliga uppgifter" emoji="✅" subtitle="Din dagliga checklista – återställs varje morgon" />

      {/* Progress */}
      <motion.div layout>
        <Card className={`shadow-sm transition-colors ${progress === 100 ? 'bg-success/5 border-success/30' : 'bg-card border-border'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">
                {progress === 100 ? '🎉 Alla uppgifter klara!' : `${completedCount} av ${chores.length} klara`}
              </span>
              <span className="stat-number text-sm text-primary">{progress}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
              <motion.div
                className={`h-2.5 rounded-full ${progress === 100 ? 'bg-success' : 'bg-primary'}`}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Add custom task */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Lägg till ny uppgift..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTitle.trim()) handleCreate();
              }}
              className="flex-1 h-10 rounded-xl border-border/60"
            />
            <Button
              size="sm"
              className="h-10 px-4 rounded-xl gap-1.5"
              disabled={!newTitle.trim() || createMutation.isPending}
              onClick={handleCreate}
            >
              <Plus className="h-4 w-4" />
              Lägg till
            </Button>
          </div>

          {/* Advanced options toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground font-medium hover:text-foreground transition-colors"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Schemaläggning
            <ChevronRight className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 p-3 bg-muted/20 rounded-xl border border-border/30">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Återkommande</label>
                    <Select value={newRecurrence} onValueChange={setNewRecurrence}>
                      <SelectTrigger className="h-9 text-xs rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Engångssyssla</SelectItem>
                        <SelectItem value="daily">Dagligen</SelectItem>
                        <SelectItem value="weekly">Veckovis</SelectItem>
                        <SelectItem value="monthly">Månadsvis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Förfallodatum</label>
                    <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="h-9 text-xs rounded-lg" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Påminnelse</label>
                    <div className="flex items-center gap-2">
                      <Switch checked={newReminder} onCheckedChange={setNewReminder} />
                      {newReminder && (
                        <Select value={newReminderHours} onValueChange={setNewReminderHours}>
                          <SelectTrigger className="h-9 text-xs rounded-lg flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 tim</SelectItem>
                            <SelectItem value="6">6 tim</SelectItem>
                            <SelectItem value="24">1 dag</SelectItem>
                            <SelectItem value="48">2 dagar</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Suggestions toggle */}
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="flex items-center gap-1.5 mt-3 text-xs text-primary font-medium hover:underline"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {showSuggestions ? 'Dölj förslag' : 'Visa förslag på uppgifter'}
            <ChevronRight className={`h-3 w-3 transition-transform ${showSuggestions ? 'rotate-90' : ''}`} />
          </button>

          <AnimatePresence>
            {showSuggestions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  {SUGGESTED_CHORES.map((s) => {
                    const exists = chores.some((c: any) => c.title.toLowerCase() === s.title.toLowerCase());
                    return (
                      <button
                        key={s.title}
                        onClick={() => !exists && addSuggested(s)}
                        disabled={exists || createMutation.isPending}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          exists
                            ? 'bg-muted/40 border-border/30 opacity-50 cursor-not-allowed'
                            : 'bg-muted/20 border-border/40 hover:border-primary/30 hover:bg-primary/5 cursor-pointer'
                        }`}
                      >
                        <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                          <span className="text-sm">{s.emoji}</span>
                          {exists && <Check className="h-3 w-3 text-success" />}
                          {s.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{s.description}</p>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Task list */}
      {chores.length > 0 && (
        <Card className="bg-card border-border shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              <AnimatePresence>
                {chores.map((chore: any) => {
                  const isDone = chore.completed;
                  const hasDue = !!chore.next_due_at;
                  const pastDue = hasDue && isPastDue(chore.next_due_at);
                  const dueToday = hasDue && isDueToday(chore.next_due_at);
                  const isEditing = editingChore === chore.id;

                  return (
                    <motion.div
                      key={chore.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="flex items-center gap-3 px-4 sm:px-6 py-3.5 hover:bg-secondary/50 transition-colors">
                        <button
                          onClick={() => toggleChore(chore)}
                          className="flex items-center gap-3 flex-1 text-left"
                        >
                          <motion.div
                            className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isDone ? 'bg-success/20 border-success' : 'border-border hover:border-primary'}`}
                            whileTap={{ scale: 0.85 }}
                          >
                            <AnimatePresence>
                              {isDone && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                  <Check className="h-3 w-3 text-success" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs sm:text-sm transition-all ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                {chore.title}
                              </span>
                              {chore.recurrence && chore.recurrence !== 'none' && (
                                <Badge variant="secondary" className="text-[9px] py-0 px-1.5">
                                  {RECURRENCE_LABELS[chore.recurrence]}
                                </Badge>
                              )}
                              {hasDue && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  pastDue ? 'bg-destructive/10 text-destructive' :
                                  dueToday ? 'bg-warning/10 text-warning' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {pastDue ? '⚠️ Försenad' : dueToday ? '📌 Idag' : formatDueDate(chore.next_due_at)}
                                </span>
                              )}
                            </div>
                            {chore.description && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{chore.description}</p>
                            )}
                          </div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          {!chore.is_default && (
                            <>
                              <button
                                onClick={() => setEditingChore(isEditing ? null : chore.id)}
                                className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
                              >
                                <CalendarDays className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => deleteMutation.mutate(chore.id)}
                                className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Inline edit panel */}
                      <AnimatePresence>
                        {isEditing && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-border/30"
                          >
                            <ChoreEditPanel chore={chore} onSave={(updates) => updateMutation.mutate({ choreId: chore.id, updates })} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      )}

      {chores.length === 0 && !showSuggestions && (
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground text-sm mb-3">Inga uppgifter ännu.</p>
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setShowSuggestions(true)}>
              <Sparkles className="h-3.5 w-3.5" />
              Visa förslag
            </Button>
          </CardContent>
        </Card>
      )}

      <PremiumGate soft feature="automatiska påminnelser & obegränsade uppgifter" featureKey="reminders">
        <div />
      </PremiumGate>
    </motion.div>
  );
}

function ChoreEditPanel({ chore, onSave }: { chore: any; onSave: (updates: any) => void }) {
  const [recurrence, setRecurrence] = useState(chore.recurrence || 'none');
  const [dueDate, setDueDate] = useState(chore.next_due_at ? chore.next_due_at.split('T')[0] : '');
  const [reminder, setReminder] = useState(chore.reminder_enabled || false);
  const [reminderHours, setReminderHours] = useState(String(chore.reminder_hours_before || 24));

  return (
    <div className="px-4 sm:px-6 py-3 bg-muted/20">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Återkommande</label>
          <Select value={recurrence} onValueChange={setRecurrence}>
            <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Engång</SelectItem>
              <SelectItem value="daily">Dagligen</SelectItem>
              <SelectItem value="weekly">Veckovis</SelectItem>
              <SelectItem value="monthly">Månadsvis</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Förfallodatum</label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-xs rounded-lg" />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Påminnelse</label>
          <div className="flex items-center gap-2">
            <Switch checked={reminder} onCheckedChange={setReminder} />
            <span className="text-[10px] text-muted-foreground">{reminder ? `${reminderHours}h` : 'Av'}</span>
          </div>
        </div>
        <Button
          size="sm"
          className="h-8 text-xs rounded-lg"
          onClick={() => onSave({
            recurrence,
            next_due_at: dueDate ? new Date(dueDate).toISOString() : null,
            reminder_enabled: reminder,
            reminder_hours_before: Number(reminderHours),
          })}
        >
          Spara
        </Button>
      </div>
    </div>
  );
}
