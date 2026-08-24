import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { feedbackTap } from '@/lib/feedback';

interface EggSuccessAnimationProps {
  show: boolean;
  count: number;
  onDone: () => void;
}

const emojis = ['🥚', '🐔', '✨', '🎉', '💚', '🌟', '🐣', '⭐', '🌻', '💛'];

const messages = [
  'Bra jobbat! 🎉',
  'Snyggt! 🌟',
  'Toppen! ✨',
  'Härligt! 💚',
  'Fantastiskt! 🥳',
];

export function EggSuccessAnimation({ show, count, onDone }: EggSuccessAnimationProps) {
  const message = useMemo(() => messages[Math.floor(Math.random() * messages.length)], [show]);

  // Generate random confetti positions once per show
  const particles = useMemo(() =>
    Array.from({ length: 16 }, (_, i) => ({
      emoji: emojis[i % emojis.length],
      angle: (i / 16) * 360,
      distance: 90 + Math.random() * 70,
      size: 16 + Math.random() * 14,
      delay: Math.random() * 0.25,
      rotateDir: i % 2 === 0 ? 1 : -1,
    })), [show]);

  useEffect(() => {
    if (show) {
      feedbackTap();
      const t = setTimeout(onDone, 2200);
      return () => clearTimeout(t);
    }
  }, [show, onDone]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Subtle backdrop */}
          <motion.div
            className="absolute inset-0 bg-background/20 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Expanding ring wave */}
          <motion.div
            className="absolute w-24 h-24 rounded-full border-2 border-primary/40"
            initial={{ scale: 0.5, opacity: 0.8 }}
            animate={{ scale: 4, opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute w-24 h-24 rounded-full border border-primary/20"
            initial={{ scale: 0.5, opacity: 0.6 }}
            animate={{ scale: 5, opacity: 0 }}
            transition={{ duration: 1.4, ease: 'easeOut', delay: 0.15 }}
          />

          {/* Confetti particles in a burst pattern */}
          {particles.map((p, i) => {
            const rad = (p.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * p.distance;
            const ty = Math.sin(rad) * p.distance;
            return (
              <motion.span
                key={i}
                className="absolute"
                style={{ fontSize: p.size }}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  x: [0, tx * 0.6, tx],
                  y: [0, ty * 0.6 - 20, ty - 10],
                  scale: [0, 1.3, 1, 0.5],
                  rotate: [0, p.rotateDir * (30 + Math.random() * 30)],
                }}
                transition={{ duration: 1.4, delay: p.delay, ease: 'easeOut' }}
              >
                {p.emoji}
              </motion.span>
            );
          })}

          {/* Center count badge */}
          <motion.div
            className="relative bg-primary text-primary-foreground rounded-full w-24 h-24 flex flex-col items-center justify-center shadow-2xl"
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: [0, 1.25, 0.95, 1], rotate: [-15, 8, -3, 0] }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          >
            {/* Glow ring */}
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/30"
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.5, 1.3], opacity: [0.5, 0, 0] }}
              transition={{ duration: 0.8, delay: 0.2 }}
            />
            <span className="text-3xl font-bold tabular-nums leading-none">{count}</span>
            <span className="text-[9px] uppercase tracking-[0.15em] opacity-80 mt-0.5">ägg</span>
          </motion.div>

          {/* Encouraging message */}
          <motion.p
            className="absolute mt-36 text-sm font-semibold text-foreground bg-card/90 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-lg border border-border/40"
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.4, duration: 0.4, ease: 'easeOut' }}
          >
            {message}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
