import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  User, Bell, Shield, LogOut, Loader2, MessageSquare, Mail,
  FileText, HelpCircle, Crown, Download, Upload, Palette, Moon, Sun,
  Heart, ExternalLink, Info, Trash2, CheckCircle2, Clock, Send, RotateCcw, ArrowRight, RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { FamilyMembers } from '@/components/FamilyMembers';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import PremiumStatusCard from '@/components/PremiumStatusCard';
import ReferralCard from '@/components/ReferralCard';
import { MyDataSection } from '@/components/settings/MyDataSection';
import { RegionLanguageSettings } from '@/components/settings/RegionLanguageSettings';
import { isInternationalDomain } from '@/lib/brand';
import { checkForPwaUpdate, isStandalonePwa } from '@/lib/pwaUpdate';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import PageHeader from '@/components/PageHeader';

function PushNotificationsRow() {
  const { supported, enabled, busy, enable, disable, sendTest } = usePushNotifications();

  if (!supported) {
    return (
      <div className="py-2">
        <p className="text-sm font-medium text-foreground">Push-notiser på den här enheten</p>
        <p className="text-xs text-muted-foreground mt-1">
          Push stöds inte i den här webbläsaren. På iPhone: öppna appen, tryck Dela →
          Lägg till på hemskärmen, och slå sedan på push därifrån.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm font-medium text-foreground">Push-notiser på den här enheten</p>
          <p className="text-xs text-muted-foreground">Få påminnelser även när appen är stängd.</p>
        </div>
        <Switch
          checked={enabled}
          disabled={busy}
          onCheckedChange={async (checked) => {
            if (checked) {
              const ok = await enable();
              if (!ok) toast({ title: 'Push aktiverades inte', description: 'Behörighet nekades eller är inte tillgänglig.' });
            } else {
              await disable();
            }
          }}
        />
      </div>
      {enabled && (
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          disabled={busy}
          onClick={async () => {
            await sendTest();
            toast({ title: 'Testnotis skickad 📲' });
          }}
        >
          Skicka testnotis
        </Button>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: coopSettings } = useQuery({
    queryKey: ['coop-settings'],
    queryFn: () => api.getCoopSettings(),
  });

  const { data: reminderSettings } = useQuery({
    queryKey: ['reminder-settings'],
    queryFn: () => api.getReminderSettings(),
  });

  const [coopName, setCoopName] = useState('');
  const [henCount, setHenCount] = useState('');
  const [location, setLocation] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [morningReminder, setMorningReminder] = useState(true);
  const [eveningReminder, setEveningReminder] = useState(true);
  const [weeklyReportEmail, setWeeklyReportEmail] = useState(true);
  const [showHenRace, setShowHenRace] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [supportMsg, setSupportMsg] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    if (coopSettings) {
      setCoopName(coopSettings.coop_name || '');
      setHenCount(String(coopSettings.hen_count || ''));
      setLocation(coopSettings.location || '');
      setPostalCode((coopSettings as any).postal_code || '');
      setCity((coopSettings as any).city || '');
    }
  }, [coopSettings]);

  useEffect(() => {
    if (reminderSettings) {
      setMorningReminder(reminderSettings.morning_reminder ?? true);
      setEveningReminder(reminderSettings.evening_reminder ?? true);
    }
  }, [reminderSettings]);

  // Load weekly report preference from profile
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    supabase.from('profiles').select('preferences').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      if (data?.preferences && typeof data.preferences === 'object') {
        const prefs = data.preferences as Record<string, unknown>;
        setWeeklyReportEmail(prefs.weekly_report_email !== false);
        setShowHenRace(prefs.hide_weekly_hen_race !== true);
      }
    }, () => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    setDisplayName(user?.name || '');
  }, [user?.name]);

  // Per-user theme: synced from profile, persisted in DB
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    setDarkMode(theme === 'dark');
  }, [theme]);

  const toggleDarkMode = (enabled: boolean) => {
    setDarkMode(enabled);
    setTheme(enabled ? 'dark' : 'light');
  };

  const saveCoopMutation = useMutation({
    mutationFn: async (data: any) => {
      await api.updateCoopSettings(data);
      // Auto-create example hens if hen_count > existing hens
      const desiredCount = Number(data.hen_count) || 0;
      if (desiredCount > 0) {
        const existingHens = await api.getHens();
        const activeHens = (existingHens as any[]).filter((h: any) => h.is_active && h.hen_type !== 'rooster');
        const toCreate = desiredCount - activeHens.length;
        if (toCreate > 0) {
          const exampleNames = [
            'Greta', 'Agda', 'Astrid', 'Berta', 'Doris', 'Elsa', 'Freja', 'Gullan',
            'Hedvig', 'Inga', 'Kajsa', 'Lotta', 'Maja', 'Nora', 'Olga', 'Petra',
            'Rut', 'Sigrid', 'Tyra', 'Ulla', 'Vera', 'Ylva', 'Åsa', 'Östra',
            'Alma', 'Birgit', 'Dagny', 'Ebba', 'Fanny', 'Gerd',
          ];
          const usedNames = new Set((existingHens as any[]).map((h: any) => h.name));
          const available = exampleNames.filter(n => !usedNames.has(n));
          const breeds = ['Barnevelder', 'Leghorn', 'Sussex', 'Orpington', 'Wyandotte', 'Australorp', 'Maran', 'Araucana'];
          const colors = ['Brun', 'Vit', 'Svart', 'Röd', 'Grå', 'Spräcklig'];
          for (let i = 0; i < toCreate && i < available.length; i++) {
            await api.createHen({
              name: available[i],
              breed: breeds[i % breeds.length],
              color: colors[i % colors.length],
              hen_type: 'hen',
              birth_date: null,
              notes: null,
              flock_id: null,
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coop-settings'] });
      queryClient.invalidateQueries({ queryKey: ['hens'] });
      toast({ title: 'Inställningar sparade! ✅' });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (name: string) => {
      const userId = user?.id;
      if (!userId) throw new Error('Inte inloggad');
      const { error } = await supabase.from('profiles').update({ display_name: name }).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast({ title: 'Namn uppdaterat! ✅' });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const saveReminderMutation = useMutation({
    mutationFn: (data: any) => api.updateReminderSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-settings'] });
      toast({ title: 'Påminnelser uppdaterade! ✅' });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const feedbackMutation = useMutation({
    mutationFn: (data: any) => api.submitFeedback(data),
    onSuccess: () => {
      toast({ title: 'Tack för din feedback! 💚' });
      setFeedbackMsg('');
      queryClient.invalidateQueries({ queryKey: ['user-feedback'] });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const supportMutation = useMutation({
    mutationFn: (data: any) => api.submitFeedback({ ...data, status: 'support' }),
    onSuccess: () => {
      toast({ title: 'Meddelande skickat! 📩', description: 'Vi svarar så snart vi kan.' });
      setSupportMsg('');
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });


  const replayOnboarding = async () => {
    if (!user?.id) return;

    const scopedKey = `honsgarden-onboarding-done-${user.id}`;
    localStorage.removeItem(scopedKey);
    localStorage.removeItem('honsgarden-onboarding-done');

    const { data: profile, error: readError } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('user_id', user.id)
      .maybeSingle();

    if (readError) {
      toast({ title: 'Kunde inte återställa intro', description: readError.message, variant: 'destructive' });
      return;
    }

    const prefs = (profile?.preferences && typeof profile.preferences === 'object'
      ? profile.preferences
      : {}) as Record<string, unknown>;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ preferences: { ...prefs, onboarding_done: false } })
      .eq('user_id', user.id);

    if (updateError) {
      toast({ title: 'Kunde inte återställa intro', description: updateError.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Introguiden återställd ✨', description: 'Vi visar den igen på startsidan.' });
    navigate('/app');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isPremium = user?.subscription_status === 'premium';

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    toast({ title: 'Söker efter uppdatering…', description: 'Detta tar några sekunder.' });
    try {
      const result = await checkForPwaUpdate();
      if (result.error) {
        toast({ title: 'Kunde inte söka', description: result.error, variant: 'destructive' });
      } else if (!result.hasUpdate) {
        toast({ title: 'Ingen ny version', description: 'Du har redan den senaste versionen installerad.' });
      }
      // Om hasUpdate === true triggar onNeedRefresh i PwaUpdatePrompt automatiskt
      // och sidan laddas om inom kort — ingen toast behövs.
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-8">
      <PageHeader title="Inställningar" emoji="⚙️" subtitle="Hantera ditt konto och din hönsgård" />

      {/* Quick actions: import + feedback */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-primary/30 shadow-sm card-hover cursor-pointer" onClick={() => navigate('/app/import')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Importera data</p>
                <p className="text-xs text-muted-foreground">CSV, Excel eller Google Sheets</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm card-hover cursor-pointer" onClick={() => navigate('/app/feedback')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Feedback & ärenden</p>
                <p className="text-xs text-muted-foreground">Skicka idéer eller felrapport</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Premium status */}
      <PremiumStatusCard />

      {/* Bjud in en hönskompis – 30 dagar Plus åt båda */}
      <ReferralCard />

      {/* Region & språk – endast på internationell domän (honsgarden.app etc.) */}
      {isInternationalDomain() && <RegionLanguageSettings />}




      {/* Profile */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Profil & Gård
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Visningsnamn</Label>
              <div className="flex gap-2 mt-1.5">
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ditt namn" className="h-11 rounded-xl flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 px-3 rounded-xl"
                  disabled={saveProfileMutation.isPending || displayName === user?.name}
                  onClick={() => saveProfileMutation.mutate(displayName)}
                >
                  {saveProfileMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Spara'}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">E-post</Label>
              <Input value={user?.email || ''} disabled className="mt-1.5 h-11 bg-muted/50 rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-muted-foreground">Gårdsnamn</Label>
              <Input value={coopName} onChange={(e) => setCoopName(e.target.value)} placeholder="Min hönsgård" className="mt-1.5 h-11 rounded-xl" />
            </div>
            <div>
              <Label className="text-muted-foreground">Antal hönor</Label>
              <Input type="number" value={henCount} onChange={(e) => setHenCount(e.target.value)} placeholder="0" className="mt-1.5 h-11 rounded-xl" />
            </div>
            <div>
              <Label className="text-muted-foreground">Plats</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="T.ex. Linköping" className="mt-1.5 h-11 rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Postnummer <span className="text-xs">(valfritt)</span></Label>
              <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\s/g, '').slice(0, 5))} placeholder="58220" className="mt-1.5 h-11 rounded-xl" />
              <p className="text-[11px] text-muted-foreground mt-1">Används endast för regionala snittpriser och väderprognos – aldrig publikt.</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Ort <span className="text-xs">(valfritt)</span></Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="T.ex. Linköping" className="mt-1.5 h-11 rounded-xl" />
            </div>
          </div>
          <Button onClick={() => saveCoopMutation.mutate({ coop_name: coopName, hen_count: Number(henCount) || 0, location: location || null, postal_code: postalCode || null, city: city || null } as any)} disabled={saveCoopMutation.isPending} className="rounded-xl">
            {saveCoopMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Spara gårdsinställningar
          </Button>

          <div className="pt-1">
            <Button variant="outline" className="rounded-xl gap-2" onClick={replayOnboarding}>
              <RotateCcw className="h-4 w-4" />
              Visa introduktionen igen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Family members */}
      <FamilyMembers />

      {/* Appearance */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Utseende
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              {darkMode ? <Moon className="h-4.5 w-4.5 text-muted-foreground" /> : <Sun className="h-4.5 w-4.5 text-warning" />}
              <div>
                <p className="text-sm font-medium text-foreground">Mörkt tema</p>
                <p className="text-xs text-muted-foreground">Byt till mörkare färger för ögonen</p>
              </div>
            </div>
            <Switch checked={darkMode} onCheckedChange={toggleDarkMode} />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Påminnelser
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Morgonpåminnelse</p>
              <p className="text-xs text-muted-foreground">Påminnelse att öppna hönshuset</p>
            </div>
            <Switch checked={morningReminder} onCheckedChange={setMorningReminder} />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Kvällspåminnelse</p>
              <p className="text-xs text-muted-foreground">Påminnelse att stänga och logga ägg</p>
            </div>
            <Switch checked={eveningReminder} onCheckedChange={setEveningReminder} />
          </div>
          <div className="border-t border-border/30 pt-4 mt-2">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Mail className="h-4.5 w-4.5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Veckorapport via mejl</p>
                  <p className="text-xs text-muted-foreground">Få en sammanfattning varje måndag med ägg, sysslor & tips</p>
                  {!isPremium && <p className="text-[10px] text-warning mt-0.5">Kräver Premium</p>}
                </div>
              </div>
              <Switch
                checked={weeklyReportEmail}
                disabled={!isPremium}
                onCheckedChange={async (checked) => {
                  setWeeklyReportEmail(checked);
                  if (!user?.id) return;
                  const { data: current } = await supabase.from('profiles').select('preferences').eq('user_id', user.id).maybeSingle();
                  const prefs = (current?.preferences && typeof current.preferences === 'object' ? current.preferences : {}) as Record<string, unknown>;
                  await supabase.from('profiles').update({ preferences: { ...prefs, weekly_report_email: checked } }).eq('user_id', user.id);
                  toast({ title: checked ? 'Veckorapport aktiverad 📬' : 'Veckorapport avstängd' });
                }}
              />
            </div>
          </div>
            <div className="border-t border-border/30 pt-4 mt-2">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Trophy className="h-4.5 w-4.5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Veckans värptävling</p>
                    <p className="text-xs text-muted-foreground">Visa ranking av hönorna på dashboarden</p>
                  </div>
                </div>
                <Switch
                  checked={showHenRace}
                  onCheckedChange={async (checked) => {
                    setShowHenRace(checked);
                    if (!user?.id) return;
                    const { data: current } = await supabase.from('profiles').select('preferences').eq('user_id', user.id).maybeSingle();
                    const prefs = (current?.preferences && typeof current.preferences === 'object' ? current.preferences : {}) as Record<string, unknown>;
                    await supabase.from('profiles').update({ preferences: { ...prefs, hide_weekly_hen_race: !checked } }).eq('user_id', user.id);
                    toast({ title: checked ? 'Värptävlingen visas igen 🏆' : 'Värptävlingen dold' });
                  }}
                />
              </div>
            </div>
            <div className="border-t border-border/30 pt-4 mt-2">
            <PushNotificationsRow />
          </div>
          <Button variant="outline" onClick={() => saveReminderMutation.mutate({ morning_reminder: morningReminder, evening_reminder: eveningReminder })} disabled={saveReminderMutation.isPending} className="rounded-xl">
            {saveReminderMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Spara påminnelser
          </Button>
        </CardContent>
      </Card>

      {/* Min data: CSV-export, komplett backup & radera konto */}
      <MyDataSection />

      {/* Import data */}
      <Card className="border-border/50 shadow-sm card-hover cursor-pointer" onClick={() => navigate('/app/import')}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Importera data</p>
              <p className="text-xs text-muted-foreground">Läs in hönor & ägg från CSV, Excel eller Google Sheets</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>

      {/* Support / Contact */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Kontakta kundtjänst
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Har du frågor, problem eller behöver hjälp? Skriv till oss nedan eller mejla direkt till{' '}
            <a href="mailto:info@auroramedia.se" className="text-primary hover:underline">info@auroramedia.se</a>.
          </p>
          <Textarea
            placeholder="Beskriv ditt ärende..."
            value={supportMsg}
            onChange={(e) => setSupportMsg(e.target.value)}
            rows={3}
            className="rounded-xl"
          />
          <Button variant="outline" onClick={() => { if (supportMsg.trim()) supportMutation.mutate({ message: `[SUPPORT] ${supportMsg.trim()}` }); }} disabled={supportMutation.isPending || !supportMsg.trim()} className="rounded-xl gap-2">
            {supportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Mail className="h-4 w-4" />
            Skicka
          </Button>
        </CardContent>
      </Card>

      {/* Feedback */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Feedback & ärenden
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* New feedback form */}
          <div className="space-y-3">
            <Textarea
              placeholder="Berätta vad du tycker, önskar eller vill förbättra..."
              value={feedbackMsg}
              onChange={(e) => setFeedbackMsg(e.target.value)}
              rows={3}
              className="rounded-xl"
            />
            <Button variant="outline" onClick={() => { if (feedbackMsg.trim()) feedbackMutation.mutate({ message: feedbackMsg.trim() }); }} disabled={feedbackMutation.isPending || !feedbackMsg.trim()} className="rounded-xl gap-2">
              {feedbackMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Send className="h-4 w-4" />
              Skicka feedback
            </Button>
          </div>

          {/* Feedback history */}
          <FeedbackHistory />
        </CardContent>
      </Card>

      {/* App / Installation – göm för användare som redan installerat PWA:n */}
      {!isStandalonePwa() && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              App
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Visa instruktionerna för att installera Hönsgården på hemskärmen igen.
            </p>
            <Button
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={() => {
                try {
                  localStorage.removeItem(`u:${user?.id ?? 'anon'}:app-coming-soon-dismissed`);
                } catch { /* ignore */ }
                window.dispatchEvent(new CustomEvent('show-app-install-popup'));
              }}
            >
              <Download className="h-4 w-4" />
              Visa app-installation igen
            </Button>
          </CardContent>
        </Card>
      )}

      {/* App-version / Uppdatering */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            App-version
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Hönsgården uppdateras automatiskt i bakgrunden. Om något verkar konstigt kan du tvinga fram en kontroll manuellt.
          </p>
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={handleCheckUpdate}
            disabled={checkingUpdate}
          >
            {checkingUpdate ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {checkingUpdate ? 'Söker…' : 'Kontrollera efter uppdatering'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Juridiskt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="ghost" className="w-full justify-start gap-2 text-sm text-muted-foreground hover:text-foreground rounded-xl" onClick={() => navigate('/terms')}>
            <FileText className="h-4 w-4" />
            Användarvillkor & Integritetspolicy
          </Button>
        </CardContent>
      </Card>

      {/* Account */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Konto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="gap-2 text-destructive hover:text-destructive rounded-xl" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logga ut
          </Button>
        </CardContent>
      </Card>

      {/* App info */}
      <div className="text-center pt-2 pb-4">
        <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
          <Heart className="h-3 w-3" />
          <span className="text-[10px]">Hönsgården v1.0 · Gjord med kärlek i Sverige</span>
          <Heart className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}

function FeedbackHistory() {
  const { data: feedbackItems = [], isLoading } = useQuery({
    queryKey: ['user-feedback'],
    queryFn: () => api.getUserFeedback(),
  });

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (!(feedbackItems as any[]).length) return null;

  const getStatusBadge = (status: string) => {
    if (status === 'resolved') return <span className="text-[9px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5"><CheckCircle2 className="h-2.5 w-2.5" /> Besvarad</span>;
    if (status === 'in_progress') return <span className="text-[9px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> Pågår</span>;
    return <span className="text-[9px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">Skickad</span>;
  };

  return (
    <div className="space-y-2 pt-2 border-t border-border/50">
      <p className="text-xs font-semibold text-muted-foreground">Dina ärenden</p>
      {(feedbackItems as any[]).map((fb: any) => (
        <div key={fb.id} className="rounded-xl border border-border/50 overflow-hidden">
          {/* User's message */}
          <div className="p-3 bg-card">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[10px] text-muted-foreground">
                {fb.created_at ? new Date(fb.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'}
              </span>
              {getStatusBadge(fb.status)}
            </div>
            <p className="text-xs text-foreground leading-relaxed">{fb.message}</p>
          </div>

          {/* Admin reply */}
          {fb.admin_reply && (
            <div className="p-3 bg-primary/5 border-t border-primary/10">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center">
                  <Send className="h-2 w-2 text-primary" />
                </div>
                <span className="text-[10px] font-semibold text-primary">Hönsgården svarade</span>
                <span className="text-[9px] text-muted-foreground">
                  {fb.admin_reply_at ? new Date(fb.admin_reply_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : ''}
                </span>
              </div>
              <p className="text-xs text-foreground leading-relaxed">{fb.admin_reply}</p>
            </div>
          )}

          {/* Waiting indicator */}
          {!fb.admin_reply && fb.status !== 'resolved' && (
            <div className="px-3 py-2 bg-muted/30 border-t border-border/30">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" /> Inväntar svar...
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
