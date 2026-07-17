import React, { useState, useMemo } from 'react';
import { todayLocal, localCalendarDate } from '@/lib/datetime';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Stethoscope, Plus, CheckCircle2, Trash2, Loader2, Filter, CalendarClock, ShieldAlert } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import AffiliateProductStrip from '@/components/affiliate/AffiliateProductStrip';
import { useActiveKarens } from '@/hooks/useActiveKarens';

type HealthSchedule = Tables<'health_schedules'>;
interface HealthScheduleForm {
  id?: string;
  title: string;
  care_type?: string;
  interval_days: number;
  hen_id?: string | null;
  flock_id?: string | null;
  default_withdrawal_egg_days?: number | null;
}

const EVENT_TYPES = [
  { value: 'symptom', label: 'Symtom' },
  { value: 'behandling', label: 'Behandling' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'koll', label: 'Hälsokoll' },
  { value: 'skada', label: 'Skada' },
];

const CARE_TYPES = [
  { value: 'avmaskning', label: 'Avmaskning' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'vitamin', label: 'Vitamintillskott' },
  { value: 'parasitkoll', label: 'Parasitkoll' },
  { value: 'klovård', label: 'Klovård' },
  { value: 'annat', label: 'Annat' },
];

const SCHEDULE_TEMPLATES = [
  { care_type: 'avmaskning', title: 'Avmaskning', interval_days: 90, default_withdrawal_egg_days: 7 },
  { care_type: 'vitamin', title: 'Vitamintillskott', interval_days: 30, default_withdrawal_egg_days: null },
  { care_type: 'vaccination', title: 'Vaccinationsbooster', interval_days: 365, default_withdrawal_egg_days: 0 },
  { care_type: 'parasitkoll', title: 'Parasitkoll', interval_days: 14, default_withdrawal_egg_days: null },
];

const KARENS_QUICK = [
  { value: '', label: 'Ingen' },
  { value: '7', label: '7 d' },
  { value: '14', label: '14 d' },
  { value: '28', label: '28 d' },
];

function typeColor(t: string) {
  switch (t) {
    case 'symptom': return 'bg-warning/15 text-warning border-warning/30';
    case 'behandling': return 'bg-primary/15 text-primary border-primary/30';
    case 'vaccination': return 'bg-success/15 text-success border-success/30';
    case 'koll': return 'bg-muted/60 text-muted-foreground border-border';
    case 'skada': return 'bg-destructive/15 text-destructive border-destructive/30';
    default: return 'bg-muted/60 text-muted-foreground border-border';
  }
}

function todayISO() { return todayLocal(); }
function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return localCalendarDate(d);
}

export default function Health() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterHen, setFilterHen] = useState<string>('all');

  const [form, setForm] = useState({
    hen_id: '',
    event_type: 'symptom',
    title: '',
    description: '',
    treatment: '',
    event_date: todayISO(),
    withdrawal_egg_days: '' as string,
  });

  const [sform, setSform] = useState({
    care_type: 'avmaskning',
    title: 'Avmaskning',
    interval_days: 90,
    hen_id: '',
    flock_id: '',
    next_due_date: todayISO(),
    reminder_days_before: 3,
    default_withdrawal_egg_days: '' as string,
    notes: '',
  });

  const { data: hens = [] } = useQuery({
    queryKey: ['hens', 'minimal'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hens')
        .select('id, name, hen_type, is_active, flock_id')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: flocks = [] } = useQuery({
    queryKey: ['flocks', 'minimal'],
    queryFn: async () => {
      const { data, error } = await supabase.from('flocks').select('id, name').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['health_events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('health_events')
        .select('*, hens:hen_id(name, hen_type)')
        .order('event_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['health_schedules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('health_schedules')
        .select('*')
        .eq('is_active', true)
        .order('next_due_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: karens = [] } = useActiveKarens();

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filterType !== 'all' && e.event_type !== filterType) return false;
      if (filterHen !== 'all' && e.hen_id !== filterHen) return false;
      return true;
    });
  }, [events, filterType, filterHen]);

  const henName = (id: string | null) => hens.find(h => h.id === id)?.name || '';
  const flockName = (id: string | null) => flocks.find(f => f.id === id)?.name || '';
  const targetLabel = (s: HealthSchedule) =>
    s.hen_id ? `🐔 ${henName(s.hen_id)}` : s.flock_id ? `👥 ${flockName(s.flock_id)}` : 'Hela besättningen';

  const scheduleSummary = useMemo(() => {
    const today = todayISO();
    let overdue = 0, soon = 0;
    schedules.forEach((s) => {
      if (s.next_due_date < today) overdue++;
      else {
        const diff = Math.round((new Date(s.next_due_date).getTime() - new Date(today).getTime()) / 86400000);
        if (diff <= (s.reminder_days_before ?? 3)) soon++;
      }
    });
    return { overdue, soon };
  }, [schedules]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Ej inloggad');
      const withdrawal = form.withdrawal_egg_days ? parseInt(form.withdrawal_egg_days, 10) : null;
      const { error } = await supabase.from('health_events').insert({
        user_id: user.id,
        hen_id: form.hen_id || null,
        event_type: form.event_type,
        title: form.title,
        description: form.description || null,
        treatment: form.treatment || null,
        event_date: form.event_date,
        withdrawal_egg_days: withdrawal,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health_events'] });
      queryClient.invalidateQueries({ queryKey: ['active-karens'] });
      toast({ title: 'Hälsohändelsen är sparad ✓' });
      setOpen(false);
      setForm({
        hen_id: '', event_type: 'symptom', title: '', description: '',
        treatment: '', event_date: todayISO(), withdrawal_egg_days: '',
      });
    },
    onError: (e: Error) => toast({ title: 'Kunde inte spara', description: e.message, variant: 'destructive' }),
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('health_events')
        .update({ resolved: true, resolved_at: todayISO() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health_events'] });
      toast({ title: 'Markerad som åtgärdad' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('health_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health_events'] });
      queryClient.invalidateQueries({ queryKey: ['active-karens'] });
      toast({ title: 'Borttagen' });
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Ej inloggad');
      const { error } = await supabase.from('health_schedules').insert({
        user_id: user.id,
        care_type: sform.care_type,
        title: sform.title,
        interval_days: sform.interval_days,
        hen_id: sform.hen_id || null,
        flock_id: sform.flock_id || null,
        next_due_date: sform.next_due_date,
        reminder_days_before: sform.reminder_days_before,
        default_withdrawal_egg_days: sform.default_withdrawal_egg_days
          ? parseInt(sform.default_withdrawal_egg_days, 10) : null,
        notes: sform.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health_schedules'] });
      toast({ title: 'Schema skapat ✓' });
      setScheduleOpen(false);
    },
    onError: (e: Error) => toast({ title: 'Kunde inte spara schema', description: e.message, variant: 'destructive' }),
  });

  const markDoneMutation = useMutation({
    mutationFn: async (s: HealthScheduleForm) => {
      if (!user?.id) return;
      const next = addDays(todayISO(), s.interval_days);
      // 1. Create health_event with karens calc
      const { error: e1 } = await supabase.from('health_events').insert({
        user_id: user.id,
        hen_id: s.hen_id || null,
        flock_id: s.flock_id || null,
        event_type: 'behandling',
        title: s.title,
        treatment: s.care_type,
        event_date: todayISO(),
        withdrawal_egg_days: s.default_withdrawal_egg_days ?? null,
      });
      if (e1) throw e1;
      // 2. Update schedule
      const { error: e2 } = await supabase.from('health_schedules')
        .update({ last_done_date: todayISO(), next_due_date: next, last_reminded_due: null })
        .eq('id', s.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health_schedules'] });
      queryClient.invalidateQueries({ queryKey: ['health_events'] });
      queryClient.invalidateQueries({ queryKey: ['active-karens'] });
      toast({ title: 'Utförd – nästa förfallodag är inplanerad' });
    },
    onError: (e: Error) => toast({ title: 'Kunde inte uppdatera', description: e.message, variant: 'destructive' }),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('health_schedules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health_schedules'] });
      toast({ title: 'Schema borttaget' });
    },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl text-foreground flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Hälsa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Logg, återkommande skötsel och karenstid samlat på ett ställe.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2">
              <Plus className="h-4 w-4" /> Ny hälsohändelse
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader><DialogTitle className="font-serif">Ny hälsohändelse</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Datum</Label>
                  <Input type="date" value={form.event_date}
                    onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                    className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Typ</Label>
                  <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Höna (valfritt)</Label>
                <Select value={form.hen_id || 'none'} onValueChange={(v) => setForm({ ...form, hen_id: v === 'none' ? '' : v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Hela flocken" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Hela flocken</SelectItem>
                    {hens.map((h) => (
                      <SelectItem key={h.id} value={h.id}>{h.hen_type === 'rooster' ? '🐓 ' : '🐔 '}{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rubrik</Label>
                <Input placeholder="T.ex. Hängig och äter sämre"
                  value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Beskrivning</Label>
                <Textarea placeholder="Symtom, observationer, kontext..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="rounded-xl min-h-[80px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Behandling (valfritt)</Label>
                <Input placeholder="T.ex. Avmaskning, vitamintillskott"
                  value={form.treatment}
                  onChange={(e) => setForm({ ...form, treatment: e.target.value })}
                  className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Karenstid för ägg (dagar)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {KARENS_QUICK.map(k => (
                    <Button key={k.label} type="button" size="sm" variant={form.withdrawal_egg_days === k.value ? 'default' : 'outline'}
                      className="h-8 rounded-lg text-xs"
                      onClick={() => setForm({ ...form, withdrawal_egg_days: k.value })}>
                      {k.label}
                    </Button>
                  ))}
                  <Input type="number" min={0} placeholder="Eget"
                    value={form.withdrawal_egg_days}
                    onChange={(e) => setForm({ ...form, withdrawal_egg_days: e.target.value })}
                    className="rounded-xl h-8 w-24 text-xs" />
                </div>
                {form.withdrawal_egg_days && parseInt(form.withdrawal_egg_days, 10) > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Ägg ätbara från {addDays(form.event_date, parseInt(form.withdrawal_egg_days, 10))}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Avbryt</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!form.title.trim() || createMutation.isPending}
                className="rounded-xl"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Spara'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {(scheduleSummary.overdue > 0 || scheduleSummary.soon > 0) && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-3 text-sm flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-warning" />
            <span>
              {scheduleSummary.overdue > 0 && <strong className="text-destructive">{scheduleSummary.overdue} försenade</strong>}
              {scheduleSummary.overdue > 0 && scheduleSummary.soon > 0 && ' · '}
              {scheduleSummary.soon > 0 && <span>{scheduleSummary.soon} inom kort</span>}
            </span>
          </CardContent>
        </Card>
      )}

      {karens.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <ShieldAlert className="h-4 w-4" /> Aktiv karens
            </div>
            <ul className="space-y-1 text-sm">
              {karens.map(k => (
                <li key={k.id} className="flex items-center gap-2">
                  <span>🚫</span>
                  <span>
                    Ägg från {k.hen_id ? henName(k.hen_id) : k.flock_id ? flockName(k.flock_id) : 'besättningen'} – ätbara från <strong>{k.egg_safe_from}</strong> ({k.days_left} dgr kvar)
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="logg" className="w-full">
        <TabsList className="rounded-xl">
          <TabsTrigger value="logg" className="rounded-lg">Logg</TabsTrigger>
          <TabsTrigger value="schema" className="rounded-lg">Schema</TabsTrigger>
        </TabsList>

        <TabsContent value="logg" className="space-y-4 mt-4">
          <Card className="border-border/50">
            <CardContent className="p-3 flex flex-wrap gap-3 items-center">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40 rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla typer</SelectItem>
                  {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterHen} onValueChange={setFilterHen}>
                <SelectTrigger className="w-48 rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla höns</SelectItem>
                  {hens.map((h) => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground ml-auto">{filtered.length} händelser</span>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="Ingen hälsodata ännu"
              description="Logga symtom, vaccinationer eller behandlingar – då bygger du ett livshistorikregister för varje höna och kan snabbare se mönster över tid."
              actionLabel="Lägg till hälsohändelse"
              onAction={() => setOpen(true)}
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((e) => (
                <Card key={e.id} className="border-border/50 hover:border-border transition-colors">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="flex flex-col items-center min-w-[3rem]">
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {new Date(e.event_date).toLocaleDateString('sv-SE', { month: 'short' })}
                      </span>
                      <span className="text-lg font-serif text-foreground">
                        {new Date(e.event_date).getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${typeColor(e.event_type)}`}>
                          {EVENT_TYPES.find(t => t.value === e.event_type)?.label || e.event_type}
                        </Badge>
                        {e.hens?.name && (
                          <span className="text-[11px] text-muted-foreground">
                            {e.hens.hen_type === 'rooster' ? '🐓' : '🐔'} {e.hens.name}
                          </span>
                        )}
                        {e.resolved && (
                          <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                            Åtgärdad
                          </Badge>
                        )}
                        {e.egg_safe_from && e.egg_safe_from >= todayISO() && (
                          <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                            🚫 Karens till {e.egg_safe_from}
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-sm font-medium text-foreground mt-1">{e.title}</h3>
                      {e.description && <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>}
                      {e.treatment && (
                        <p className="text-xs text-primary mt-1">
                          <strong>Behandling:</strong> {e.treatment}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {!e.resolved && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg"
                          onClick={() => resolveMutation.mutate(e.id)}
                          title="Markera som åtgärdad" aria-label="Markera som åtgärdad">
                          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg"
                        onClick={() => {
                          if (confirm('Ta bort den här hälsohändelsen?')) deleteMutation.mutate(e.id);
                        }} aria-label="Ta bort hälsohändelse">
                        <Trash2 className="h-4 w-4 text-destructive/70" aria-hidden="true" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="schema" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Återkommande skötsel med påminnelser.</p>
            <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-xl gap-2">
                  <Plus className="h-4 w-4" /> Nytt schema
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader><DialogTitle className="font-serif">Nytt hälsoschema</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Snabbmallar</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {SCHEDULE_TEMPLATES.map(t => (
                        <Button key={t.title} type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs"
                          onClick={() => setSform({
                            ...sform,
                            care_type: t.care_type,
                            title: t.title,
                            interval_days: t.interval_days,
                            default_withdrawal_egg_days: t.default_withdrawal_egg_days != null ? String(t.default_withdrawal_egg_days) : '',
                          })}>
                          {t.title} · {t.interval_days}d
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Typ</Label>
                      <Select value={sform.care_type} onValueChange={(v) => setSform({ ...sform, care_type: v })}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CARE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Intervall (dagar)</Label>
                      <Input type="number" min={1} value={sform.interval_days}
                        onChange={(e) => setSform({ ...sform, interval_days: parseInt(e.target.value || '1', 10) })}
                        className="rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rubrik</Label>
                    <Input value={sform.title} onChange={(e) => setSform({ ...sform, title: e.target.value })}
                      className="rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Flock</Label>
                      <Select value={sform.flock_id || 'none'} onValueChange={(v) => setSform({ ...sform, flock_id: v === 'none' ? '' : v, hen_id: '' })}>
                        <SelectTrigger className="rounded-xl"><SelectValue placeholder="Alla" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Hela besättningen</SelectItem>
                          {flocks.map((f) => (
                            <SelectItem key={f.id} value={f.id}>👥 {f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Höna</Label>
                      <Select value={sform.hen_id || 'none'} onValueChange={(v) => setSform({ ...sform, hen_id: v === 'none' ? '' : v })}>
                        <SelectTrigger className="rounded-xl"><SelectValue placeholder="Alla" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Alla</SelectItem>
                          {hens.map((h) => (
                            <SelectItem key={h.id} value={h.id}>🐔 {h.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nästa förfallodatum</Label>
                      <Input type="date" value={sform.next_due_date}
                        onChange={(e) => setSform({ ...sform, next_due_date: e.target.value })}
                        className="rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Påminn (dgr innan)</Label>
                      <Input type="number" min={0} value={sform.reminder_days_before}
                        onChange={(e) => setSform({ ...sform, reminder_days_before: parseInt(e.target.value || '0', 10) })}
                        className="rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Förvald ägg-karens (dagar)</Label>
                    <Input type="number" min={0} placeholder="t.ex. 7"
                      value={sform.default_withdrawal_egg_days}
                      onChange={(e) => setSform({ ...sform, default_withdrawal_egg_days: e.target.value })}
                      className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Anteckningar</Label>
                    <Textarea value={sform.notes} onChange={(e) => setSform({ ...sform, notes: e.target.value })}
                      className="rounded-xl min-h-[60px]" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setScheduleOpen(false)} className="rounded-xl">Avbryt</Button>
                  <Button onClick={() => createScheduleMutation.mutate()}
                    disabled={!sform.title.trim() || createScheduleMutation.isPending}
                    className="rounded-xl">
                    {createScheduleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Spara schema'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {schedules.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Inga scheman ännu"
              description="Lägg upp återkommande hälsorutiner som avmaskning eller vitamintillskott så påminner Hönsgården dig automatiskt."
              actionLabel="Skapa schema"
              onAction={() => setScheduleOpen(true)}
            />
          ) : (
            <div className="space-y-2">
              {schedules.map((s) => {
                const today = todayISO();
                const overdue = s.next_due_date < today;
                const diff = Math.round((new Date(s.next_due_date).getTime() - new Date(today).getTime()) / 86400000);
                const soon = !overdue && diff <= (s.reminder_days_before ?? 3);
                const status = overdue ? 'Försenat' : soon ? 'Snart' : 'OK';
                const statusClass = overdue
                  ? 'bg-destructive/15 text-destructive border-destructive/30'
                  : soon
                    ? 'bg-warning/15 text-warning border-warning/30'
                    : 'bg-success/15 text-success border-success/30';
                return (
                  <Card key={s.id} className="border-border/50">
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] ${statusClass}`}>{status}</Badge>
                          <span className="text-[11px] text-muted-foreground">{targetLabel(s)}</span>
                          <span className="text-[11px] text-muted-foreground">· var {s.interval_days}:e dag</span>
                        </div>
                        <h3 className="text-sm font-medium text-foreground mt-1">{s.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          Nästa: <strong>{s.next_due_date}</strong>
                          {s.last_done_date && <> · senast: {s.last_done_date}</>}
                          {s.default_withdrawal_egg_days != null && <> · karens: {s.default_withdrawal_egg_days} d</>}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs gap-1"
                          onClick={() => markDoneMutation.mutate(s)}
                          disabled={markDoneMutation.isPending}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Utförd
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg"
                          onClick={() => { if (confirm('Ta bort schema?')) deleteScheduleMutation.mutate(s.id); }} aria-label="Ta bort schema">
                          <Trash2 className="h-4 w-4 text-destructive/70" aria-hidden="true" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AffiliateProductStrip category="tillskott" title="Tillskott & hälsa" />
    </div>
  );
}
