import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Sidans titel (utan emoji – den flyttar till badge-rutan) */
  title: string;
  /** Emoji som visas i badge-rutan */
  emoji?: string;
  subtitle?: string;
  /** Valfria åtgärder (knappar m.m.) till höger */
  actions?: ReactNode;
}

/**
 * Enhetligt sidhuvud för den inloggade appen. Det ska kännas mer som en
 * personlig gårdsjournal än ett administrationssystem: lugn typografi,
 * diskret ikon och tydliga primära handlingar.
 */
export default function PageHeader({ title, emoji, subtitle, actions }: PageHeaderProps) {
  return (
    <motion.div
      className="app-page-header flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5"
      initial={{ opacity: 0, y: 7 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="app-page-header__identity flex items-center gap-3 min-w-0">
        {emoji && (
          <div className="app-page-header__emoji relative w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0" aria-hidden="true">
            {emoji}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="app-page-header__title text-2xl sm:text-3xl font-serif text-foreground leading-[1.05]">{title}</h1>
          {subtitle && <p className="app-page-header__subtitle text-sm text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="app-page-header__actions flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
    </motion.div>
  );
}
