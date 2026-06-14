import React, { useState } from 'react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Heart, Plus, Egg, Trash2, Loader2, Baby, Calendar } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import { PremiumGate } from '@/components/PremiumGate';
import BreedingAnalysisCard from '@/components/BreedingAnalysisCard';

function PairsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', rooster_id: '', hen_ids: [] as string[],
    start_date: new Date().toISOString().split('T')[0],
    goal: '', notes: '',
  });

  const { data: hens = [] } = useQuery({
    queryKey: ['hens', 'breeding'],
    queryFn: async () => {
      const { data } = await supabase.from('hens').select('id, name, hen_type, breed').eq('is_active', true).order('name');
      return data ?? [];
    },
  });

  const { data: pairs = [], isLoading } = useQuery({
    queryKey: ['breeding_pairs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('breeding_pairs')
        .select('*')
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Ej inloggad');
      const { error } = await supabase.from('breeding_pairs').insert({
        user_id: user.id,
        name: form.name,
        rooster_id: form.rooster_id || null,
        hen_ids: form.hen_ids,
        start_date: form.start_date,
        goal: form.goal || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breeding_pairs'] });
      toast({ title: 'Avelspar skapat ✓' });
      setOpen(false);
      setForm({ name: '', rooster_id: '', hen_ids: [], start_date: new Date().toISOString().split('T')[0], goal: '', notes: '' });
    },
    onError: (e: any) => toast({ title: 'Kunde inte spara', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('breeding_pairs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breeding_pairs'] });
      toast({ title: 'Borttaget' });
    },
  });

  const roosters = hens.filter((h: any) => h.hen_type === 'rooster');
  const hensOnly = hens.filter((h: any) => h.hen_type !== 'rooster');

  const toggleHen = (id: string) => {
    setForm(f => ({ ...f, hen_ids: f.hen_ids.includes(id) ? f.hen_ids.filter(x => x !== id) : [...f.hen_ids, id] }));
  };

  const henName = (id: string) => hens.find((h: any) => h.id === id)?.name || '–';

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2"><Plus className="h-4 w-4" /> Nytt avelspar</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-serif">Nytt avelspar</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Namn på paret</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="T.ex. Linje A 2026" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tupp</Label>
                <Select value={form.rooster_id || 'none'} onValueChange={(v) => setForm({ ...form, rooster_id: v === 'none' ? '' : v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Välj tupp" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen tupp</SelectItem>
                    {roosters.map((r: any) => <SelectItem key={r.id} value={r.id}>🐓 {r.name}{r.breed ? ` · ${r.breed}` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hönor i paret</Label>
                <div className="border border-border/60 rounded-xl p-2 max-h-48 overflow-y-auto space-y-1">
                  {hensOnly.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2">Inga aktiva hönor</p>
                  ) : hensOnly.map((h: any) => (
                    <label key={h.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.hen_ids.includes(h.id)}
                        onChange={() => toggleHen(h.id)}
                        className="accent-primary"
                      />
                      <span className="text-sm">🐔 {h.name}{h.breed ? ` · ${h.breed}` : ''}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Startdatum</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Avelsmål</Label>
                <Input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="T.ex. Storlek, läggförmåga, färg" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Anteckningar</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl min-h-[60px]" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Avbryt</Button>
              <Button className="rounded-xl" disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Spara'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : pairs.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Inga avelspar ännu"
          description="Skapa avelspar för att hålla koll på vilken tupp som parats med vilka hönor – bra för stamträd och kläckningsplanering."
        />
      ) : (
        <div className="space-y-2">
          {pairs.map((p: any) => (
            <Card key={p.id} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-base text-foreground">{p.name}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {p.rooster_id && (
                        <Badge variant="outline" className="text-[10px]">🐓 {henName(p.rooster_id)}</Badge>
                      )}
                      {(p.hen_ids || []).map((hid: string) => (
                        <Badge key={hid} variant="outline" className="text-[10px]">🐔 {henName(hid)}</Badge>
                      ))}
                    </div>
                    {p.goal && <p className="text-xs text-muted-foreground mt-2"><strong>Mål:</strong> {p.goal}</p>}
                    {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Sedan {new Date(p.start_date).toLocaleDateString('sv-SE')}
                      {p.end_date && ` – ${new Date(p.end_date).toLocaleDateString('sv-SE')}`}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => { if (confirm('Ta bort avelsparet?')) del.mutate(p.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive/70" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function HatchSessionsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', breeding_pair_id: '', incubator_type: '',
    set_date: new Date().toISOString().split('T')[0],
    eggs_set: '', eggs_fertile: '', eggs_hatched: '',
    temperature_avg: '', humidity_avg: '', notes: '',
  });

  const { data: pairs = [] } = useQuery({
    queryKey: ['breeding_pairs', 'min'],
    queryFn: async () => {
      const { data } = await supabase.from('breeding_pairs').select('id, name').order('start_date', { ascending: false });
      return data ?? [];
    },
  });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['hatch_sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hatch_sessions')
        .select('*, breeding_pairs:breeding_pair_id(name)')
        .order('set_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Ej inloggad');
      const { error } = await supabase.from('hatch_sessions').insert({
        user_id: user.id,
        name: form.name,
        breeding_pair_id: form.breeding_pair_id || null,
        incubator_type: form.incubator_type || null,
        set_date: form.set_date,
        eggs_set: Number(form.eggs_set) || 0,
        eggs_fertile: form.eggs_fertile ? Number(form.eggs_fertile) : null,
        eggs_hatched: form.eggs_hatched ? Number(form.eggs_hatched) : null,
        temperature_avg: form.temperature_avg ? Number(form.temperature_avg) : null,
        humidity_avg: form.humidity_avg ? Number(form.humidity_avg) : null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hatch_sessions'] });
      toast({ title: 'Kläckningssession sparad ✓' });
      setOpen(false);
      setForm({
        name: '', breeding_pair_id: '', incubator_type: '',
        set_date: new Date().toISOString().split('T')[0],
        eggs_set: '', eggs_fertile: '', eggs_hatched: '',
        temperature_avg: '', humidity_avg: '', notes: '',
      });
    },
    onError: (e: any) => toast({ title: 'Kunde inte spara', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('hatch_sessions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hatch_sessions'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2"><Plus className="h-4 w-4" /> Ny kläckning</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-serif">Ny kläckningssession</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Namn</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="T.ex. Kläckning maj-26" className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Insatt datum</Label>
                  <Input type="date" value={form.set_date} onChange={(e) => setForm({ ...form, set_date: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ägg insatta</Label>
                  <Input type="number" min={0} value={form.eggs_set} onChange={(e) => setForm({ ...form, eggs_set: e.target.value })} className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Avelspar (valfritt)</Label>
                <Select value={form.breeding_pair_id || 'none'} onValueChange={(v) => setForm({ ...form, breeding_pair_id: v === 'none' ? '' : v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Inget par" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Inget par</SelectItem>
                    {pairs.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Inkubator</Label>
                <Input value={form.incubator_type} onChange={(e) => setForm({ ...form, incubator_type: e.target.value })} placeholder="T.ex. Brinsea Mini II" className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Befruktade</Label>
                  <Input type="number" min={0} value={form.eggs_fertile} onChange={(e) => setForm({ ...form, eggs_fertile: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kläckta</Label>
                  <Input type="number" min={0} value={form.eggs_hatched} onChange={(e) => setForm({ ...form, eggs_hatched: e.target.value })} className="rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Snitt-temp (°C)</Label>
                  <Input type="number" step="0.1" value={form.temperature_avg} onChange={(e) => setForm({ ...form, temperature_avg: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Snitt-fukt (%)</Label>
                  <Input type="number" step="0.1" value={form.humidity_avg} onChange={(e) => setForm({ ...form, humidity_avg: e.target.value })} className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Anteckningar</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl min-h-[60px]" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Avbryt</Button>
              <Button className="rounded-xl" disabled={!form.name.trim() || !form.eggs_set || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Spara'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={Baby}
          title="Inga kläckningar loggade"
          description="Logga insättning, befruktning, kläckning och tempvärden för att över tid se din kläckningsstatistik."
        />
      ) : (
        <div className="space-y-2">
          {sessions.map((s: any) => {
            const successRate = s.eggs_set > 0 && s.eggs_hatched != null
              ? Math.round((s.eggs_hatched / s.eggs_set) * 100)
              : null;
            return (
              <Card key={s.id} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-base text-foreground">{s.name}</h3>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Egg className="h-3 w-3" /> Satt: {s.eggs_set}
                        </Badge>
                        {s.eggs_fertile != null && (
                          <Badge variant="outline" className="text-[10px]">Befr: {s.eggs_fertile}</Badge>
                        )}
                        {s.eggs_hatched != null && (
                          <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                            Kläckta: {s.eggs_hatched}
                          </Badge>
                        )}
                        {successRate != null && (
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                            {successRate}% lyckande
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Insatt {new Date(s.set_date).toLocaleDateString('sv-SE')}
                        {s.expected_hatch_date && ` · väntad kläckning ${new Date(s.expected_hatch_date).toLocaleDateString('sv-SE')}`}
                      </p>
                      {s.breeding_pairs?.name && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">Avelspar: {s.breeding_pairs.name}</p>
                      )}
                      {s.notes && <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>}
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => { if (confirm('Ta bort?')) del.mutate(s.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive/70" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useSearchParams } from 'react-router-dom';
import HatchingPage from './Hatching';

export default function Breeding() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'pairs';
  const setTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', v);
    setSearchParams(next, { replace: true });
  };

  return (
    <PremiumGate feature="Avel & kläckning" featureKey="breeding" blur={false}>
      <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
        <div>
          <h1 className="font-serif text-2xl text-foreground flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Avel & kläckning
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hantera avelspar, planera kläckningar och bygg upp stamträd över tid.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-3 max-w-xl">
            <TabsTrigger value="pairs">Avel</TabsTrigger>
            <TabsTrigger value="hatching">Kläckning</TabsTrigger>
            <TabsTrigger value="hatches">Kläckningslogg</TabsTrigger>
          </TabsList>
          <TabsContent value="pairs" className="mt-4"><PairsTab /></TabsContent>
          <TabsContent value="hatching" className="mt-4"><HatchingPage /></TabsContent>
          <TabsContent value="hatches" className="mt-4"><HatchSessionsTab /></TabsContent>
        </Tabs>
      </div>
    </PremiumGate>
  );
}
