import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';

interface StreakFlameProps {
  streak: number;
  className?: string;
  variant?: 'inline' | 'card';
}

function flameSize(streak: number) {
  if (streak >= 30) return { size: 'h-6 w-6', glow: 'shadow-[0_0_24px_rgba(249,115,22,0.55)]', tier: 'mästare' };
  if (streak >= 14) return { size: 'h-5 w-5', glow: 'shadow-[0_0_18px_rgba(249,115,22,0.4)]', tier: 'glödhet' };
  if (streak >= 7) return { size: 'h-5 w-5', glow: 'shadow-[0_0_12px_rgba(249,115,22,0.3)]', tier: 'het streak' };
  if (streak >= 3) return { size: 'h-4 w-4', glow: 'shadow-[0_0_8px_rgba(249,115,22,0.25)]', tier: 'rullar på' };
  return { size: 'h-4 w-4', glow: '', tier: streak > 0 ? 'igång' : 'starta en streak' };
}

/**
 * Streak badge with a flame that grows + glows the longer the streak is.
 */
export function StreakFlame({ streak, className = '', variant = 'inline' }: StreakFlameProps) {
  const { size, glow, tier } = flameSize(streak);
  const active = streak > 0;

  if (variant === 'card') {
    return (
      <div className={`relative overflow-hidden rounded-2xl border ${active ? 'border-orange-200/60 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/40 dark:via-amber-950/30 dark:to-yellow-950/20' : 'border-border/50 bg-muted/30'} p-3 ${className}`}>
        <div className="flex items-center gap-3">
          <motion.div
            className={`relative flex h-11 w-11 items-center justify-center rounded-2xl ${active ? 'bg-orange-500/15' : 'bg-muted'} ${glow}`}
            animate={active ? { scale: [1, 1.06, 1], rotate: [0, -3, 3, 0] } : {}}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Flame className={`${size} ${active ? 'text-orange-500 fill-orange-400/40' : 'text-muted-foreground'}`} />
            {streak >= 7 && (
              <motion.div
                className="absolute inset-0 rounded-2xl bg-orange-400/30"
                animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
          </motion.div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tabular-nums text-foreground leading-none">{streak}</span>
              <span className="text-xs text-muted-foreground">{streak === 1 ? 'dag' : 'dagar'} i rad</span>
            </div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground/80 mt-1">{tier}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${active ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'bg-muted text-muted-foreground'} ${className}`}>
      <motion.span
        className={glow}
        animate={active ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Flame className={`${size} ${active ? 'fill-orange-400/50' : ''}`} />
      </motion.span>
      <span className="text-sm font-bold tabular-nums leading-none">{streak}</span>
    </div>
  );
}

export default StreakFlame;
