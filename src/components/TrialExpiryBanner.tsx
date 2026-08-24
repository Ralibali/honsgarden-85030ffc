import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Clock, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

export default function TrialExpiryBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !user) return null;

  const expiresAt = user.subscription_end;
  if (!expiresAt) return null;

  const now = new Date();
  const expiry = new Date(expiresAt);
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Only show if premium/trial and 3 or fewer days remain (or already expired)
  if (daysLeft > 3) return null;
  // Don't show for long-term paid subscribers (more than 30 days total)
  // We show for trial users and expiring subscriptions

  const isExpired = daysLeft <= 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className={`relative rounded-2xl border p-4 shadow-sm ${
          isExpired
            ? 'bg-destructive/5 border-destructive/20'
            : 'bg-warning/5 border-warning/20'
        }`}
      >
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Stäng"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isExpired ? 'bg-destructive/10' : 'bg-warning/10'
          }`}>
            {isExpired ? (
              <Clock className="h-5 w-5 text-destructive" />
            ) : (
              <Sparkles className="h-5 w-5 text-warning" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">
              {isExpired
                ? 'Din provperiod har löpt ut'
                : daysLeft === 1
                  ? 'Din provperiod löper ut imorgon!'
                  : `${daysLeft} dagar kvar av din provperiod`}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {isExpired
                ? 'Uppgradera till Plus för att behålla AI-tips, avancerad statistik och obegränsat antal hönor.'
                : 'Lås upp alla funktioner permanent – AI-tips, smarta prognoser, och mycket mer.'}
            </p>
            <Button
              size="sm"
              onClick={() => navigate('/app/premium')}
              className="mt-3 rounded-xl text-xs h-8 px-4"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Uppgradera till Plus
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
