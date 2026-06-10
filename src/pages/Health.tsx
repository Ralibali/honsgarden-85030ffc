import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Stethoscope, Plus, CheckCircle2, Trash2, Loader2, Filter } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import AffiliateProductStrip from '@/components/affiliate/AffiliateProductStrip';

const EVENT_TYPES = [
  { value: 'symptom', label: 'Symtom' },
  { value: 'behandling', label: 'Behandling' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'koll', label: 'Hälsokoll' },
  { value: 'skada', label: 'Skada' },
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

export default function Health() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterHen, setFilterHen] = useState<string>('all');

  const [form, setForm] = useState({
    hen_id: '',
    event_type: 'symptom',
    title: '',
    description: '',
    treatment: '',
    event_date: new Date().toISOString().split('T')[0],
  });

  const { data: hens = [] } = useQuery({
    queryKey: ['hens', 'minimal'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hens')
        .select('id, name, hen_type, is_active')
        .eq('is_active', true)
        .order('name');
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

  const filtered = useMemo(() => {
    return events.filter((e: any) => {
      if (filterType !== 'all' && e.event_type !== filterType) return false;
      if (filterHen !== 'all' && e.hen_id !== filterHen) return false;
      return true;
    });
  }, [events, filterType, filterHen]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Ej inloggad');
      const { error } = await supabase.from('health_events').insert({
        user_id: user.id,
        hen_id: form.hen_id || null,
        event_type: form.event_type,
        title: form.title,
        description: form.description || null,
        treatment: form.treatment || null,
        event_date: form.event_date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health_events'] });
      toast({ title: 'Hälsohändelsen är sparad ✓' });
      setOpen(false);
      setForm({
        hen_id: '', event_type: 'symptom', title: '', description: '',
        treatment: '', event_date: new Date().toISOString().split('T')[0],
      });
    },
    onError: (e: any) => toast({ title: 'Kunde inte spara', description: e.message, variant: 'destructive' }),
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('health_events')
        .update({ resolved: true, resolved_at: new Date().toISOString().split('T')[0] })
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
      toast({ title: 'Borttagen' });
    },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl text-foreground flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Hälsologg
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Samla symtom, behandlingar, vaccinationer och hälsokontroller på ett ställe.
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
                  <Input
                    type="date"
                    value={form.event_date}
                    onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                    className="rounded-xl"
                  />
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
                    {hens.map((h: any) => (
                      <SelectItem key={h.id} value={h.id}>{h.hen_type === 'rooster' ? '🐓 ' : '🐔 '}{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rubrik</Label>
                <Input
                  placeholder="T.ex. Hängig och äter sämre"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Beskrivning</Label>
                <Textarea
                  placeholder="Symtom, observationer, kontext..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="rounded-xl min-h-[80px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Behandling (valfritt)</Label>
                <Input
                  placeholder="T.ex. Avmaskning, vitamintillskott"
                  value={form.treatment}
                  onChange={(e) => setForm({ ...form, treatment: e.target.value })}
                  className="rounded-xl"
                />
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
              {hens.map((h: any) => (
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
          {filtered.map((e: any) => (
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
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => resolveMutation.mutate(e.id)}
                      title="Markera som åtgärdad"
                    >
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => {
                      if (confirm('Ta bort den här hälsohändelsen?')) deleteMutation.mutate(e.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive/70" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <AffiliateProductStrip category="tillskott" title="Tillskott & hälsa" />
    </div>
  );
}

