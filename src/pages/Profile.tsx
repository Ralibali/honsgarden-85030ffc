import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

interface ProfileRow {
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  country_code: string | null;
  postal_code: string | null;
  created_at: string | null;
}

export default function Profile() {
  const { user, reloadProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      setLoading(true);
      // Ensure profile is synced with latest auth metadata (Google name/avatar)
      try {
        await supabase.rpc('sync_profile_from_auth');
      } catch {
        /* non-blocking */
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, email, avatar_url, country_code, postal_code, created_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        toast({ title: 'Kunde inte hämta profil', description: error.message, variant: 'destructive' });
      } else if (data) {
        setProfile(data as ProfileRow);
        setDisplayName(data.display_name ?? '');
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || null })
      .eq('user_id', user.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Kunde inte spara', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Profil sparad' });
    await reloadProfile();
  };

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Du måste vara inloggad.</p>
      </div>
    );
  }

  const initials = (displayName || user.email || '?').slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <PageHeader title="Min profil" subtitle="Uppgifter som hämtas från ditt konto och Google-inloggning." />

      <Card>
        <CardHeader>
          <CardTitle>Konto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Läser in profil…
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={displayName || 'Profilbild'} />
                  ) : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{displayName || 'Namnlös användare'}</p>
                  <p className="text-sm text-muted-foreground">{profile?.email ?? user.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="display-name">Namn</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ditt visningsnamn"
                />
                <p className="text-xs text-muted-foreground">
                  Skapades automatiskt från Google-inloggningen. Du kan ändra det när du vill.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">E-post</Label>
                  <p className="text-sm">{profile?.email ?? user.email}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Land</Label>
                  <p className="text-sm">{profile?.country_code ?? '—'}</p>
                </div>
                {profile?.postal_code ? (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Postnummer</Label>
                    <p className="text-sm">{profile.postal_code}</p>
                  </div>
                ) : null}
                {profile?.created_at ? (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Medlem sedan</Label>
                    <p className="text-sm">{new Date(profile.created_at).toLocaleDateString('sv-SE')}</p>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="rounded-xl">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Spara
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
