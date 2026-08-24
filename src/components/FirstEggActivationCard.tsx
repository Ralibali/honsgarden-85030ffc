import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Egg, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * High-priority activation card shown only to users who have at least one
 * hen but have not logged a single egg yet. Removes the next big step in
 * the funnel and gives them an obvious, single CTA.
 */
export default function FirstEggActivationCard({ henName }: { henName?: string }) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/8 shadow-md overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <motion.div
              animate={{ rotate: [0, -6, 6, -3, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.4 }}
              className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center text-3xl shrink-0"
              aria-hidden
            >
              🥚
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="data-label mb-1">Nästa steg</p>
              <h2 className="font-serif text-lg sm:text-xl text-foreground leading-snug">
                Logga ditt första ägg
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Så fort du loggar ett ägg{henName ? ` från ${henName}` : ''} börjar dashboarden visa streak,
                veckostatistik och produktion per höna.
              </p>
            </div>
          </div>

          <Button
            onClick={() => navigate('/app/eggs')}
            className="w-full h-12 rounded-2xl gap-2 text-base font-semibold mt-5 shadow-sm"
          >
            <Egg className="h-5 w-5" />
            Logga första ägget
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
