import { motion, AnimatePresence } from 'framer-motion';
import { Flame, ArrowRight } from 'lucide-react';

interface StreakRescueCardProps {
  streak: number;
  todayEggs: number;
  /** scrolla/fokusera på snabbloggen om den finns */
  onLogClick?: () => void;
}

/**
 * Streak-räddning: visas när användaren har en levande streak men
 * inte loggat dagens ägg ännu. Skapar ett mjukt "nu gäller det"-moment
 * som driver den dagliga loggningsloopen.
 */
export default function StreakRescueCard({ streak, todayEggs, onLogClick }: StreakRescueCardProps) {
  const atRisk = streak >= 2 && todayEggs === 0;

  const handleClick = () => {
    if (onLogClick) {
      onLogClick();
    } else {
      document.getElementById('quick-egg-log')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <AnimatePresence>
      {atRisk && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -6 }}
          transition={{ duration: 0.25 }}
        >
          <button
            type="button"
            onClick={handleClick}
            className="w-full text-left rounded-2xl border border-warning/40 bg-gradient-to-r from-warning/15 via-card to-warning/5 p-4 shadow-sm hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center gap-3">
              <motion.span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-warning/20"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Flame className="h-5 w-5 text-warning" />
              </motion.span>
              <div className="flex-1 min-w-0">
                <p className="font-serif text-base text-foreground leading-tight">
                  {streak} dagar i rad – låt inte streaken slockna!
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Logga dagens ägg innan midnatt så lever den vidare.
                </p>
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-warning shrink-0 group-hover:translate-x-0.5 transition-transform">
                Logga nu <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
