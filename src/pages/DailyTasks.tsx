import React, { useMemo, useState } from 'react';
import { todayLocal } from '@/lib/datetime';
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

function datePart(dateStr: string) {
  return dateStr.split('T')[0];
}

function isDueToday(dateStr: string) {
  return datePart(dateStr) === todayLocal();
}

function isPastDue(dateStr: string) {
  return datePart(dateStr) < todayLocal();
}

function formatDueDate(dateStr: string) {
  const d = new Date(`${datePart(dateStr)}T12:00:00`);
  return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function sortByDue(a: any, b: any) {
  if (!a.next_due_at && !b.next_due_at) return 0;
  if (!a.next_due_at) return 1;
  if (!b.next_due_at) return -1;
  return datePart(a.next_due_at).localeCompare(datePart(b.next_due_at));
}

export default function DailyTasks() {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
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
      toast({ title: 'Sysslan är tillagd 🌿' });
      setNewTitle('');
      setNewRecurrence('none');
      setNewDueDate('');
      setNewReminder(false);
      setShowAdvanced(false);
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ choreId, updates }: { choreId: string; updates: any }) => api.updateChore(choreId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-chores'] });
      toast({ title: 'Sysslan är uppdaterad' });
      setEditingChore(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (choreId: string) => api.deleteChore(choreId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-chores'] });
      toast({ title: 'Sysslan är borttagen' });
    },
  });

  const toggleChore = (chore: any) => {
    if (chore.completed) uncompleteMutation.mutate(chore.id);
    else completeMutation.mutate(chore.id);
  };

  const addSuggested = (suggestion: (typeof SUGGESTED_CHORES)[number]) => {
    const alreadyExists = chores.some((c: any) => c.title.toLowerCase() === suggestion.title.toLowerCase());
    if (alreadyExists) {
      toast({ title: 'Den sysslan finns redan' });
      return;
    }
    createMutation.mutate({ title: suggestion.title, description: suggestion.description });
  };

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createMutation.mutate({
      title: newTitle.trim(),
      options: {
        recurrence: newRecurrence,
        next_due_at: newDueDate ? new Date(`${newDueDate}T12:00:00`).toISOString() : undefined,
        reminder_enabled: newReminder,
        reminder_hours_before: Number(newReminderHours),
      },
    });
  };

  const { nowChores, upcomingChores, completedChores, overdueCount } = useMemo(() => {
    const open = chores.filter((c: any) => !c.completed);
    const now = open
      .filter((c: any) => !c.next_due_at || isDueToday(c.next_due_at) || isPastDue(c.next_due_at))
      .sort(sortByDue);
    const upcoming = open
      .filter((c: any) => c.next_due_at && !isDueToday(c.next_due_at) && !isPastDue(c.next_due_at))
      .sort(sortByDue);
    const done = chores.filter((c: any) => c.completed);
    const overdue = open.filter((c: any) => c.next_due_at && isPastDue(c.next_due_at)).length;
    return { nowChores: now, upcomingChores: upcoming, completedChores: done, overdueCount: overdue };
  }, [chores]);

  const completedCount = completedChores.length;
  const progress = chores.length > 0 ? Math.round((completedCount / chores.length) * 100) : 0;
  const remainingCount = chores.length - completedCount;

  if (isLoading) {
    return (
      <div className="yard-v4 max-w-3xl mx-auto">
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-16 rounded-2xl mt-4" />
        <Skeleton className="h-52 rounded-3xl mt-4" />
      </div>
    );
  }

  return (
    <motion.div
      className="yard-v4 max-w-3xl mx-auto"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      <header className="yard-v4__header">
        <div>
          <p className="yard-v4__eyebrow">Gården</p>
          <h1>Det som behöver göras</h1>
          <p>Små rutiner som håller flocken trygg, mätt och ompysslad.</p>
        </div>
        <span className="yard-v4__header-mark" aria-hidden="true">🌿</span>
      </header>

      <section className={`yard-v4__status ${remainingCount === 0 && chores.length > 0 ? 'is-done' : ''}`} aria-label="Dagens status">
        <div className="yard-v4__status-copy">
          <p className="yard-v4__eyebrow">Idag</p>
          <h2>
            {chores.length === 0
              ? 'Lugnt på gården just nu'
              : remainingCount === 0
                ? 'Allt är klart för idag'
                : `${remainingCount} ${remainingCount === 1 ? 'sak' : 'saker'} kvar`}
          </h2>
          <p>
            {overdueCount > 0
              ? `${overdueCount} ${overdueCount === 1 ? 'syssla behöver' : 'sysslor behöver'} lite extra uppmärksamhet.`
              : remainingCount === 0 && chores.length > 0
                ? 'Flocken är omhändertagen. Bra jobbat.'
                : 'Bocka av det du gör – resten kan vänta.'}
          </p>
        </div>
        {chores.length > 0 && (
          <div className="yard-v4__progress" aria-label={`${progress} procent klart`}>
            <strong>{progress}%</strong>
            <span>{completedCount}/{chores.length} klart</span>
          </div>
        )}
        <div className="yard-v4__progress-track" aria-hidden="true">
          <motion.span initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.45 }} />
        </div>
      </section>

      <section className="yard-v4__composer" aria-label="Lägg till syssla">
        <div className="yard-v4__composer-line">
          <Plus className="h-4 w-4" aria-hidden="true" />
          <Input
            placeholder="Vad behöver göras?"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTitle.trim()) handleCreate();
            }}
            aria-label="Ny syssla"
          />
          <Button disabled={!newTitle.trim() || createMutation.isPending} onClick={handleCreate}>
            Lägg till
          </Button>
        </div>

        <div className="yard-v4__composer-tools">
          <button type="button" onClick={() => setShowSuggestions((v) => !v)}>
            <Sparkles className="h-3.5 w-3.5" />
            Vanliga gårdssysslor
            <ChevronRight className={`h-3 w-3 ${showSuggestions ? 'rotate-90' : ''}`} />
          </button>
          <button type="button" onClick={() => setShowAdvanced((v) => !v)}>
            <CalendarDays className="h-3.5 w-3.5" />
            Tid & påminnelse
            <ChevronRight className={`h-3 w-3 ${showAdvanced ? 'rotate-90' : ''}`} />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {showSuggestions && (
            <motion.div className="yard-v4__suggestions" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              {SUGGESTED_CHORES.map((suggestion) => {
                const exists = chores.some((c: any) => c.title.toLowerCase() === suggestion.title.toLowerCase());
                return (
                  <button
                    type="button"
                    key={suggestion.title}
                    disabled={exists || createMutation.isPending}
                    className={exists ? 'is-added' : ''}
                    onClick={() => !exists && addSuggested(suggestion)}
                  >
                    <span aria-hidden="true">{suggestion.emoji}</span>
                    <span>
                      <strong>{suggestion.title}</strong>
                      <small>{exists ? 'Redan på gården' : suggestion.description}</small>
                    </span>
                    {exists && <Check className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </motion.div>
          )}

          {showAdvanced && (
            <motion.div className="yard-v4__advanced" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <label>
                <span>Upprepas</span>
                <Select value={newRecurrence} onValueChange={setNewRecurrence}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">En gång</SelectItem>
                    <SelectItem value="daily">Varje dag</SelectItem>
                    <SelectItem value="weekly">Varje vecka</SelectItem>
                    <SelectItem value="monthly">Varje månad</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label>
                <span>När?</span>
                <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
              </label>
              <label className="yard-v4__reminder-control">
                <span>Påminn mig</span>
                <div>
                  <Switch checked={newReminder} onCheckedChange={setNewReminder} />
                  {newReminder && (
                    <Select value={newReminderHours} onValueChange={setNewReminderHours}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 timme innan</SelectItem>
                        <SelectItem value="6">6 timmar innan</SelectItem>
                        <SelectItem value="24">1 dag innan</SelectItem>
                        <SelectItem value="48">2 dagar innan</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </label>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <ChoreSection
        eyebrow="Nu"
        title={nowChores.length > 0 ? 'På gården idag' : 'Inget som pockar på'}
        description={nowChores.length > 0 ? 'Det här är det som är närmast till hands.' : 'Det finns inget akut eller oschemalagt kvar.'}
        chores={nowChores}
        editingChore={editingChore}
        setEditingChore={setEditingChore}
        toggleChore={toggleChore}
        deleteChore={(id) => deleteMutation.mutate(id)}
        saveChore={(id, updates) => updateMutation.mutate({ choreId: id, updates })}
      />

      {upcomingChores.length > 0 && (
        <ChoreSection
          eyebrow="Snart"
          title="Längre fram"
          description="Redan planerat, men inget du behöver bära i huvudet idag."
          chores={upcomingChores}
          editingChore={editingChore}
          setEditingChore={setEditingChore}
          toggleChore={toggleChore}
          deleteChore={(id) => deleteMutation.mutate(id)}
          saveChore={(id, updates) => updateMutation.mutate({ choreId: id, updates })}
        />
      )}

      {completedChores.length > 0 && (
        <section className="yard-v4__done">
          <button type="button" className="yard-v4__done-toggle" onClick={() => setShowCompleted((v) => !v)}>
            <span><Check className="h-4 w-4" /> Klart idag <small>{completedChores.length}</small></span>
            <ChevronDown className={`h-4 w-4 ${showCompleted ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {showCompleted && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="yard-v4__done-list">
                {completedChores.map((chore: any) => (
                  <ChoreRow
                    key={chore.id}
                    chore={chore}
                    isEditing={editingChore === chore.id}
                    onToggle={() => toggleChore(chore)}
                    onEdit={() => setEditingChore(editingChore === chore.id ? null : chore.id)}
                    onDelete={() => deleteMutation.mutate(chore.id)}
                    onSave={(updates) => updateMutation.mutate({ choreId: chore.id, updates })}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      <PremiumGate soft feature="automatiska påminnelser & obegränsade uppgifter" featureKey="reminders">
        <div />
      </PremiumGate>
    </motion.div>
  );
}

function ChoreSection({
  eyebrow,
  title,
  description,
  chores,
  editingChore,
  setEditingChore,
  toggleChore,
  deleteChore,
  saveChore,
}: {
  eyebrow: string;
  title: string;
  description: string;
  chores: any[];
  editingChore: string | null;
  setEditingChore: (id: string | null) => void;
  toggleChore: (chore: any) => void;
  deleteChore: (id: string) => void;
  saveChore: (id: string, updates: any) => void;
}) {
  return (
    <section className="yard-v4__section">
      <div className="yard-v4__section-heading">
        <div>
          <p className="yard-v4__eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {chores.length > 0 && <strong>{chores.length}</strong>}
      </div>
      {chores.length > 0 && (
        <div className="yard-v4__list">
          <AnimatePresence initial={false}>
            {chores.map((chore: any) => (
              <ChoreRow
                key={chore.id}
                chore={chore}
                isEditing={editingChore === chore.id}
                onToggle={() => toggleChore(chore)}
                onEdit={() => setEditingChore(editingChore === chore.id ? null : chore.id)}
                onDelete={() => deleteChore(chore.id)}
                onSave={(updates) => saveChore(chore.id, updates)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

function ChoreRow({ chore, isEditing, onToggle, onEdit, onDelete, onSave }: {
  chore: any;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSave: (updates: any) => void;
}) {
  const hasDue = !!chore.next_due_at;
  const pastDue = hasDue && isPastDue(chore.next_due_at);
  const dueToday = hasDue && isDueToday(chore.next_due_at);

  return (
    <motion.article layout className={`yard-v4__chore ${chore.completed ? 'is-done' : ''} ${pastDue && !chore.completed ? 'is-overdue' : ''}`}>
      <div className="yard-v4__chore-main">
        <button type="button" className="yard-v4__check" onClick={onToggle} aria-label={chore.completed ? `Markera ${chore.title} som inte klar` : `Markera ${chore.title} som klar`}>
          {chore.completed && <Check className="h-4 w-4" />}
        </button>
        <button type="button" className="yard-v4__chore-copy" onClick={onToggle}>
          <span className="yard-v4__chore-title">{chore.title}</span>
          {chore.description && <span className="yard-v4__chore-description">{chore.description}</span>}
          <span className="yard-v4__meta">
            {pastDue && !chore.completed && <em className="is-overdue"><AlertTriangle className="h-3 w-3" /> Försenad</em>}
            {dueToday && !pastDue && <em><Clock className="h-3 w-3" /> Idag</em>}
            {hasDue && !pastDue && !dueToday && <em><CalendarDays className="h-3 w-3" /> {formatDueDate(chore.next_due_at)}</em>}
            {chore.recurrence && chore.recurrence !== 'none' && <em>{RECURRENCE_LABELS[chore.recurrence]}</em>}
          </span>
        </button>
        {!chore.is_default && (
          <div className="yard-v4__chore-actions">
            <button type="button" onClick={onEdit} aria-label={`Ändra tid för ${chore.title}`}><CalendarDays className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={onDelete} aria-label={`Ta bort ${chore.title}`}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
      <AnimatePresence initial={false}>
        {isEditing && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="yard-v4__edit-wrap">
            <ChoreEditPanel chore={chore} onSave={onSave} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function ChoreEditPanel({ chore, onSave }: { chore: any; onSave: (updates: any) => void }) {
  const [recurrence, setRecurrence] = useState(chore.recurrence || 'none');
  const [dueDate, setDueDate] = useState(chore.next_due_at ? datePart(chore.next_due_at) : '');
  const [reminder, setReminder] = useState(chore.reminder_enabled || false);
  const [reminderHours, setReminderHours] = useState(String(chore.reminder_hours_before || 24));

  return (
    <div className="yard-v4__edit">
      <label>
        <span>Upprepas</span>
        <Select value={recurrence} onValueChange={setRecurrence}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">En gång</SelectItem>
            <SelectItem value="daily">Varje dag</SelectItem>
            <SelectItem value="weekly">Varje vecka</SelectItem>
            <SelectItem value="monthly">Varje månad</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label>
        <span>När?</span>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </label>
      <label className="yard-v4__reminder-control">
        <span>Påminnelse</span>
        <div>
          <Switch checked={reminder} onCheckedChange={setReminder} />
          {reminder && (
            <Select value={reminderHours} onValueChange={setReminderHours}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 timme innan</SelectItem>
                <SelectItem value="6">6 timmar innan</SelectItem>
                <SelectItem value="24">1 dag innan</SelectItem>
                <SelectItem value="48">2 dagar innan</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </label>
      <Button onClick={() => onSave({
        recurrence,
        next_due_at: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
        reminder_enabled: reminder,
        reminder_hours_before: Number(reminderHours),
      })}>
        Spara
      </Button>
    </div>
  );
}
