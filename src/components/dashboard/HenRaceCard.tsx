import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { rankHensByWeek, type HenRaceEgg, type HenRaceHen } from '@/lib/henRace';

interface HenRaceCardProps {
  eggs: HenRaceEgg[];
  hens: HenRaceHen[];
}

const MEDALS = ['👑', '🥈', '🥉'];

/**
 * Veckans värptävling – en lekfull ranking av hönorna efter ägg
 * senaste 7 dagarna. Gamification som får hela flocken att kännas levande.
 * Visas först när minst två hönor har värpt under veckan.
 */
export default function HenRaceCard({ eggs, hens }: HenRaceCardProps) {
  const race = useMemo(() => rankHensByWeek(eggs, hens), [eggs, hens]);

  if (race.length < 2) return null;

  const shown = race.slice(0, 5);
  const leaderEggs = shown[0].weekEggs;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
      aria-label="Veckans värptävling"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Trophy className="h-4.5 w-4.5 text-primary" />
        </span>
        <div>
          <h2 className="font-serif text-base text-foreground leading-tight">Veckans värptävling</h2>
          <p className="text-[11px] text-muted-foreground">Ägg senaste 7 dagarna</p>
        </div>
      </div>

      <ol className="space-y-2">
        {shown.map((entry, i) => (
          <motion.li
            key={entry.henId}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.08, duration: 0.25 }}
            className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${
              i === 0 ? 'bg-primary/8 border border-primary/15' : 'bg-muted/30'
            }`}
          >
            <motion.span
              className="w-6 text-center text-base leading-none"
              animate={i === 0 ? { y: [0, -3, 0] } : undefined}
              transition={i === 0 ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
            >
              {MEDALS[i] ?? `${i + 1}.`}
            </motion.span>
            <span className={`flex-1 min-w-0 truncate text-sm ${i === 0 ? 'font-semibold text-foreground' : 'text-foreground/90'}`}>
              {entry.name}
            </span>
            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
              <motion.div
                className={`h-full rounded-full ${i === 0 ? 'bg-primary' : 'bg-primary/40'}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(6, (entry.weekEggs / leaderEggs) * 100)}%` }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <span className={`w-10 text-right text-sm tabular-nums shrink-0 ${i === 0 ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
              {entry.weekEggs} 🥚
            </span>
          </motion.li>
        ))}
      </ol>
    </motion.section>
  );
}
