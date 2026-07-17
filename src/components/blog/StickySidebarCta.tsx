import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Egg, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Kompakt sticky CTA i artikelns sidospalt (desktop).
 * Följer med under hela läsningen utan att störa – fångar
 * läsare som är redo att konvertera mitt i artikeln.
 */
export default function StickySidebarCta() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.3 }}
      className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 via-card to-accent/5 p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
          <Egg className="h-4 w-4 text-primary" />
        </span>
        <p className="font-serif text-sm text-foreground leading-tight">Testa Hönsgården gratis</p>
      </div>
      <ul className="space-y-1.5 mb-3">
        {['Logga ägg på 5 sekunder', 'Se statistik direkt', 'Sälj ägg med egen länk'].map((item) => (
          <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Check className="h-3 w-3 text-primary shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>
      <Button asChild size="sm" className="w-full rounded-xl text-xs h-8">
        <Link to="/login?mode=register">Skapa konto</Link>
      </Button>
      <p className="text-[10px] text-muted-foreground/70 text-center mt-2">Gratis · ingen app krävs</p>
    </motion.div>
  );
}
