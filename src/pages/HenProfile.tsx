import React, { useState, useEffect } from 'react';
import { todayLocal } from '@/lib/datetime';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Egg, Heart, Calendar, TrendingUp, Share2, Edit2, Loader2, Save, X,
  Link2, Facebook, Instagram, Mail, MessageSquare, Plus, BarChart3, Feather, Stethoscope,
  Trash2, Pencil,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import HenAvatar from '@/components/HenAvatar';
import EmptyState from '@/components/EmptyState';
import AIHealthNoteHelper from '@/components/AIHealthNoteHelper';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PremiumGate } from '@/components/PremiumGate';
import HenPedigree from '@/components/hen/HenPedigree';
import HenPhotoTimeline from '@/components/hen/HenPhotoTimeline';
import SetParentsDialog from '@/components/hen/SetParentsDialog';
import { GitBranch, Camera, Users } from 'lucide-react';

function QuickEggLog({ henId, henName }: { henId: string; henName: string }) {
  const [count, setCount] = useState('1');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleQuickLog = async () => {
    if (!count || Number(count) <= 0) return;
    setSaving(true);
    try {
      await api.createEggRecord({
        date: todayLocal(),
        count: Number(count),
        hen_id: henId,
      });
      queryClient.invalidateQueries({ queryKey: ['eggs'] });
      queryClient.invalidateQueries({ queryKey: ['hen-profile', henId] });
      toast({ title: `Snyggt, ${count} ägg är loggat för ${henName}! 🥚` });
      setCount('1');
    } catch (err: any) {
      toast({ title: 'Något gick fel', description: 'Vi kunde inte spara ägget just nu. Kontrollera anslutningen och försök igen.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-primary/15 shadow-sm bg-primary/[0.02]">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-foreground mb-2.5 flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5 text-primary" /> Snabblogga ägg för {henName}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 rounded-xl"
              onClick={() => setCount(String(Math.max(1, Number(count) - 1)))}
              aria-label="Minska antal ägg"
            >−</Button>
            <Input
              type="number"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-16 h-9 text-center rounded-xl font-semibold"
              min={1}
              aria-label="Antal ägg"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 rounded-xl"
              onClick={() => setCount(String(Number(count) + 1))}
              aria-label="Öka antal ägg"
            >+</Button>
          </div>
          <Button
            size="sm"
            className="h-9 rounded-xl gap-1.5 flex-1"
            onClick={handleQuickLog}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Egg className="h-3.5 w-3.5" />}
            Logga idag
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HenProfile() {
  const { henId } = useParams<{ henId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', breed: '', color: '', birth_date: '', notes: '', flock_id: 'none', status: 'active' as 'active' | 'sold' | 'deceased', death_date: '', death_cause: '' });
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [healthNoteOpen, setHealthNoteOpen] = useState(false);
  const [healthNoteText, setHealthNoteText] = useState('');
  const [healthNoteType, setHealthNoteType] = useState<string>('observation');
  const [editingHealthNoteId, setEditingHealthNoteId] = useState<string | null>(null);
  const [parentsOpen, setParentsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });
  }, []);

  const { data: hen, isLoading: henLoading } = useQuery({
    queryKey: ['hen-profile', henId],
    queryFn: () => api.getHenProfile(henId!),
    enabled: !!henId,
  });

  const { data: allEggs = [] } = useQuery({
    queryKey: ['eggs'],
    queryFn: () => api.getEggs(),
    staleTime: 60_000,
  });

  const { data: flocks = [] } = useQuery({
    queryKey: ['flocks'],
    queryFn: () => api.getFlocks(),
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.updateHen(henId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hen-profile', henId] });
      queryClient.invalidateQueries({ queryKey: ['hens'] });
      toast({ title: 'Ändringarna är sparade! 🐔' });
      setEditing(false);
    },
    onError: (err: any) => toast({ title: 'Något gick fel', description: 'Vi kunde inte spara ändringarna just nu. Kontrollera anslutningen och försök igen.', variant: 'destructive' }),
  });

  const healthNoteMutation = useMutation({
    mutationFn: async (payload: { text: string; type: string; id?: string | null }) => {
      if (payload.id) {
        return api.updateHealthLog(payload.id, { type: payload.type, description: payload.text });
      }
      return api.createHealthLog({
        date: todayLocal(),
        type: payload.type,
        description: payload.text,
        hen_id: henId!,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hen-profile', henId] });
      queryClient.invalidateQueries({ queryKey: ['health-logs'] });
      toast({ title: editingHealthNoteId ? 'Hälsonotering uppdaterad 💚' : 'Hälsonotering sparad 💚' });
      setHealthNoteOpen(false);
      setHealthNoteText('');
      setEditingHealthNoteId(null);
    },
    onError: () => toast({ title: 'Något gick fel', description: 'Vi kunde inte spara noteringen just nu.', variant: 'destructive' }),
  });

  const deleteHealthNoteMutation = useMutation({
    mutationFn: (id: string) => api.deleteHealthLog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hen-profile', henId] });
      queryClient.invalidateQueries({ queryKey: ['health-logs'] });
      toast({ title: 'Hälsonotering borttagen' });
    },
    onError: () => toast({ title: 'Något gick fel', description: 'Kunde inte ta bort noteringen.', variant: 'destructive' }),
  });

  const startEditingHealthNote = (log: any) => {
    setEditingHealthNoteId(log.id);
    setHealthNoteText(log.description || '');
    setHealthNoteType(log.type || 'observation');
    setHealthNoteOpen(true);
  };

  const startNewHealthNote = () => {
    setEditingHealthNoteId(null);
    setHealthNoteText('');
    setHealthNoteType('observation');
    setHealthNoteOpen(true);
  };

  const followUpReminder = async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      await api.createChore(
        `Följ upp ${hen?.name ?? 'hönan'}`,
        'Titta till hönan och notera om något ändrats sedan igår.',
        { recurrence: 'none', next_due_at: tomorrow.toISOString(), reminder_enabled: true, reminder_hours_before: 0 },
      );
      queryClient.invalidateQueries({ queryKey: ['daily-chores'] });
      toast({ title: 'Påminnelse skapad för imorgon ✓' });
    } catch (e: any) {
      toast({ title: 'Kunde inte skapa påminnelse', description: e?.message ?? '', variant: 'destructive' });
    }
  };

  const startEditing = () => {
    if (!hen) return;
    const status: 'active' | 'sold' | 'deceased' = hen.is_active
      ? 'active'
      : ((hen as any).death_date ? 'deceased' : 'sold');
    setEditForm({
      name: hen.name || '',
      breed: hen.breed || '',
      color: hen.color || '',
      birth_date: hen.birth_date || '',
      notes: hen.notes || '',
      flock_id: hen.flock_id || 'none',
      status,
      death_date: (hen as any).death_date || '',
      death_cause: (hen as any).death_cause || '',
    });
    setEditing(true);
  };

  const handleSave = () => {
    const isActive = editForm.status === 'active';
    updateMutation.mutate({
      name: editForm.name,
      breed: editForm.breed || null,
      color: editForm.color || null,
      birth_date: editForm.birth_date || null,
      notes: editForm.notes || null,
      flock_id: editForm.flock_id === 'none' ? null : editForm.flock_id,
      is_active: isActive,
      death_date: editForm.status === 'deceased' ? (editForm.death_date || todayLocal()) : null,
      death_cause: editForm.status === 'deceased' ? (editForm.death_cause || null) : (editForm.status === 'sold' ? 'Såld' : null),
    });
  };

  if (henLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Laddar hönsprofilen...</p>
        </div>
      </div>
    );
  }

  if (!hen) {
    return (
      <div className="max-w-xl mx-auto py-10">
        <EmptyState
          icon={Feather}
          title="Hönan hittades inte"
          description="Den här profilen finns inte längre eller så saknar du åtkomst till den. Gå tillbaka till flocken och välj en annan höna."
          actionLabel="Tillbaka till hönor"
          onAction={() => navigate('/app/hens')}
        />
      </div>
    );
  }

  const isRooster = hen.hen_type === 'rooster';
  const henEggs = (allEggs as any[]).filter((e: any) => e.hen_id === henId);
  const totalEggs = henEggs.reduce((sum: number, e: any) => sum + (e.count || 0), 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekEggs = henEggs.filter((e: any) => new Date(e.date) >= weekAgo).reduce((sum: number, e: any) => sum + (e.count || 0), 0);

  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const monthEggs = henEggs.filter((e: any) => new Date(e.date) >= monthAgo).reduce((sum: number, e: any) => sum + (e.count || 0), 0);

  const dailyCounts: Record<string, number> = {};
  henEggs.forEach((e: any) => { dailyCounts[e.date] = (dailyCounts[e.date] || 0) + e.count; });
  const bestDay = Object.entries(dailyCounts).sort(([, a], [, b]) => b - a)[0];
  const latestEgg = henEggs.slice().sort((a: any, b: any) => b.date.localeCompare(a.date))[0];

  let ageText = '';
  if (hen.birth_date) {
    const birth = new Date(hen.birth_date);
    const now = new Date();
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
    if (months < 12) ageText = `${months} månader`;
    else {
      const years = Math.floor(months / 12);
      const rem = months % 12;
      ageText = `${years} år${rem > 0 ? ` ${rem} mån` : ''}`;
    }
  }

  const avgPerWeek = monthEggs > 0 ? Math.round((monthEggs / 30) * 7 * 10) / 10 : 0;
  const healthLogs = (hen.health_logs || []).slice(0, 5);
  const latestNote = hen.notes || healthLogs[0]?.description || null;

  const shareUrl = `${window.location.origin}/app/hens/${henId}`;
  const shareText = `${isRooster ? '🐓' : '🐔'} ${hen.name}${hen.breed ? ` (${hen.breed})` : ''}\n${!isRooster ? `🥚 ${totalEggs} ägg totalt\n` : ''}Logga dina höns på honsgarden.se`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast({ title: 'Länken är kopierad! 📋' });
    setShareOpen(false);
  };

  const shareVia = (platform: 'facebook' | 'instagram' | 'email' | 'sms') => {
    const encoded = encodeURIComponent(shareUrl);
    const textEncoded = encodeURIComponent(shareText);
    if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encoded}`, '_blank');
    } else if (platform === 'instagram') {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast({ title: 'Texten är kopierad!', description: 'Klistra in den i Instagram när du vill dela.' });
    } else if (platform === 'email') {
      window.open(`mailto:?subject=${encodeURIComponent(`${hen.name} – Hönsgården`)}&body=${textEncoded}%0A${encoded}`, '_blank');
    } else if (platform === 'sms') {
      window.open(`sms:?body=${textEncoded}%0A${encoded}`, '_blank');
    }
    setShareOpen(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in pb-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate('/app/hens')} aria-label="Tillbaka till hönor">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">Tillbaka till hönor</span>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-primary/40 via-accent/30 to-primary/20" />
        <CardContent className="p-6">
          {editing ? (
            <div className="space-y-4">
              <h2 className="font-serif text-lg text-foreground text-center mb-2">Redigera {isRooster ? 'tupp' : 'höna'}</h2>
              <div>
                <Label>Namn</Label>
                <Input className="mt-1.5 rounded-xl" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ras</Label>
                  <Input className="mt-1.5 rounded-xl" value={editForm.breed} onChange={(e) => setEditForm({ ...editForm, breed: e.target.value })} />
                </div>
                <div>
                  <Label>Färg</Label>
                  <Input className="mt-1.5 rounded-xl" value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Flock</Label>
                <Select value={editForm.flock_id} onValueChange={(v) => setEditForm({ ...editForm, flock_id: v })}>
                  <SelectTrigger className="mt-1.5 rounded-xl">
                    <SelectValue placeholder="Ingen flock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen flock</SelectItem>
                    {(flocks as any[]).map((flock: any) => (
                      <SelectItem key={flock.id} value={flock.id}>{flock.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Födelsedatum eller kläckdatum</Label>
                <Input className="mt-1.5 rounded-xl" type="date" value={editForm.birth_date} onChange={(e) => setEditForm({ ...editForm, birth_date: e.target.value })} />
              </div>
              <div>
                <Label>Personlighet och anteckningar</Label>
                <Textarea className="mt-1.5 rounded-xl resize-none" rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="T.ex. nyfiken, lugn, gillar att ruva eller extra social." />
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
                <div>
                  <Label className="text-sm">Status</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">Markera om {isRooster ? 'tuppen' : 'hönan'} har sålts eller gått bort. Inaktiva {isRooster ? 'tuppar' : 'hönor'} räknas inte med i statistiken.</p>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as 'active' | 'sold' | 'deceased' })}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">🐔 Aktiv – finns kvar i flocken</SelectItem>
                      <SelectItem value="sold">📦 Såld eller bortskänkt</SelectItem>
                      <SelectItem value="deceased">🕊️ Avliden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editForm.status === 'deceased' && (
                  <>
                    <div>
                      <Label className="text-xs">Datum (valfritt)</Label>
                      <Input className="mt-1 rounded-xl" type="date" value={editForm.death_date} onChange={(e) => setEditForm({ ...editForm, death_date: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Orsak (valfritt)</Label>
                      <Input className="mt-1 rounded-xl" value={editForm.death_cause} onChange={(e) => setEditForm({ ...editForm, death_cause: e.target.value })} placeholder="T.ex. ålder, sjukdom, rovdjur" />
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 rounded-xl h-10 gap-2" onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Spara
                </Button>
                <Button variant="outline" className="rounded-xl h-10 gap-2" onClick={() => setEditing(false)}>
                  <X className="h-4 w-4" /> Avbryt
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <HenAvatar
                  henId={hen.id}
                  henType={hen.hen_type}
                  imageUrl={hen.image_url}
                  size="lg"
                  editable
                  showProfileActions
                />
              </div>
              <p className="text-xs text-muted-foreground mb-1">{isRooster ? 'Tupprofil' : 'Hönsprofil'}</p>
              <h1 className="text-2xl font-serif text-foreground mb-1">{hen.name}</h1>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {hen.flock_id && (() => {
                  const flock = (flocks as any[]).find((f: any) => f.id === hen.flock_id);
                  return flock ? <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">🏠 {flock.name}</Badge> : null;
                })()}
                {hen.breed && <Badge variant="secondary" className="text-xs">{hen.breed}</Badge>}
                {hen.color && <Badge variant="secondary" className="text-xs">{hen.color}</Badge>}
                <Badge variant="secondary" className={`text-xs ${hen.is_active ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                  {hen.is_active ? 'Aktiv' : 'Inaktiv'}
                </Badge>
                {isRooster && <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">Tupp</Badge>}
              </div>
              {ageText && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> {ageText} gammal
                </p>
              )}
              {!hen.image_url && (
                <p className="text-xs text-muted-foreground mt-3">Tips: lägg gärna till en bild så profilen känns mer personlig.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!editing && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full rounded-xl">
            <TabsTrigger value="overview" className="rounded-lg text-xs gap-1.5">
              <Heart className="h-3.5 w-3.5" /> Översikt
            </TabsTrigger>
            <TabsTrigger value="pedigree" className="rounded-lg text-xs gap-1.5">
              <GitBranch className="h-3.5 w-3.5" /> Stamtavla
            </TabsTrigger>
            <TabsTrigger value="photos" className="rounded-lg text-xs gap-1.5">
              <Camera className="h-3.5 w-3.5" /> Bilder
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5 mt-5">
            <Card className="border-border/50 shadow-sm bg-card/70">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Heart className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-serif text-base text-foreground">Om {hen.name}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                      {latestNote || `Här kan du samla personlighet, hälsa, ägghistorik och viktiga händelser för ${hen.name}. Lägg gärna till en anteckning för att göra profilen mer levande.`}
                    </p>
                    {latestEgg && !isRooster && (
                      <p className="text-xs text-muted-foreground mt-2">Senaste äggnotering: {latestEgg.count} ägg den {new Date(latestEgg.date).toLocaleDateString('sv-SE')}.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              variant="outline"
              className="w-full rounded-xl h-10 gap-2 text-sm"
              onClick={() => setParentsOpen(true)}
            >
              <Users className="h-4 w-4" />
              {hen.mother_id || hen.father_id ? 'Uppdatera föräldrar' : 'Sätt föräldrar'}
            </Button>

            {!isRooster && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { icon: Egg, value: totalEggs, label: 'Totalt', color: 'text-primary', bg: 'bg-primary/8' },
                  { icon: TrendingUp, value: weekEggs, label: 'Veckan', color: 'text-accent', bg: 'bg-accent/8' },
                  { icon: Calendar, value: monthEggs, label: '30 dagar', color: 'text-muted-foreground', bg: 'bg-muted/60' },
                  { icon: TrendingUp, value: avgPerWeek, label: 'Ägg/vecka', color: 'text-success', bg: 'bg-success/8' },
                ].map(({ icon: Icon, value, label, color, bg }, i) => (
                  <Card key={i} className="border-border/50 shadow-sm">
                    <CardContent className="p-3 text-center">
                      <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mx-auto mb-1.5`}>
                        <Icon className={`h-4 w-4 ${color}`} />
                      </div>
                      <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest">{label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!isRooster && <QuickEggLog henId={henId!} henName={hen.name} />}

            {!isRooster && henEggs.length === 0 && (
              <EmptyState
                icon={Egg}
                title={`Ingen ägghistorik för ${hen.name} ännu`}
                description="När du loggar ägg direkt på den här hönan kan Hönsgården visa personlig statistik, bästa värpdag och utveckling över tid."
                actionLabel="Logga ägg för hönan"
                onAction={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              />
            )}

            {!isRooster && henEggs.length > 0 && (
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-primary/60" />
                    <span className="font-serif text-sm text-foreground">Ägghistorik – senaste 14 dagarna</span>
                  </div>
                  <div className="flex items-end gap-1 h-16">
                    {Array.from({ length: 14 }).map((_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - (13 - i));
                      const dateStr = d.toISOString().split('T')[0];
                      const count = dailyCounts[dateStr] || 0;
                      const maxCount = Math.max(...Object.values(dailyCounts), 1);
                      const h = count > 0 ? Math.max(15, (count / maxCount) * 100) : 5;
                      return (
                        <motion.div
                          key={i}
                          className="flex-1 flex flex-col items-center gap-0.5"
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                        >
                          <motion.div
                            className={`w-full rounded-t-md ${count > 0 ? 'bg-primary/30' : 'bg-muted/40'}`}
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            transition={{ duration: 0.4, delay: i * 0.03 }}
                            style={{ minHeight: count > 0 ? 8 : 3 }}
                          />
                          {i % 2 === 0 && (
                            <span className="text-[8px] text-muted-foreground">{d.getDate()}</span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {bestDay && (
              <Card className="border-warning/15 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <span className="text-2xl">🏆</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Bästa värpdag</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(bestDay[0]).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })} – {bestDay[1]} ägg
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {healthLogs.length > 0 ? (
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <Heart className="h-4 w-4 text-destructive/60" />
                      <h3 className="font-serif text-sm text-foreground">Hälsa och anteckningar</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-8 text-xs gap-1.5"
                      onClick={startNewHealthNote}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ny notering
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {healthLogs.map((log: any) => (
                      <div key={log.id} className="flex gap-3 items-start p-2.5 rounded-xl bg-muted/30 border border-border/20 group">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5 font-medium bg-muted/60 px-2 py-0.5 rounded-md">
                          {new Date(log.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                        </span>
                        <div className="flex-1 min-w-0">
                          {log.type && <span className="text-[10px] text-primary font-medium uppercase">{log.type}</span>}
                          <p className="text-xs text-foreground whitespace-pre-wrap break-words">{log.description || '–'}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => startEditingHealthNote(log)}
                            aria-label="Redigera notering"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (window.confirm('Ta bort denna hälsonotering?')) {
                                deleteHealthNoteMutation.mutate(log.id);
                              }
                            }}
                            disabled={deleteHealthNoteMutation.isPending}
                            aria-label="Ta bort notering"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                icon={Heart}
                title="Inga hälsonoteringar ännu"
                description={`När något händer med ${hen.name} kan du samla anteckningar här – till exempel ruggningsperiod, sjukdom, veterinärbesök eller personliga observationer. Hönsgården hjälper dig formulera och påminner om vad du kan hålla koll på.`}
                actionLabel="Lägg till hälsonotering"
                onAction={startNewHealthNote}
              />
            )}

            <div className="flex gap-2">
              <Button className="flex-1 rounded-xl h-11 gap-2" onClick={() => setShareOpen(true)}>
                <Share2 className="h-4 w-4" />
                Dela {hen.name}
              </Button>
              <Button variant="outline" className="rounded-xl h-11 gap-2" onClick={startEditing}>
                <Edit2 className="h-4 w-4" />
                Redigera
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="pedigree" className="mt-5">
            <PremiumGate feature="Stamtavla" featureKey="breeding" blur>
              <HenPedigree
                henId={henId!}
                henName={hen.name}
                henBirthDate={hen.birth_date}
                motherId={hen.mother_id ?? null}
                fatherId={hen.father_id ?? null}
              />
            </PremiumGate>
          </TabsContent>

          <TabsContent value="photos" className="mt-5">
            <HenPhotoTimeline henId={henId!} henName={hen.name} />
          </TabsContent>
        </Tabs>
      )}

      <SetParentsDialog
        open={parentsOpen}
        onOpenChange={setParentsOpen}
        henId={henId!}
        currentMotherId={hen.mother_id ?? null}
        currentFatherId={hen.father_id ?? null}
        henBirthDate={hen.birth_date ?? null}
      />


      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-center">Dela {hen.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-3 rounded-xl h-12" onClick={copyLink}>
              <Link2 className="h-4 w-4 text-primary" /> Kopiera länk
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 rounded-xl h-12" onClick={() => shareVia('facebook')}>
              <Facebook className="h-4 w-4 text-[#1877F2]" /> Dela på Facebook
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 rounded-xl h-12" onClick={() => shareVia('instagram')}>
              <Instagram className="h-4 w-4 text-[#E4405F]" /> Kopiera för Instagram
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 rounded-xl h-12" onClick={() => shareVia('email')}>
              <Mail className="h-4 w-4 text-muted-foreground" /> Skicka via e-post
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 rounded-xl h-12" onClick={() => shareVia('sms')}>
              <MessageSquare className="h-4 w-4 text-success" /> Skicka via SMS
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!editing && !isLoggedIn && (
        <Card className="bg-primary/5 border-primary/15">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">
              🐔 Starta din egen hönsgård i appen →{' '}
              <a href="/" className="text-primary font-semibold hover:underline">honsgarden.se</a>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Health Note Dialog with AI Helper */}
      <Dialog open={healthNoteOpen} onOpenChange={(open) => { setHealthNoteOpen(open); if (!open) { setEditingHealthNoteId(null); setHealthNoteText(''); } }}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              {editingHealthNoteId ? 'Redigera hälsonotering' : 'Hälsonotering'} – {hen.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingHealthNoteId
                ? 'Ändra typ eller text och spara dina justeringar.'
                : 'Skriv en kort observation. Hönsgården kan hjälpa dig formulera den tydligare och föreslå vad du kan hålla koll på.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Typ</Label>
              <Select value={healthNoteType} onValueChange={setHealthNoteType}>
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="observation">Observation</SelectItem>
                  <SelectItem value="symptom">Symtom</SelectItem>
                  <SelectItem value="behandling">Behandling</SelectItem>
                  <SelectItem value="veterinär">Veterinärbesök</SelectItem>
                  <SelectItem value="ruggning">Ruggning</SelectItem>
                  <SelectItem value="diary">Dagbok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Din notering</Label>
              <Textarea
                placeholder={`T.ex. "${hen.name} verkar lite hängig och äter sämre idag"`}
                value={healthNoteText}
                onChange={(e) => setHealthNoteText(e.target.value)}
                className="min-h-[100px] resize-none rounded-xl border-border/60 focus:border-primary/40"
              />
            </div>

            <AIHealthNoteHelper
              noteText={healthNoteText}
              henName={hen.name}
              henBreed={hen.breed}
              henAgeYears={hen.birth_date ? Math.max(0, Math.round((Date.now() - new Date(hen.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))) : null}
              recentNotes={healthLogs.slice(0, 3).map((l: any) => ({ date: l.date, description: l.description || '' }))}
              onUseImprovedNote={(improved) => setHealthNoteText(improved)}
              onCreateFollowUp={followUpReminder}
            />

            <div className="flex gap-2 pt-2 border-t border-border/40">
              <Button
                className="flex-1 rounded-xl h-10"
                disabled={!healthNoteText.trim() || healthNoteMutation.isPending}
                onClick={() => healthNoteMutation.mutate({ text: healthNoteText.trim(), type: healthNoteType, id: editingHealthNoteId })}
              >
                {healthNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingHealthNoteId ? 'Spara ändringar' : 'Spara hälsonotering')}
              </Button>
              <Button variant="outline" className="rounded-xl h-10" onClick={() => { setHealthNoteOpen(false); setEditingHealthNoteId(null); }}>
                Avbryt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
