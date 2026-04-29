import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Bird, Loader2, Trash2, ChevronRight, Feather, FolderPlus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import HenAvatar from '@/components/HenAvatar';

export default function Hens() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [tab, setTab] = useState('alla');
  const [selectedFlock, setSelectedFlock] = useState<string | null>(null);

  // Hen dialog
  const [henDialogOpen, setHenDialogOpen] = useState(false);
  const [henForm, setHenForm] = useState({ name: '', breed: '', color: '', birth_date: '', notes: '', hen_type: 'hen', flock_id: '' });

  // Flock dialog
  const [flockDialogOpen, setFlockDialogOpen] = useState(false);
  const [flockForm, setFlockForm] = useState({ name: '', description: '' });

  // Quick add flock inline
  const [quickFlockName, setQuickFlockName] = useState('');
  const [showQuickFlock, setShowQuickFlock] = useState(false);

  // Edit flock dialog
  const [editFlockId, setEditFlockId] = useState<string | null>(null);

  const { data: hens = [], isLoading: hensLoading } = useQuery({
    queryKey: ['hens'],
    queryFn: () => api.getHens(),
  });

  const { data: flocks = [], isLoading: flocksLoading } = useQuery({
    queryKey: ['flocks'],
    queryFn: () => api.getFlocks(),
  });

  const isLoading = hensLoading || flocksLoading;

  const createHenMutation = useMutation({
    mutationFn: async (data: any) => {
      // Auto-assign to default flock if no flock selected
      if (!data.flock_id) {
        const defaultFlock = await api.getOrCreateDefaultFlock();
        data.flock_id = defaultFlock.id;
      }
      return api.createHen(data);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['hens'] });
      queryClient.invalidateQueries({ queryKey: ['flocks'] });
      queryClient.invalidateQueries({ queryKey: ['coop-settings'] });
      // Sync hen count to coop settings
      try {
        const allHens = await api.getHens();
        const activeCount = (allHens as any[]).filter((h: any) => h.is_active && h.hen_type !== 'rooster').length;
        await api.updateCoopSettings({ hen_count: activeCount });
      } catch (err) {
        console.warn('[Hens] Kunde inte synka antal hönor till coop_settings efter create:', err);
      }
      toast({ title: henForm.hen_type === 'rooster' ? 'Tupp tillagd! 🐓' : 'Höna tillagd! 🐔' });
      setHenDialogOpen(false);
      setHenForm({ name: '', breed: '', color: '', birth_date: '', notes: '', hen_type: 'hen', flock_id: '' });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const updateHenMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateHen(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hens'] });
      toast({ title: 'Uppdaterad!' });
    },
  });

  const deleteHenMutation = useMutation({
    mutationFn: (id: string) => api.deleteHen(id),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['hens'] });
      queryClient.invalidateQueries({ queryKey: ['coop-settings'] });
      try {
        const allHens = await api.getHens();
        const activeCount = (allHens as any[]).filter((h: any) => h.is_active && h.hen_type !== 'rooster').length;
        await api.updateCoopSettings({ hen_count: activeCount });
      } catch (err) {
        console.warn('[Hens] Kunde inte synka antal hönor till coop_settings efter delete:', err);
      }
      toast({ title: 'Borttagen' });
    },
  });

  const createFlockMutation = useMutation({
    mutationFn: (data: any) => api.createFlock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flocks'] });
      toast({ title: 'Flock skapad! 🐔' });
      setFlockDialogOpen(false);
      setFlockForm({ name: '', description: '' });
      setQuickFlockName('');
      setShowQuickFlock(false);
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const deleteFlockMutation = useMutation({
    mutationFn: (id: string) => api.deleteFlock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flocks'] });
      queryClient.invalidateQueries({ queryKey: ['hens'] });
      toast({ title: 'Flock borttagen' });
      setSelectedFlock(null);
    },
  });

  const handleCreateHen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!henForm.name) return;
    createHenMutation.mutate({
      name: henForm.name,
      breed: henForm.breed || null,
      color: henForm.color || null,
      birth_date: henForm.birth_date || null,
      notes: henForm.notes || null,
      hen_type: henForm.hen_type,
      flock_id: henForm.flock_id || null,
    });
  };

  const handleCreateFlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flockForm.name) return;
    createFlockMutation.mutate({
      name: flockForm.name,
      description: flockForm.description || null,
    });
  };

  const handleQuickCreateFlock = () => {
    if (!quickFlockName.trim()) return;
    createFlockMutation.mutate({ name: quickFlockName.trim(), description: null });
  };

  const activeHens = hens.filter((h: any) => h.is_active);
  const filteredHens = showInactive ? hens : activeHens;

  const getDisplayHens = () => {
    if (selectedFlock) return filteredHens.filter((h: any) => h.flock_id === selectedFlock);
    if (tab === 'utan') return filteredHens.filter((h: any) => !h.flock_id);
    if (tab === 'tuppar') return filteredHens.filter((h: any) => h.hen_type === 'rooster');
    return filteredHens;
  };

  const displayHens = getDisplayHens();
  const roosters = filteredHens.filter((h: any) => h.hen_type === 'rooster');
  const hensOnly = filteredHens.filter((h: any) => h.hen_type !== 'rooster');

  const getFlockMemberCount = (flockId: string) => filteredHens.filter((h: any) => h.flock_id === flockId).length;

  const getEmoji = (henType: string) => henType === 'rooster' ? '🐓' : '🐔';

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif text-foreground">
            {selectedFlock ? (flocks as any[]).find((f: any) => f.id === selectedFlock)?.name || 'Flock' : 'Mina Hönor'} 🐔
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hensOnly.length} hönor · {roosters.length} tuppar · {(flocks as any[]).length} flockar
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={flockDialogOpen} onOpenChange={setFlockDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-xl">
                <FolderPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Ny flock</span>
                <span className="sm:hidden">Flock</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-serif text-lg">Skapa flock</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateFlock} className="space-y-4 pt-2">
                <div>
                  <Label>Namn *</Label>
                  <Input className="mt-1.5 rounded-xl" value={flockForm.name} onChange={(e) => setFlockForm({ ...flockForm, name: e.target.value })} placeholder="T.ex. Stora hönsgården" required />
                </div>
                <div>
                  <Label>Beskrivning</Label>
                  <Textarea className="mt-1.5 rounded-xl resize-none" rows={2} value={flockForm.description} onChange={(e) => setFlockForm({ ...flockForm, description: e.target.value })} placeholder="Valfri beskrivning" />
                </div>
                <Button type="submit" className="w-full rounded-xl h-10" disabled={createFlockMutation.isPending}>
                  {createFlockMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Skapa flock
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={henDialogOpen} onOpenChange={setHenDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-xl">
                <Plus className="h-4 w-4" />
                Lägg till
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-serif text-lg">Lägg till höna eller tupp</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateHen} className="space-y-4 pt-2">
                {/* Type selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHenForm({ ...henForm, hen_type: 'hen' })}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      henForm.hen_type === 'hen'
                        ? 'border-primary bg-primary/8 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <span className="text-2xl block mb-1">🐔</span>
                    <span className="text-xs font-medium">Höna</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHenForm({ ...henForm, hen_type: 'rooster' })}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      henForm.hen_type === 'rooster'
                        ? 'border-primary bg-primary/8 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <span className="text-2xl block mb-1">🐓</span>
                    <span className="text-xs font-medium">Tupp</span>
                  </button>
                </div>

                <div>
                  <Label>Namn *</Label>
                  <Input className="mt-1.5 rounded-xl" value={henForm.name} onChange={(e) => setHenForm({ ...henForm, name: e.target.value })} placeholder={henForm.hen_type === 'rooster' ? 'T.ex. Gustav' : 'T.ex. Greta'} required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Ras</Label>
                    <Input className="mt-1.5 rounded-xl" value={henForm.breed} onChange={(e) => setHenForm({ ...henForm, breed: e.target.value })} placeholder="T.ex. Leghorn" />
                  </div>
                  <div>
                    <Label>Färg</Label>
                    <Input className="mt-1.5 rounded-xl" value={henForm.color} onChange={(e) => setHenForm({ ...henForm, color: e.target.value })} placeholder="T.ex. Brun" />
                  </div>
                </div>

                <div>
                  <Label>Flock</Label>
                  <Select value={henForm.flock_id} onValueChange={(v) => setHenForm({ ...henForm, flock_id: v === 'auto' ? '' : v })}>
                    <SelectTrigger className="mt-1.5 rounded-xl">
                      <SelectValue placeholder="Automatisk (Min flock)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">🏠 Automatisk (Min flock)</SelectItem>
                      {(flocks as any[]).map((f: any) => (
                        <SelectItem key={f.id} value={f.id}>🐔 {f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">Lämna som automatisk för att placera i standardflocken</p>
                </div>

                <div>
                  <Label>Födelsedatum</Label>
                  <Input className="mt-1.5 rounded-xl" type="date" value={henForm.birth_date} onChange={(e) => setHenForm({ ...henForm, birth_date: e.target.value })} />
                </div>

                <div>
                  <Label>Anteckningar</Label>
                  <Input className="mt-1.5 rounded-xl" value={henForm.notes} onChange={(e) => setHenForm({ ...henForm, notes: e.target.value })} placeholder="Valfria anteckningar" />
                </div>

                <Button type="submit" className="w-full rounded-xl h-10" disabled={createHenMutation.isPending}>
                  {createHenMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Lägg till {henForm.hen_type === 'rooster' ? 'tupp' : 'höna'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick add flock inline */}
      <div className="flex items-center gap-2 flex-wrap">
        {!showQuickFlock ? (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl text-xs gap-1.5 text-muted-foreground hover:text-primary"
            onClick={() => setShowQuickFlock(true)}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Snabbskapa flock
          </Button>
        ) : (
          <div className="flex items-center gap-2 bg-card border border-border/50 rounded-xl p-1.5 pl-3 shadow-sm">
            <Input
              className="h-7 text-xs rounded-lg border-0 bg-transparent p-0 w-36 sm:w-52 focus-visible:ring-0"
              placeholder="Flocknamn..."
              value={quickFlockName}
              onChange={(e) => setQuickFlockName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleQuickCreateFlock(); if (e.key === 'Escape') { setShowQuickFlock(false); setQuickFlockName(''); } }}
              autoFocus
            />
            <Button
              size="sm"
              className="h-7 text-[10px] rounded-lg px-3"
              disabled={!quickFlockName.trim() || createFlockMutation.isPending}
              onClick={handleQuickCreateFlock}
            >
              {createFlockMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Skapa'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-lg text-muted-foreground"
              onClick={() => { setShowQuickFlock(false); setQuickFlockName(''); }}
            >
              ✕
            </Button>
          </div>
        )}
      </div>

      {/* Flocks section */}
      {(flocks as any[]).length > 0 && !selectedFlock && (
        <div className="space-y-2">
          <h2 className="data-label">Flockar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 stagger-children">
            {(flocks as any[]).map((flock: any) => {
              const flockHens = filteredHens.filter((h: any) => h.flock_id === flock.id);
              const flockRoosters = flockHens.filter((h: any) => h.hen_type === 'rooster').length;
              const flockHensCount = flockHens.filter((h: any) => h.hen_type !== 'rooster').length;

              return (
                <Card
                  key={flock.id}
                  className="border-border/50 shadow-sm card-hover cursor-pointer group"
                  onClick={() => setSelectedFlock(flock.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0 text-xl">
                          🐔
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-serif text-sm text-foreground truncate">{flock.name}</h3>
                          <p className="text-[11px] text-muted-foreground">
                            {flockHensCount} hönor{flockRoosters > 0 ? ` · ${flockRoosters} tuppar` : ''}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                    {flock.description && (
                      <p className="text-[10px] text-muted-foreground/70 mt-2 pl-[52px] truncate">{flock.description}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected flock header */}
      {selectedFlock && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" className="rounded-xl text-xs gap-1 text-muted-foreground" onClick={() => setSelectedFlock(null)}>
              ← Alla
            </Button>
            <Badge variant="secondary" className="rounded-lg text-[10px]">
              {displayHens.length} medlemmar
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/8 ml-auto"
              onClick={() => {
                if (confirm('Ta bort denna flock? Hönorna och tupparna behålls.')) {
                  displayHens.forEach((h: any) => {
                    updateHenMutation.mutate({ id: h.id, data: { flock_id: null } });
                  });
                  deleteFlockMutation.mutate(selectedFlock);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Ta bort flock
            </Button>
          </div>

          {/* Quick-assign unassigned hens to this flock */}
          {(() => {
            const unassigned = filteredHens.filter((h: any) => !h.flock_id || h.flock_id !== selectedFlock);
            const otherHens = filteredHens.filter((h: any) => h.flock_id !== selectedFlock);
            if (!otherHens.length) return null;
            return (
              <Card className="border-dashed border-primary/30 bg-primary/4">
                <CardContent className="p-3">
                  <p className="text-[11px] font-medium text-foreground mb-2 flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5 text-primary" />
                    Lägg till i flocken
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {otherHens.map((hen: any) => (
                      <button
                        key={hen.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border/50 text-[11px] text-foreground hover:border-primary hover:bg-primary/8 transition-all"
                        onClick={() => updateHenMutation.mutate({ id: hen.id, data: { flock_id: selectedFlock } })}
                      >
                        {getEmoji(hen.hen_type)} {hen.name}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      )}

      {/* Tabs */}
      {!selectedFlock && (
        <>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="rounded-xl">
              <TabsTrigger value="alla" className="rounded-lg text-xs">Alla ({filteredHens.length})</TabsTrigger>
              <TabsTrigger value="utan" className="rounded-lg text-xs">Utan flock ({filteredHens.filter((h: any) => !h.flock_id).length})</TabsTrigger>
              <TabsTrigger value="tuppar" className="rounded-lg text-xs">Tuppar ({roosters.length})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Checkbox id="show-inactive" checked={showInactive} onCheckedChange={(checked) => setShowInactive(checked === true)} />
            <label htmlFor="show-inactive" className="text-sm text-muted-foreground cursor-pointer">Visa inaktiva (sålda/avlidna)</label>
          </div>
        </>
      )}

      {/* Hen/Rooster cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger-children">
        {displayHens.map((hen: any) => {
          const henFlock = (flocks as any[]).find((f: any) => f.id === hen.flock_id);
          return (
            <Card key={hen.id} className={`border-border/50 shadow-sm transition-all duration-200 hover:shadow-md cursor-pointer ${!hen.is_active ? 'opacity-50' : ''}`} onClick={() => navigate(`/app/hens/${hen.id}`)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div onClick={(e) => e.stopPropagation()}>
                    <HenAvatar
                      henId={hen.id}
                      henType={hen.hen_type}
                      imageUrl={hen.image_url}
                      size="md"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-sm text-foreground truncate">{hen.name}</h3>
                      {hen.hen_type === 'rooster' && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded-md shrink-0">Tupp</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{hen.breed || 'Okänd ras'}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-destructive shrink-0" onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Ta bort ${hen.name}?`)) deleteHenMutation.mutate(hen.id);
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Flock assignment */}
                <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={hen.flock_id || 'none'}
                    onValueChange={(v) => {
                      updateHenMutation.mutate({
                        id: hen.id,
                        data: { flock_id: v === 'none' ? null : v },
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 text-[11px] rounded-lg border-border/50">
                      <SelectValue placeholder="Ingen flock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen flock</SelectItem>
                      {(flocks as any[]).map((f: any) => (
                        <SelectItem key={f.id} value={f.id}>🐔 {f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-border/40 text-[11px] text-muted-foreground">
                  {hen.color && <span>Färg: {hen.color}</span>}
                  {hen.birth_date && <span>Född: {new Date(hen.birth_date).toLocaleDateString('sv-SE')}</span>}
                  {!hen.color && !hen.birth_date && <span className="text-muted-foreground/50">Ingen extra info</span>}
                </div>

                {hen.notes && (
                  <p className="text-[10px] text-muted-foreground/70 mt-2 italic leading-relaxed">{hen.notes}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty state */}
      {displayHens.length === 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-3">
              <Feather className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-muted-foreground text-sm font-medium mb-1">
              {selectedFlock ? 'Inga medlemmar i denna flock' : 'Inga hönor eller tuppar ännu'}
            </p>
            <p className="text-xs text-muted-foreground/60 mb-4">
              {selectedFlock ? 'Tilldela hönor och tuppar till denna flock' : 'Lägg till din första höna eller tupp'}
            </p>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => setHenDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Lägg till
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
