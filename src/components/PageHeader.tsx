import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Sidans titel (utan emoji – den flyttar till badge-rutan) */
  title: string;
  /** Emoji som visas i den glödande badge-rutan */
  emoji?: string;
  subtitle?: string;
  /** Valfria åtgärder (knappar m.m.) till höger */
  actions?: ReactNode;
}

/**
 * Enhetligt sidhuvud för hela appen: glödande emoji-badge, serif-titel
 * och mjuk entréanimation. Använd på alla inloggade sidor för ett
 * genomgående, omsorgsfullt intryck.
 */
export default function PageHeader({ title, emoji, subtitle, actions }: PageHeaderProps) {
  return (
    <motion.div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {emoji && (
          <div className="relative shrink-0">
            <motion.div
              className="absolute -inset-1 rounded-2xl bg-primary/20 blur-md"
              animate={{ opacity: [0.4, 0.75, 0.4] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-xl">
              {emoji}
            </div>
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-serif text-foreground leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
    </motion.div>
  );
}
