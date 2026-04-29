import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Loader2, MessageSquare, RefreshCw, ShieldCheck, CheckCircle2, Clock, Lightbulb, HeartHandshake, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

const PORTAL_ID = 'settings-trust-portal-anchor';

function findSettingsRoot() {
  return document.querySelector('main .max-w-3xl.mx-auto.space-y-6')
    || document.querySelector('main .max-w-3xl')
    || document.querySelector('main#main-content > div');
}

function statusMeta(status?: string) {
  switch (status) {
    case 'resolved':
      return { label: 'Besvarad', icon: CheckCircle2, className: 'bg-success/10 text-success border-success/20', text: 'Vi har svarat eller markerat ärendet som klart.' };
    case 'in_progress':
      return { label: 'Pågår', icon: Clock, className: 'bg-warning/10 text-warning border-warning/20', text: 'Vi tittar på detta just nu.' };
    case 'planned':
      return { label: 'Planerad', icon: Lightbulb, className: 'bg-accent/10 text-accent border-accent/20', text: 'Det här ligger i planen för utveckling.' };
    case 'support':
      return { label: 'Support', icon: HeartHandshake, className: 'bg-primary/10 text-primary border-primary/20', text: 'Det här hanteras som ett supportärende.' };
    default:
      return { label: 'Mottagen', icon: MessageSquare, className: 'bg-muted/60 text-muted-foreground border-border', text: 'Vi har tagit emot ditt ärende.' };
  }
}

function getAdminReply(item: any) {
  return item.admin_reply || item.admin_response || item.response || item.reply || item.answer || item.admin_message || item.admin_note || item.note_from_admin || null;
}

function getFeedbackText(item: any) {
  return item.message || item.text || item.description || item.content || item.feedback || 'Feedback utan text';
}

function SettingsTrustContent() {
  const { user, refreshSubscription } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const isPremium = user?.subscription_status === 'premium' || user?.is_premium;

  const { data: feedbackItems = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['user-feedback'],
    queryFn: () => api.getUserFeedback(),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    refetch();
  }, [refetch]);

  const sortedFeedback = useMemo(() => {
    return [...(feedbackItems as any[])].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [feedbackItems]);

  const syncPremium = async () => {
    setSyncing(true);
    try {
      await refreshSubscription();
      await queryClient.invalidateQueries();
      toast({ title: 'Premiumstatus kontrollerad ✅', description: 'Vi har synkat din prenumeration mot betalningssystemet.' });
    } catch (err: any) {
      toast({ title: 'Kunde inte synka just nu', description: err?.message || 'Försök igen om en stund.', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const refreshFeedback = async () => {
    await queryClient.invalidateQueries({ queryKey: ['user-feedback'] });
    await refetch();
    toast({ title: 'Feedbackhistoriken är uppdaterad' });
  };

  return (
    <section className="space-y-4" aria-label="Premium och feedbackstatus">
      <Card className={`shadow-sm border ${isPremium ? 'border-primary/25 bg-primary/[0.04]' : 'border-warning/25 bg-warning/[0.04]'}`}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isPremium ? 'bg-primary/10' : 'bg-warning/10'}`}>
                {isPremium ? <ShieldCheck className="h-5 w-5 text-primary" /> : <Crown className="h-5 w-5 text-warning" />}
              </div>
              <div className="min-w-0">
                <p className="data-label mb-1">Premiumstatus</p>
                <h2 className="font-serif text-lg text-foreground">{isPremium ? 'Premium är aktivt' : 'Premium visas inte som aktivt'}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                  {isPremium
                    ? 'Allt ser bra ut. Om något ändå verkar låst kan du synka statusen manuellt.'
                    : 'Har du nyligen betalat men appen visar gratis? Synka premiumstatus så kontrollerar vi betalningen direkt.'}
                </p>
                {user?.subscription_end && <p className="text-xs text-muted-foreground mt-1">Gäller till: {new Date(user.subscription_end).toLocaleDateString('sv-SE')}</p>}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={syncPremium} disabled={syncing} variant={isPremium ? 'outline' : 'default'} className="rounded-xl gap-2 w-full sm:w-auto">
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Synka premiumstatus
              </Button>
              {!isPremium && (
                <Button variant="outline" onClick={() => navigate('/app/premium')} className="rounded-xl gap-2 w-full sm:w-auto">
                  Se Premium<ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
            <div>
              <p className="data-label mb-1">Feedbackhistorik</p>
              <h2 className="font-serif text-lg text-foreground">Dina skickade ärenden och svar</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Här ser du feedback och supportärenden du skickat in. Det gör att inget försvinner i tomma intet.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={refreshFeedback} disabled={isFetching} className="rounded-xl gap-2 w-full sm:w-auto shrink-0">
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Uppdatera ärenden
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : sortedFeedback.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-center">
              <p className="font-serif text-base text-foreground">Inga ärenden ännu</p>
              <p className="text-sm text-muted-foreground mt-1">När du skickar feedback eller kontaktar support visas det här. Syns det inte direkt, tryck på “Uppdatera ärenden”.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedFeedback.map((item: any) => {
                const meta = statusMeta(item.status);
                const Icon = meta.icon;
                const reply = getAdminReply(item);
                return (
                  <article key={item.id || item.created_at} className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">{getFeedbackText(item)}</p>
                        <p className="text-[11px] text-muted-foreground mt-2">
                          Skickat {item.created_at ? new Date(item.created_at).toLocaleDateString('sv-SE') : 'nyligen'}
                        </p>
                      </div>
                      <Badge variant="secondary" className={`shrink-0 ${meta.className}`}>
                        <Icon className="h-3 w-3 mr-1" />
                        {meta.label}
                      </Badge>
                    </div>

                    {reply ? (
                      <div className="mt-3 rounded-xl bg-primary/7 border border-primary/15 p-3">
                        <p className="text-[11px] font-semibold text-primary mb-1">Svar från Hönsgården</p>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">{reply}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-3 border-t border-border/40 pt-3">{meta.text}</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export default function SettingsTrustPortal() {
  const location = useLocation();
  const isSettings = location.pathname === '/app/settings' || location.pathname === '/app/settings/';
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isSettings) {
      document.getElementById(PORTAL_ID)?.remove();
      setTarget(null);
      return;
    }

    let cancelled = false;
    const mount = () => {
      if (cancelled) return;
      const root = findSettingsRoot();
      if (!root) return;

      let anchor = document.getElementById(PORTAL_ID) as HTMLElement | null;
      if (!anchor) {
        anchor = document.createElement('section');
        anchor.id = PORTAL_ID;
        anchor.className = 'contents';
      }

      const firstCard = root.querySelector('.card-hover, [class*="border-primary"]');
      const isSafeAnchor = firstCard
        && firstCard !== anchor
        && !anchor.contains(firstCard)
        && !firstCard.contains(anchor);
      if (isSafeAnchor && firstCard.parentElement) {
        try {
          firstCard.insertAdjacentElement('afterend', anchor);
        } catch {
          if (!anchor.parentElement) root.insertBefore(anchor, root.children[1] ?? null);
        }
      } else if (!anchor.parentElement) {
        root.insertBefore(anchor, root.children[1] ?? null);
      }
      setTarget(anchor);
    };

    const timer = window.setTimeout(mount, 80);
    const observer = new MutationObserver(mount);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [isSettings]);

  if (!isSettings || !target) return null;
  return createPortal(<SettingsTrustContent />, target);
}
