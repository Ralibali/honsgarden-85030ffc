import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, X } from 'lucide-react';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, streak, totalEggs, henCount, isPremium]);

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

  const proof = streak >= 3
    ? `${streak} dagar i rad`
    : totalEggs >= 25
      ? `${totalEggs} ägg i historiken`
      : henCount > 0
        ? `${henCount} ${henCount === 1 ? 'höna' : 'hönor'} i flocken`
        : null;

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="earned-plus-nudge"
        aria-label="Ett tips om Hönsgården Plus"
      >
        <div className="earned-plus-nudge__card">
          <div className="earned-plus-nudge__stamp" aria-hidden="true">{message.emoji}</div>

          <button
            onClick={handleDismiss}
            aria-label="Stäng tipset"
            className="earned-plus-nudge__dismiss"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="earned-plus-nudge__eyebrow">
                <Sparkles className="h-3.5 w-3.5" />
                Hönsgården växer med dig
              </p>
              {proof && <span className="earned-plus-nudge__proof">{proof}</span>}
            </div>

            <h3 className="font-serif text-xl sm:text-2xl text-foreground mt-2 leading-tight">{message.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-2xl">{message.body}</p>

            <div className="flex flex-wrap items-center gap-3 mt-4">
              <Button size="sm" className="rounded-xl gap-1.5 px-4" onClick={handleCta}>
                {message.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <button
                onClick={handleDismiss}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Jag fortsätter som vanligt
              </button>
            </div>
          </div>
        </div>
      </motion.section>
    </AnimatePresence>
  );
}
