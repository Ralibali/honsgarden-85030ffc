import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Loader2, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSeo } from '@/hooks/useSeo';
import logoHonsgarden from '@/assets/logo-honsgarden.png';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState('');

  useSeo({
    title: 'Återställ lösenord | Hönsgården',
    description: 'Ange ditt nya lösenord.',
    path: '/reset-password',
    noindex: true,
  });

  useEffect(() => {
    // The recovery link contains tokens in the URL hash fragment.
    // Supabase client picks them up automatically via onAuthStateChange.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    // Also check if we already have a session (e.g. if onAuthStateChange already fired)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Lösenordet måste vara minst 8 tecken.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Lösenorden matchar inte.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      toast({ title: 'Lösenord uppdaterat!', description: 'Du kan nu logga in med ditt nya lösenord.' });
      setTimeout(() => navigate('/login?mode=login', { replace: true }), 2500);
    } catch (err: any) {
      setError(err.message || 'Något gick fel.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <img src={logoHonsgarden} alt="Hönsgården" className="h-12" />
          <h1 className="text-2xl font-display font-bold text-foreground">Återställ lösenord</h1>
        </div>

        {success ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-primary mx-auto" />
            <p className="text-foreground font-medium">Lösenordet har uppdaterats!</p>
            <p className="text-muted-foreground text-sm">Du skickas vidare till inloggningen…</p>
          </div>
        ) : !sessionReady ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground text-sm">Verifierar länk…</p>
            <p className="text-muted-foreground text-xs">Om det tar lång tid kan länken ha gått ut. Begär en ny via inloggningssidan.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nytt lösenord</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  placeholder="Minst 8 tecken"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Bekräfta lösenord</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  placeholder="Upprepa lösenordet"
                  required
                />
              </div>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Uppdatera lösenord
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
