import React, { useEffect, useMemo, useState } from 'react';
import { useSeo } from '@/hooks/useSeo';
import { useNavigate, useSearchParams } from 'react-router-dom';
import heroFarm from '@/assets/hero-farm.webp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Egg, ArrowRight, Mail, Lock, User, Loader2, Gift, MapPin, BarChart3, Coins } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CountrySelect } from '@/components/CountrySelect';
import { COUNTRIES, detectTimezone, type CountryCode } from '@/lib/countries';
import { validatePostalCode } from '@/lib/postalCode';
import { isInternationalDomain, defaultCountryForRegion } from '@/lib/brand';

type AuthMode = 'welcome' | 'login' | 'register' | 'forgot';
const TERMS_VERSION = '2026-07-12';

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

  const initialMode = searchParams.get('mode');
  const [authMode, setAuthMode] = useState<AuthMode>(
    initialMode === 'register' ? 'register' : initialMode === 'login' ? 'login' : 'welcome'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const intl = isInternationalDomain();
  const [country, setCountry] = useState<CountryCode>(() => defaultCountryForRegion() as CountryCode);
  const [referralCode, setReferralCode] = useState(searchParams.get('ref') || '');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(false);

  const countryDefaults = useMemo(() => COUNTRIES[country], [country]);
  const normalizedPostalCode = useMemo(() => {
    const trimmed = postalCode.trim();
    return country === 'SE' ? trimmed.replace(/\s+/g, '') : trimmed;
  }, [postalCode, country]);

  const postalCheck = useMemo(() => {
    if (!intl) {
      return { ok: normalizedPostalCode.length === 0 || /^\d{5}$/.test(normalizedPostalCode) };
    }
    return validatePostalCode(postalCode, country);
  }, [postalCode, country, intl, normalizedPostalCode]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate('/app', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      try {
        const pending = localStorage.getItem('pending_postal_code');
        if (pending?.trim()) {
          await api.updateCoopSettings({ postal_code: pending });
          localStorage.removeItem('pending_postal_code');
        }
      } catch {
        // Non-blocking legacy migration.
      }
      navigate('/app', { replace: true });
    } catch (err) {
      toast({ title: 'Inloggning misslyckades', description: err instanceof Error ? err.message : 'Kontrollera e-post och lösenord.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      toast({ title: 'Godkänn villkoren', description: 'Du behöver godkänna användarvillkoren för att skapa konto.', variant: 'destructive' });
      return;
    }
    if (!postalCheck.ok) {
      toast({ title: 'Kontrollera postnumret', description: 'Postnumret matchar inte det valda landet.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const acceptedAt = new Date().toISOString();
      const meta = {
        country_code: countryDefaults.code,
        language_code: countryDefaults.language,
        locale: countryDefaults.locale,
        timezone: detectTimezone(countryDefaults.timezone),
        currency_code: countryDefaults.currency,
        measurement_system: countryDefaults.measurement,
        temperature_unit: countryDefaults.temperature,
        postal_code: normalizedPostalCode || null,
        terms_accepted_at: acceptedAt,
        terms_version: TERMS_VERSION,
        marketing_opt_in: marketingOptIn,
        marketing_opt_in_at: marketingOptIn ? acceptedAt : null,
        marketing_consent_source: marketingOptIn ? 'registration' : null,
      };

      const data = await register(email.trim().toLowerCase(), password, name.trim(), meta);
      // Analytics: faktisk lyckad signup (efter att register() returnerat utan att kasta).
      // Inga personuppgifter skickas – endast en source-property med låg kardinalitet.
      const { trackEvent } = await import('@/lib/analytics');
      trackEvent('Signup Completed', { source: 'signup_form' });
      if (referralCode.trim() && data?.user?.id) {
        try {
          await supabase.rpc('process_referral', {
            _referral_code: referralCode.trim().toUpperCase(),
            _new_user_id: data.user.id,
          });
        } catch {
          // Referral is a bonus and may be retried after first login.
        }
      }

      if (normalizedPostalCode) {
        try { localStorage.setItem('pending_postal_code', normalizedPostalCode); } catch { /* ignore */ }
      }

      toast({
        title: 'Konto skapat!',
        description: referralCode.trim()
          ? 'Du har sju dagars gratis Premium. Värvningsbonusen aktiveras när du börjar använda appen. 🥚'
          : 'Du har fått sju dagars gratis Premium! 🎉',
      });
      setAuthMode('login');
    } catch (err) {
      toast({ title: 'Registrering misslyckades', description: err instanceof Error ? err.message : 'Försök igen.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({ title: 'Ange e-post', description: 'Fyll i din e-postadress.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      toast({ title: 'E-post skickad!', description: 'Kolla din inkorg för att återställa lösenordet.' });
    } catch (err) {
      toast({ title: 'Fel', description: err instanceof Error ? err.message : 'Försök igen.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img src={heroFarm} alt="Svensk hönsgård med höns i morgonljus" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
        {/* Svävande ägg för liv i bilden */}
        {['🥚', '🐔', '🥚'].map((emoji, i) => (
          <motion.span
            key={i}
            className="absolute text-3xl opacity-70 pointer-events-none"
            style={{ left: `${18 + i * 28}%`, top: `${16 + (i % 2) * 14}%` }}
            animate={{ y: [0, -14, 0], rotate: [0, i % 2 === 0 ? 6 : -6, 0] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.8 }}
          >
            {emoji}
          </motion.span>
        ))}
        <div className="relative z-10 flex flex-col justify-end p-12 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <h2 className="font-serif text-4xl text-foreground mb-3">Ha full koll på din hönsgård</h2>
            <p className="text-muted-foreground text-lg max-w-md mb-6">Logga ägg, håll ordning på flocken och följ ekonomin – enkelt och smidigt i en och samma app.</p>
            <div className="space-y-2.5 max-w-sm">
              {[
                { icon: Egg, text: 'Logga dagens ägg på under fem sekunder' },
                { icon: BarChart3, text: 'Se trender, streaks och din bästa höna' },
                { icon: Coins, text: 'Följ vad varje ägg kostar och ger' },
              ].map((f, i) => (
                <motion.div
                  key={f.text}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.12 }}
                  className="flex items-center gap-3 rounded-xl bg-background/60 backdrop-blur-sm border border-border/40 px-3.5 py-2.5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <f.icon className="h-4 w-4 text-primary" />
                  </span>
                  <p className="text-sm text-foreground/90">{f.text}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-background noise-bg relative overflow-hidden">
        {/* Mobil hero – mjuk gårdsbild som tonar ut i bakgrunden */}
        <div className="absolute inset-x-0 top-0 h-44 lg:hidden pointer-events-none">
          <img src={heroFarm} alt="" aria-hidden className="w-full h-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
        </div>
        {/* Andande glöd bakom kortet */}
        <div className="absolute top-1/4 -right-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl animate-pulse-soft pointer-events-none" />
        <div className="absolute bottom-1/4 -left-20 w-72 h-72 rounded-full bg-accent/10 blur-3xl animate-pulse-soft pointer-events-none" style={{ animationDelay: '1.5s' }} />

        <div className="w-full max-w-md relative z-10">
          <motion.div
            className="flex items-center gap-3 mb-10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="relative">
              <motion.div
                className="absolute -inset-1.5 rounded-2xl bg-primary/25 blur-md"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                <Egg className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="font-serif text-2xl text-foreground">Hönsgården</h1>
              <p className="text-xs text-muted-foreground">Din digitala assistent för hönsgården</p>
            </div>
          </motion.div>

          {authMode === 'welcome' && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h3 className="font-serif text-3xl text-foreground mb-2">Välkommen!</h3>
                <p className="text-muted-foreground">Håll koll på dina hönor, ägg och ekonomi – på ett enkelt sätt.</p>
              </div>
              {/* Snabba värdebevis – synligt redan innan konto */}
              <div className="space-y-2 lg:hidden">
                {[
                  { icon: Egg, text: 'Logga ägg på under fem sekunder' },
                  { icon: BarChart3, text: 'Trender, streaks & bästa hönan' },
                ].map((f) => (
                  <div key={f.text} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <f.icon className="h-3.5 w-3.5 text-primary" />
                    </span>
                    {f.text}
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <Button onClick={() => setAuthMode('login')} className="w-full h-12 text-base font-medium relative overflow-hidden group shadow-[0_8px_24px_hsl(var(--primary)/0.3)]">
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  <span className="relative flex items-center">Logga in med e-post <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
                </Button>
                <Button variant="outline" onClick={() => setAuthMode('register')} className="w-full h-12 text-base font-medium border-primary/25 hover:border-primary/40 hover:bg-primary/5">
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
                    <Input id="email" type="email" autoComplete="email" placeholder="din@email.se" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12 rounded-xl" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="password" className="text-muted-foreground">Lösenord</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12 rounded-xl" required />
                  </div>
                </div>
              </div>
              <Button type="submit" className="w-full h-12 text-base font-medium relative overflow-hidden group shadow-[0_8px_24px_hsl(var(--primary)/0.3)]" disabled={loading}>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                <span className="relative flex items-center">Logga in <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
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
                    <Input id="name" type="text" autoComplete="name" placeholder="Ditt namn" value={name} onChange={(e) => setName(e.target.value)} className="pl-10 h-12 rounded-xl" minLength={2} maxLength={80} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="reg-email" className="text-muted-foreground">E-post</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="reg-email" type="email" autoComplete="email" placeholder="din@email.se" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12 rounded-xl" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="reg-password" className="text-muted-foreground">Lösenord</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="reg-password" type="password" autoComplete="new-password" placeholder="Minst 8 tecken" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12 rounded-xl" minLength={8} maxLength={128} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="referral" className="text-muted-foreground">Värvningskod (valfritt)</Label>
                  <div className="relative mt-1.5">
                    <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="referral" type="text" placeholder="T.ex. A1B2C3" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} className="pl-10 h-12 rounded-xl uppercase" maxLength={6} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Har du en kod från en vän? Bonus aktiveras när du börjar använda appen.</p>
                </div>
                {intl && (
                  <div>
                    <Label className="text-muted-foreground">Land / Country</Label>
                    <div className="mt-1.5"><CountrySelect value={country} onChange={setCountry} /></div>
                    <p className="text-[10px] text-muted-foreground mt-1">Landet sätter språk, valuta, tidszon och måttenheter. Du kan ändra inställningarna senare.</p>
                  </div>
                )}
                <div>
                  <Label htmlFor="postal" className="text-muted-foreground">Postnummer (valfritt)</Label>
                  <div className="relative mt-1.5">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="postal"
                      type="text"
                      autoComplete="postal-code"
                      placeholder={!intl ? '582 20' : country === 'US' ? '10001' : country === 'GB' ? 'SW1A 1AA' : country === 'CA' ? 'K1A 0B1' : country === 'NL' ? '1012 AB' : '582 20'}
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value.slice(0, 12))}
                      className="pl-10 h-12 rounded-xl"
                      maxLength={12}
                      aria-invalid={!postalCheck.ok}
                    />
                  </div>
                  {!postalCheck.ok && postalCode && (
                    <p className="text-[10px] text-destructive mt-1">Postnumret ser inte rätt ut{intl ? ` för ${countryDefaults.name_sv}` : ''}.</p>
                  )}
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
                    Jag godkänner{' '}
                    <a href="/terms" target="_blank" rel="noreferrer" className="text-primary hover:underline">användarvillkoren</a>
                    {' '}och har läst integritetspolicyn.
                  </label>
                </div>

                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="marketing"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                    className="mt-1 rounded border-border"
                  />
                  <label htmlFor="marketing" className="text-xs text-muted-foreground leading-relaxed">
                    Ja tack, skicka tips, nyheter och erbjudanden via e-post. Frivilligt och kan återkallas när som helst.
                  </label>
                </div>
              </div>
              <Button type="submit" className="w-full h-12 text-base font-medium relative overflow-hidden group shadow-[0_8px_24px_hsl(var(--primary)/0.3)]" disabled={loading || !acceptedTerms}>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                <span className="relative flex items-center">Skapa konto <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
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
                  <Input id="forgot-email" type="email" autoComplete="email" placeholder="din@email.se" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12 rounded-xl" />
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
