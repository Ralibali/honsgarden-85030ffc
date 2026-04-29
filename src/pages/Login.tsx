import React, { useEffect, useState } from 'react';
import { useSeo } from '@/hooks/useSeo';
import { useNavigate, useSearchParams } from 'react-router-dom';
import heroFarm from '@/assets/hero-farm.jpg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Egg, ArrowRight, Mail, Lock, User, Loader2, Gift } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type AuthMode = 'welcome' | 'login' | 'register' | 'forgot';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, isAuthenticated, loading: authLoading } = useAuth();

  useSeo({
    title: 'Logga in eller skapa konto | Hönsgården',
    description: 'Logga in på Hönsgården eller skapa ett gratis konto för att börja logga ägg, höns och foder.',
    path: '/login',
    noindex: true,
  });

  // Read mode from URL: /login?mode=register or /login?mode=login
  const initialMode = searchParams.get('mode');
  const [authMode, setAuthMode] = useState<AuthMode>(
    initialMode === 'register' ? 'register' : initialMode === 'login' ? 'login' : 'welcome'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState(searchParams.get('ref') || '');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/app', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/app', { replace: true });
    } catch (err: any) {
      toast({ title: 'Inloggning misslyckades', description: err.message || 'Kontrollera e-post och lösenord.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await register(email, password, name);
      // Process referral code if provided
      if (referralCode.trim() && data?.user?.id) {
        try {
          await supabase.rpc('process_referral', { _referral_code: referralCode.trim().toUpperCase(), _new_user_id: data.user.id });
        } catch {
          // Non-blocking – referral is a bonus
        }
      }
      toast({ title: 'Konto skapat!', description: referralCode.trim() ? 'Du har fått 14 dagars gratis Premium! 🎉 (sju dagar provperiod + sju dagar värvningsbonus)' : 'Du har fått sju dagars gratis Premium! 🎉' });
      setAuthMode('login');
    } catch (err: any) {
      toast({ title: 'Registrering misslyckades', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: 'Ange e-post', description: 'Fyll i din e-postadress.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      toast({ title: 'E-post skickad!', description: 'Kolla din inkorg för att återställa lösenordet.' });
    } catch (err: any) {
      toast({ title: 'Fel', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: Hero image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img src={heroFarm} alt="Svensk hönsgård med höns i morgonljus" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-12 pb-16">
          <h2 className="font-serif text-4xl text-foreground mb-3">Ha full koll på din hönsgård</h2>
          <p className="text-muted-foreground text-lg max-w-md">Logga ägg, håll ordning på flocken och följ ekonomin – enkelt och smidigt i en och samma app.</p>
        </div>
      </div>

      {/* Right: Auth forms */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background noise-bg">
        <div className="w-full max-w-md relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Egg className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-serif text-2xl text-foreground">Hönsgården</h1>
              <p className="text-xs text-muted-foreground">Din digitala assistent för hönsgården</p>
            </div>
          </div>

          {authMode === 'welcome' && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h3 className="font-serif text-3xl text-foreground mb-2">Välkommen!</h3>
                <p className="text-muted-foreground">Håll koll på dina hönor, ägg och ekonomi – på ett enkelt sätt.</p>
              </div>
              <div className="space-y-3">
                <Button onClick={() => setAuthMode('login')} className="w-full h-12 text-base font-medium">
                  Logga in med e-post <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => setAuthMode('register')} className="w-full h-12 text-base font-medium">
                  Skapa konto med e-post
                </Button>
              </div>
            </div>
          )}

          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="animate-fade-in space-y-5">
              <div>
                <h3 className="font-serif text-3xl text-foreground mb-2">Logga in</h3>
                <p className="text-muted-foreground">Välkommen tillbaka till Hönsgården.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-muted-foreground">E-post</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="din@email.se" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="password" className="text-muted-foreground">Lösenord</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-11" required />
                  </div>
                </div>
              </div>
              <Button type="submit" className="w-full h-12 text-base font-medium" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Logga in <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" className="text-primary hover:underline" onClick={() => setAuthMode('forgot')}>Glömt lösenord?</button>
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setAuthMode('register')}>Skapa konto</button>
              </div>
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setAuthMode('welcome')}>← Tillbaka</button>
            </form>
          )}

          {authMode === 'register' && (
            <form onSubmit={handleRegister} className="animate-fade-in space-y-5">
              <div>
                <h3 className="font-serif text-3xl text-foreground mb-2">Skapa konto</h3>
                <p className="text-muted-foreground">Kom igång med din hönsgård på några sekunder.</p>
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
                  <Gift className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-sm text-primary font-medium">Sju dagars Premium ingår gratis!</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-muted-foreground">Namn</Label>
                  <div className="relative mt-1.5">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="name" type="text" placeholder="Ditt namn" value={name} onChange={(e) => setName(e.target.value)} className="pl-10 h-11" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="reg-email" className="text-muted-foreground">E-post</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="reg-email" type="email" placeholder="din@email.se" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="reg-password" className="text-muted-foreground">Lösenord</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="reg-password" type="password" placeholder="Minst 8 tecken" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-11" minLength={8} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="referral" className="text-muted-foreground">Värvningskod (valfritt)</Label>
                  <div className="relative mt-1.5">
                    <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="referral" type="text" placeholder="T.ex. A1B2C3" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} className="pl-10 h-11 uppercase" maxLength={6} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Har du en kod från en vän? Ni får båda sju dagars Premium!</p>
                </div>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 rounded border-border"
                    required
                  />
                  <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed">
                    Jag har läst och godkänner{' '}
                    <a href="/terms" target="_blank" className="text-primary hover:underline">användarvillkoren & integritetspolicyn</a>, inklusive att kontaktas via e-post med nyhetsbrev och erbjudanden.
                  </label>
                </div>
              </div>
              <Button type="submit" className="w-full h-12 text-base font-medium" disabled={loading || !acceptedTerms}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Skapa konto <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setAuthMode('welcome')}>← Tillbaka</button>
            </form>
          )}

          {authMode === 'forgot' && (
            <div className="animate-fade-in space-y-5">
              <div>
                <h3 className="font-serif text-3xl text-foreground mb-2">Återställ lösenord</h3>
                <p className="text-muted-foreground">Ange din e-post så skickar vi en länk.</p>
              </div>
              <div>
                <Label htmlFor="forgot-email" className="text-muted-foreground">E-post</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="forgot-email" type="email" placeholder="din@email.se" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11" />
                </div>
              </div>
              <Button className="w-full h-12 text-base font-medium" onClick={handleForgotPassword} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Skicka återställningslänk
              </Button>
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setAuthMode('login')}>← Tillbaka till login</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
