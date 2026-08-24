import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, Egg } from 'lucide-react';

/**
 * Roterande produktbudskap i en liten pill.
 * Innehåller medvetet inga siffror eller aktivitetsstatistik – endast
 * sanningsenliga påståenden om produkten.
 */
const MESSAGES = [
  { icon: Leaf, text: 'Byggt för svenska hönsägare' },
  { icon: Egg, text: 'Gratis att börja – ingen app krävs' },
] as const;

export default function ActivityPulse() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % MESSAGES.length), 4000);
    return () => clearInterval(t);
  }, []);

  const msg = MESSAGES[idx];

  return (
    <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-background/60 backdrop-blur-sm border border-border rounded-full px-3 py-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <AnimatePresence mode="wait">
        <motion.span
          key={idx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="flex items-center gap-1.5"
        >
          <msg.icon className="h-3 w-3" />
          {msg.text}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
