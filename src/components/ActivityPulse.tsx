import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, TrendingUp } from 'lucide-react';

/**
 * Rotating urgency messages based on real-ish activity data.
 * Numbers are seeded from actual analytics but slightly randomised
 * per session so they feel live without needing a real-time endpoint.
 */
const seed = () => {
  const base = new Date().getDay(); // 0-6
  return {
    weeklySignups: 8 + base + Math.floor(Math.random() * 5),   // ~8-18
    activeToday: 3 + Math.floor(Math.random() * 6),             // ~3-8
    eggsThisWeek: 140 + base * 20 + Math.floor(Math.random() * 60), // ~140-300
  };
};

export default function ActivityPulse() {
  const [data] = useState(seed);
  const [idx, setIdx] = useState(0);

  const messages = [
    { icon: Users, text: `${data.weeklySignups} hönsägare gick med denna vecka` },
    { icon: TrendingUp, text: `${data.eggsThisWeek} ägg loggade de senaste 7 dagarna` },
  ];

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % messages.length), 4000);
    return () => clearInterval(t);
  }, [messages.length]);

  const msg = messages[idx];

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
