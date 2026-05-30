import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, Loader2, RotateCcw, Sparkles, Infinity as InfinityIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

function daysBetween(end: Date, now: Date): number {
  const ms = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PremiumStatusCard() {
  const navigate = useNavigate();
  const { user, refreshSubscription, reloadProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const isLifetime = user?.premium_type === 'lifetime';
  const isTrial = user?.premium_type === 'trial';
  const isPaid = user?.premium_type === 'paid';
  const isPremium = !!user?.is_premium;

  const expiry = useMemo(
    () => (user?.subscription_end ? new Date(user.subscription_end) : null),
    [user?.subscription_end],
  );
  const daysLeft = useMemo(() => (expiry ? daysBetween(expiry, new Date()) : null), [expiry]);

  // Realtime: lyssna på ändringar i profiles för aktuell användare så att
  // exempelvis admin-kompensation slår igenom direkt utan reload.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-premium-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void reloadProfile();
        },
      )
      .subscribe();

    const onFocus = () => { void reloadProfile(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [user?.id, reloadProfile]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshSubscription();
      toast({ title: 'Premiumstatus uppdaterad ✅' });
    } catch {
      toast({ title: 'Kunde inte uppdatera', variant: 'destructive' as any });
    } finally {
      setRefreshing(false);
    }
  };

  // Färg/ton baserat på status
  const tone = isLifetime
    ? 'border-primary/40 bg-gradient-to-br from-primary/10 via-card to-accent/10'
    : isPremium
    ? 'border-primary/30 bg-primary/5'
    : 'border-warning/20 bg-warning/5';

  const label = isLifetime
    ? 'Premium – Livstid'
    : isTrial
    ? 'Premium – Provperiod'
    : isPaid
    ? 'Premium – Aktivt'
    : 'Gratisplan';

  return (
    <Card className={`shadow-sm overflow-hidden ${tone}`}>
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-primary/10 shrink-0">
              {isLifetime ? (
                <InfinityIcon className="h-5 w-5 text-primary" />
              ) : (
                <Crown className={`h-5 w-5 ${isPremium ? 'text-primary' : 'text-warning'}`} />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{label}</p>
              <p className="text-[11px] text-muted-foreground">
                {isLifetime
                  ? 'Du har permanent tillgång till alla premiumfunktioner.'
                  : isPremium
                  ? 'Tack för att du stöttar Hönsgården 💚'
                  : 'Uppgradera för att låsa upp alla funktioner.'}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg h-8 px-2 shrink-0"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Uppdatera premiumstatus"
            title="Uppdatera"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          </Button>
        </div>

        {isPremium && !isLifetime && expiry && (
          <div className="rounded-xl bg-background/60 border border-border/50 p-3 sm:p-4">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Dagar kvar</p>
                <p className="font-serif text-3xl text-foreground leading-tight">{daysLeft ?? 0}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Förnyas / går ut</p>
                <p className="text-sm font-medium text-foreground">{formatDate(expiry)}</p>
              </div>
            </div>
            {daysLeft !== null && daysLeft <= 7 && (
              <p className="text-xs text-warning mt-2">
                Snart slut – förläng för att behålla AI-coach, ekonomi och insikter.
              </p>
            )}
          </div>
        )}

        {isLifetime && (
          <div className="rounded-xl bg-background/60 border border-border/50 p-3 sm:p-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm text-foreground">Livstidsmedlemskap – inget utgångsdatum.</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!isPremium && (
            <Button size="sm" className="rounded-xl gap-1.5 text-xs" onClick={() => navigate('/app/premium')}>
              <Crown className="h-3.5 w-3.5" />
              Uppgradera
            </Button>
          )}
          {isPremium && !isLifetime && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl gap-1.5 text-xs"
              onClick={() => navigate('/app/premium')}
            >
              Hantera prenumeration
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
