import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, X, Bird, Egg, Sparkles, Loader2, BarChart3, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const ONBOARDING_KEY = 'honsgarden-onboarding-done';
const getOnboardingKey = (userId: string) => `${ONBOARDING_KEY}-${userId}`;

const onboardingVisibleRef = { current: false };
export function useOnboardingVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const check = () => setVisible(onboardingVisibleRef.current);
    check();
    const id = setInterval(check, 500);
    return () => clearInterval(id);
  }, []);
  return visible;
}

export default function OnboardingGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    onboardingVisibleRef.current = open;
    return () => { onboardingVisibleRef.current = false; };
  }, [open]);

  const [step, setStep] = useState(0);
  const [henName, setHenName] = useState('');
  const [henBreed, setHenBreed] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [createdHenName, setCreatedHenName] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) return;

    const scopedKey = getOnboardingKey(user.id);

    if (localStorage.getItem(ONBOARDING_KEY)) {
      localStorage.setItem(scopedKey, '1');
      return;
    }

    const localDone = localStorage.getItem(scopedKey);
    if (localDone) return;

    let isCancelled = false;
    let timer: number | null = null;

    void (async () => {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle();

      if (isCancelled) return;
      const prefs = (profileData?.preferences as Record<string, any>) ?? {};
      if (prefs.onboarding_done) {
        localStorage.setItem(scopedKey, '1');
        return;
      }

      const { count } = await supabase
        .from('hens')
        .select('id', { count: 'exact', head: true });

      if (isCancelled) return;
      if (count && count > 0) {
        localStorage.setItem(scopedKey, '1');
        await supabase
          .from('profiles')
          .update({ preferences: { ...prefs, onboarding_done: true } })
          .eq('user_id', user.id);
        return;
      }

      timer = window.setTimeout(() => {
        if (!isCancelled) {
          setStep(0);
          setOpen(true);
        }
      }, 800);
    })();

    return () => {
      isCancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [user?.id]);

  const markDone = async () => {
    if (!user?.id) return;
    const scopedKey = getOnboardingKey(user.id);
    localStorage.setItem(scopedKey, '1');
    localStorage.removeItem(ONBOARDING_KEY);
    const { data } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('user_id', user.id)
      .maybeSingle();
    const prefs = (data?.preferences as Record<string, any>) ?? {};
    await supabase
      .from('profiles')
      .update({ preferences: { ...prefs, onboarding_done: true } })
      .eq('user_id', user.id);
  };

  const finish = () => {
    setOpen(false);
    void markDone();
  };

  // Soft close — only allowed once a hen exists (or via demo). When 0 hens we keep
  // the dialog mandatory to fix the 50% onboarding leak.
  const softClose = () => {
    setOpen(false);
  };

  const addHen = async () => {
    if (!henName.trim() || !user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('hens').insert({
        name: henName.trim(),
        breed: henBreed.trim() || null,
        user_id: user.id,
        hen_type: 'hen',
        is_active: true,
      });
      if (error) throw error;
      setCreatedHenName(henName.trim());
      setStep(2);
      await markDone();
    } catch (err: any) {
      console.error('[OnboardingGuide] addHen failed:', err);
      const description = err?.message || err?.error_description || 'Okänt fel. Kontrollera din anslutning och försök igen.';
      toast({ title: 'Kunde inte spara hönan', description, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const loadDemoData = async () => {
    if (!user?.id) return;
    setLoadingDemo(true);
    try {
      const demoHens = [
        { name: 'Greta', breed: 'Barnevelder', color: 'Brun', user_id: user.id, hen_type: 'hen', is_active: true },
        { name: 'Astrid', breed: 'Sussex', color: 'Vit', user_id: user.id, hen_type: 'hen', is_active: true },
        { name: 'Signe', breed: 'Maran', color: 'Koppar', user_id: user.id, hen_type: 'hen', is_active: true },
      ];
      const { data: insertedHens, error: henErr } = await supabase.from('hens').insert(demoHens).select();
      if (henErr) throw henErr;

      const eggLogs: any[] = [];
      const today = new Date();
      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const hen = insertedHens![Math.floor(Math.random() * insertedHens!.length)];
        eggLogs.push({
          date: dateStr,
          count: Math.floor(Math.random() * 3) + 1,
          hen_id: hen.id,
          user_id: user.id,
        });
      }
      const { error: eggErr } = await supabase.from('egg_logs').insert(eggLogs);
      if (eggErr) throw eggErr;

      localStorage.setItem('honsgarden-demo-data', '1');
      setCreatedHenName('Greta, Astrid & Signe');
      setStep(2);
      await markDone();
      toast({ title: 'Exempeldata är inlagt! 🐔', description: 'Nu kan du se hur Hönsgården fungerar med hönor och äggloggar.' });
    } catch (err: any) {
      toast({ title: 'Något gick fel', description: 'Vi kunde inte skapa exempeldata just nu. Försök igen om en stund.', variant: 'destructive' });
    } finally {
      setLoadingDemo(false);
    }
  };

  const confettiEmojis = ['🎉', '🥚', '🐔', '✨', '💚', '🌟'];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { softClose(); void markDone(); } }}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden rounded-2xl border-border/60 gap-0"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 0 && (
              <>
                <div className="relative h-36 bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center">
                  <motion.span
                    className="text-6xl"
                    initial={{ scale: 0.5, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  >
                    🐔
                  </motion.span>
                </div>
                <div className="px-6 pt-4 pb-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary mb-2">Kom igång på under en minut</p>
                  <h2 className="font-serif text-xl text-foreground mb-1">Låt oss skapa din hönsgård</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    Först lägger du till en höna. Sedan kan du logga dagens ägg och få statistik direkt på dashboarden.
                  </p>

                  <div className="space-y-2 mb-5">
                    <ActivationStep icon={Bird} title="1. Lägg till första hönan" text="Det räcker med ett namn. Resten kan du fylla i senare." active />
                    <ActivationStep icon={Egg} title="2. Logga dagens ägg" text="Första äggloggen gör att appen börjar visa trender." />
                    <ActivationStep icon={BarChart3} title="3. Se din dashboard vakna" text="Följ vecka, månad, streak och bästa höna." />
                  </div>

                  <div className="flex items-center justify-between">
                    <ProgressDots current={0} total={3} />
                    <Button size="sm" className="h-9 px-5 text-xs rounded-xl gap-1.5" onClick={() => setStep(1)}>
                      Lägg till höna <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border/40">
                    <button
                      onClick={loadDemoData}
                      disabled={loadingDemo}
                      className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors py-2 rounded-xl hover:bg-primary/5"
                    >
                      {loadingDemo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {loadingDemo ? 'Skapar exempeldata...' : 'Testa med exempeldata istället'}
                    </button>
                  </div>
                  <p className="w-full text-center text-[10px] text-muted-foreground/50 mt-3">
                    Du kan börja med exempeldata och byta ut den senare.
                  </p>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="relative h-28 bg-gradient-to-br from-primary/10 to-success/10 flex items-center justify-center">
                  <Bird className="h-12 w-12 text-primary/60" />
                </div>
                <div className="px-6 pt-4 pb-6">
                  <h2 className="font-serif text-xl text-foreground mb-1">Lägg till din första höna</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    Namnet är det viktiga. Ras är valfritt och hjälper bara statistiken kännas mer personlig.
                  </p>

                  <div className="mb-3">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Populära raser</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['Barnevelder', 'Sussex', 'Maran', 'Orpington', 'Silkeshöna', 'Araucana', 'Wyandotte'].map(breed => (
                        <button
                          key={breed}
                          onClick={() => setHenBreed(breed)}
                          className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                            henBreed === breed
                              ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
                              : 'bg-muted/40 border-border/40 text-muted-foreground hover:bg-muted/60'
                          }`}
                        >
                          {breed}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 mb-5">
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">Namn *</label>
                      <Input
                        placeholder="T.ex. Greta"
                        value={henName}
                        onChange={(e) => setHenName(e.target.value)}
                        className="rounded-xl"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">Ras <span className="text-muted-foreground">(valfritt)</span></label>
                      <Input
                        placeholder="T.ex. Barnevelder"
                        value={henBreed}
                        onChange={(e) => setHenBreed(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <ProgressDots current={1} total={3} />
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-9 px-3 text-xs rounded-xl text-muted-foreground" onClick={() => setStep(0)}>
                        Tillbaka
                      </Button>
                      <Button
                        size="sm"
                        className="h-9 px-5 text-xs rounded-xl gap-1.5"
                        onClick={addHen}
                        disabled={!henName.trim() || saving}
                      >
                        {saving ? 'Sparar...' : 'Spara hönan'}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="relative h-36 bg-gradient-to-br from-success/15 to-warning/10 flex items-center justify-center overflow-hidden">
                  {confettiEmojis.map((emoji, i) => (
                    <motion.span
                      key={i}
                      className="absolute text-2xl"
                      initial={{ opacity: 0, y: 60, x: (i - 2.5) * 40 }}
                      animate={{
                        opacity: [0, 1, 1, 0],
                        y: [60, -20, -40, -60],
                        rotate: [0, (i % 2 === 0 ? 1 : -1) * 30],
                      }}
                      transition={{ duration: 1.5, delay: i * 0.1, ease: 'easeOut' }}
                    >
                      {emoji}
                    </motion.span>
                  ))}
                  <motion.span
                    className="text-6xl relative z-10"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
                  >
                    ✅
                  </motion.span>
                </div>
                <div className="px-6 pt-4 pb-6">
                  <h2 className="font-serif text-xl text-foreground mb-1">{createdHenName} är tillagd!</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                    Perfekt. Logga dagens ägg nu så får dashboarden direkt bättre veckostatistik, streak och produktion per höna.
                  </p>
                  <div className="rounded-xl bg-primary/5 border border-primary/10 p-3 mb-5 flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Du kan alltid använda den gröna äggknappen längst ned för att logga ägg från vilken sida som helst.
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <ProgressDots current={2} total={3} />
                    <Button
                      size="sm"
                      className="h-9 px-5 text-xs rounded-xl gap-1.5"
                      onClick={() => { finish(); navigate('/app/eggs'); }}
                    >
                      <Egg className="h-3.5 w-3.5" /> Logga dagens ägg
                    </Button>
                  </div>
                  <button
                    onClick={() => { finish(); navigate('/app'); }}
                    className="w-full text-center text-[11px] text-muted-foreground/60 mt-3 hover:text-muted-foreground transition-colors"
                  >
                    Gå till dashboarden
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function ActivationStep({ icon: Icon, title, text, active = false }: { icon: any; title: string; text: string; active?: boolean }) {
  return (
    <div className={`flex gap-3 rounded-xl border p-3 ${active ? 'border-primary/20 bg-primary/5' : 'border-border/50 bg-muted/20'}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-primary/10 text-primary' : 'bg-background text-muted-foreground'}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current ? 'w-6 bg-primary' : 'w-1.5 bg-border'
          }`}
        />
      ))}
    </div>
  );
}
