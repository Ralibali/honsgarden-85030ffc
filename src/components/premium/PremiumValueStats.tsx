import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Egg, Bird, CalendarDays } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Personligt värdebevis på premium-sidan: visar gratis-användaren
 * hur mycket data de redan byggt upp – och att Plus är nyckeln
 * som förvandlar just DEN datan till insikter.
 */
export default function PremiumValueStats() {
  const { data: eggs = [], isLoading: eggsLoading } = useQuery({
    queryKey: ['eggs'],
    queryFn: () => api.getEggs(),
    staleTime: 60_000,
  });
  const { data: hens = [], isLoading: hensLoading } = useQuery({
    queryKey: ['hens'],
    queryFn: () => api.getHens(),
    staleTime: 60_000,
  });

  if (eggsLoading || hensLoading) return null;

  const totalEggs = eggs.reduce((s, e) => s + (e.count || 0), 0);
  const activeHens = hens.filter((h) => h.is_active && h.hen_type !== 'rooster').length;
  const daysWithData = new Set(eggs.map((e) => e.date)).size;

  // Helt ny användare utan data – då säger den generella säljtexten mer.
  if (totalEggs === 0 && activeHens === 0) return null;

  const stats = [
    { icon: Egg, value: totalEggs.toLocaleString('sv-SE'), label: 'ägg loggade' },
    { icon: Bird, value: String(activeHens), label: activeHens === 1 ? 'höna i flocken' : 'hönor i flocken' },
    { icon: CalendarDays, value: String(daysWithData), label: daysWithData === 1 ? 'dag med data' : 'dagar med data' },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.05] to-card p-5"
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">
        Din resa hittills
      </p>
      <h2 className="font-serif text-lg text-foreground leading-snug">
        Du har redan byggt upp något värdefullt
      </h2>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-background/70 border border-border/50 p-3 text-center">
            <s.icon className="h-4 w-4 text-primary mx-auto mb-1.5" />
            <p className="text-xl font-bold tabular-nums text-foreground leading-none">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
        Med Plus förvandlas just <span className="font-medium text-foreground">din</span> data till
        kostnad per ägg, produktionsprognoser och veckorapporter som säger vad du bör göra härnäst.
      </p>
    </motion.section>
  );
}
