import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles } from 'lucide-react';

export interface PersonalRecordToastData {
  id: string;
  title: string;
  subtitle: string;
  value: number;
  unit: string;
}

interface Props {
  record: PersonalRecordToastData | null;
  onDone: () => void;
}

/**
 * Big juicy "personal record" toast that drops in from the top with a glow + sparkle burst.
 * Auto-dismisses after 3.5s. Shown above confetti.
 */
export function PersonalRecordToast({ record, onDone }: Props) {
  useEffect(() => {
    if (!record) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [record, onDone]);

  return (
    <AnimatePresence>
      {record && (
        <motion.div
          key={record.id}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] pointer-events-none w-[min(92vw,420px)]"
          initial={{ opacity: 0, y: -40, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        >
          <div className="relative overflow-hidden rounded-3xl border border-amber-300/50 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/80 dark:via-yellow-950/70 dark:to-orange-950/60 backdrop-blur-md shadow-[0_20px_60px_-20px_rgba(245,158,11,0.55)]">
            {/* Sparkle particles */}
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              const tx = Math.cos(angle) * 80;
              const ty = Math.sin(angle) * 50;
              return (
                <motion.div
                  key={i}
                  className="absolute left-1/2 top-1/2 text-amber-400"
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], x: tx, y: ty, scale: [0, 1.2, 0.5], rotate: [0, 180] }}
                  transition={{ duration: 1.4, delay: 0.1 + i * 0.04, ease: 'easeOut' }}
                >
                  <Sparkles className="h-4 w-4" />
                </motion.div>
              );
            })}

            <div className="relative flex items-center gap-3 p-4">
              <motion.div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg"
                initial={{ rotate: -20, scale: 0 }}
                animate={{ rotate: [-20, 8, -4, 0], scale: [0, 1.2, 0.95, 1] }}
                transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.05 }}
              >
                <Trophy className="h-7 w-7 text-white drop-shadow" />
              </motion.div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                  Personligt rekord
                </p>
                <p className="font-serif text-lg leading-tight text-foreground">{record.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{record.subtitle}</p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-3xl font-bold tabular-nums text-orange-600 dark:text-orange-400 leading-none">
                  {record.value}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                  {record.unit}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PersonalRecordToast;
