import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import {
  evaluateUpsell,
  loadUpsellState,
  saveUpsellState,
  type UpsellSignals,
} from '@/lib/smartUpsell';
import { trackEvent } from '@/lib/analytics';

interface SmartUpsellCardProps {
  streak: number;
  totalEggs: number;
  henCount: number;
}

/**
 * Personlig premium-trigger som visas vid höga engagemangsögonblick
 * (lång streak, mycket loggad data). Frekvensbegränsad och stängbar –
 * aldrig en vanlig reklambanner.
 */
export default function SmartUpsellCard({ streak, totalEggs, henCount }: SmartUpsellCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPremium = user?.subscription_status === 'premium';
  const [dismissed, setDismissed] = useState(false);
  const [now] = useState(() => new Date());

  const message = useMemo(() => {
    if (!user?.id) return null;
    const signals: UpsellSignals = { streak, totalEggs, henCount, isPremium };
    return evaluateUpsell(signals, loadUpsellState(user.id), now, user.id);
    // now är fryst vid mount – en bedömning per sidladdning räcker
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, streak, totalEggs, henCount, isPremium]);

  // Registrera visningen (frekvens spärras i motorn)
  useEffect(() => {
    if (!message || !user?.id) return;
    const state = loadUpsellState(user.id);
    saveUpsellState(user.id, { ...state, lastShownAt: now.toISOString() });
    trackEvent('Smart Upsell Shown', { trigger: `${message.trigger}:${message.variant}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message?.trigger, user?.id]);

  if (!message || dismissed) return null;

  const handleDismiss = () => {
    if (user?.id) {
      const state = loadUpsellState(user.id);
      saveUpsellState(user.id, { ...state, dismissedAt: new Date().toISOString() });
    }
    trackEvent('Smart Upsell Dismissed', { trigger: `${message.trigger}:${message.variant}` });
    setDismissed(true);
  };

  const handleCta = () => {
    trackEvent('Smart Upsell Clicked', { trigger: `${message.trigger}:${message.variant}` });
    navigate('/app/premium');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="relative overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-50 via-card to-primary/5 dark:from-amber-950/30 dark:via-card dark:to-primary/10 shadow-sm">
          {/* Diskret glöd i hörnet */}
          <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-amber-300/20 blur-2xl" />

          <div className="relative p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xl" role="img" aria-hidden>
                  {message.emoji}
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Crown className="h-3 w-3" /> Plus-tips
                </p>
              </div>
              <button
                onClick={handleDismiss}
                aria-label="Stäng tips"
                className="shrink-0 h-6 w-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition flex items-center justify-center"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <h3 className="font-serif text-lg text-foreground mt-2 leading-snug">{message.title}</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{message.body}</p>

            <div className="flex items-center gap-3 mt-4">
              <Button size="sm" className="rounded-xl gap-1.5" onClick={handleCta}>
                {message.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <button
                onClick={handleDismiss}
                className="text-xs text-muted-foreground hover:text-foreground transition"
              >
                Inte nu
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
