import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown } from 'lucide-react';
import { onUnlockCelebration, type UnlockCelebration } from '@/lib/unlockBus';
import { feedbackCelebrate } from '@/lib/feedback';

/**
 * Fullskärmsögonblicket när en utmärkelse låses upp — samma visuella språk
 * som EggSuccessAnimation men större. Köar om flera låses upp samtidigt.
 */

type TierKey = UnlockCelebration['tier'];

const TIER_STYLE: Record<TierKey, { label: string; ring: string; glow: string; pill: string }> = {
  bronze: {
    label: 'Brons',
    ring: 'border-amber-600/50',
    glow: 'shadow-[0_0_60px_rgba(217,119,6,0.35)]',
    pill: 'bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-600/25',
  },
  silver: {
    label: 'Silver',
    ring: 'border-slate-400/60',
    glow: 'shadow-[0_0_60px_rgba(148,163,184,0.4)]',
    pill: 'bg-slate-400/15 text-slate-600 dark:text-slate-300 border-slate-400/30',
  },
  gold: {
    label: 'Guld',
    ring: 'border-yellow-500/60',
    glow: 'shadow-[0_0_70px_rgba(234,179,8,0.45)]',
    pill: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  },
  diamond: {
    label: 'Diamant',
    ring: 'border-cyan-400/60',
    glow: 'shadow-[0_0_80px_rgba(34,211,238,0.5)]',
    pill: 'bg-cyan-400/15 text-cyan-700 dark:text-cyan-300 border-cyan-400/30',
  },
};

const PARTICLE_EMOJIS = ['🥚', '⭐', '✨', '🎉', '🐔', '💛'];

export default function AchievementUnlockOverlay() {
  const [queue, setQueue] = useState<UnlockCelebration[]>([]);
  const [current, setCurrent] = useState<UnlockCelebration | null>(null);

  useEffect(
    () =>
      onUnlockCelebration((celebration) => {
        setQueue((prev) => [...prev, celebration]);
      }),
    [],
  );

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((prev) => prev.slice(1));
    }
  }, [current, queue]);

  useEffect(() => {
    if (!current) return;
    feedbackCelebrate();
    const timer = setTimeout(() => setCurrent(null), 3800);
    return () => clearTimeout(timer);
  }, [current]);

  const dismiss = useCallback(() => setCurrent(null), []);

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const particles =
    current && !reduced
      ? Array.from({ length: 20 }, (_, i) => ({
          emoji: PARTICLE_EMOJIS[i % PARTICLE_EMOJIS.length],
          angle: (i / 20) * 360 + (i % 3) * 7,
          distance: 110 + (i % 5) * 26,
          size: 15 + (i % 4) * 5,
          delay: 0.12 + (i % 6) * 0.045,
          rotateDir: i % 2 === 0 ? 1 : -1,
        }))
      : [];

  const style = current ? TIER_STYLE[current.tier] : TIER_STYLE.bronze;

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-md bg-background/60 cursor-pointer"
          onClick={dismiss}
          role="dialog"
          aria-label={`Utmärkelse upplåst: ${current.title}`}
        >
          {/* Ringvågor */}
          {!reduced && (
            <>
              <motion.span
                className={`absolute rounded-full border-2 ${style.ring}`}
                initial={{ width: 120, height: 120, opacity: 0.6 }}
                animate={{ width: 520, height: 520, opacity: 0 }}
                transition={{ duration: 1.6, ease: 'easeOut', repeat: 1 }}
              />
              <motion.span
                className={`absolute rounded-full border ${style.ring}`}
                initial={{ width: 80, height: 80, opacity: 0.5 }}
                animate={{ width: 720, height: 720, opacity: 0 }}
                transition={{ duration: 2.2, ease: 'easeOut', delay: 0.15 }}
              />
            </>
          )}

          {/* Partiklar */}
          {particles.map((p, i) => {
            const rad = (p.angle * Math.PI) / 180;
            const x = Math.cos(rad) * p.distance;
            const y = Math.sin(rad) * p.distance;
            return (
              <motion.span
                key={i}
                className="absolute pointer-events-none select-none"
                style={{ fontSize: p.size }}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.3, rotate: 0 }}
                animate={{
                  x,
                  y,
                  opacity: [0, 1, 1, 0],
                  scale: [0.3, 1, 1, 0.7],
                  rotate: p.rotateDir * 180,
                }}
                transition={{ duration: 1.6, delay: p.delay, ease: 'easeOut' }}
              >
                {p.emoji}
              </motion.span>
            );
          })}

          {/* Kort */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className={`relative z-10 mx-6 max-w-sm w-full rounded-3xl border-2 ${style.ring} ${style.glow} bg-card/95 backdrop-blur-xl px-6 py-7 text-center`}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="text-6xl mb-3"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
            >
              {current.emoji}
            </motion.div>

            <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${style.pill} mb-3`}>
              <Crown className="h-3 w-3" />
              Utmärkelse upplåst · {style.label}
            </div>

            <h2 className="font-serif text-2xl text-foreground leading-tight mb-1.5">
              {current.title}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">{current.description}</p>

            {current.premiumDays > 0 ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/25 text-primary text-sm font-semibold">
                <span>🎁</span>
                +{current.premiumDays} dag{current.premiumDays > 1 ? 'ar' : ''} Premium
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Maxgränsen för gratis premiumdagar är nådd — men äran är din.
              </p>
            )}

            <p className="text-[10px] text-muted-foreground/70 mt-5">
              Tryck för att stänga
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
