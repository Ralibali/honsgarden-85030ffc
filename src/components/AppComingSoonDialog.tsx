import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Smartphone, Share, MoreVertical, Sparkles, Check, Apple, Smartphone as Android } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { trackClick } from '@/hooks/useTracking';

const STORAGE_KEY = 'app-coming-soon-dismissed';

type Platform = 'ios' | 'android' | 'other';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

export default function AppComingSoonDialog() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>('other');
  const [showSteps, setShowSteps] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    if (standalone) return;

    if (localStorage.getItem(STORAGE_KEY)) return;

    setPlatform(detectPlatform());

    const t = setTimeout(() => setOpen(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const handleClose = (o: boolean) => {
    setOpen(o);
    if (!o) {
      localStorage.setItem(STORAGE_KEY, '1');
    }
  };

  const dismiss = () => handleClose(false);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-2xl p-5 sm:p-6 max-h-[92dvh] overflow-y-auto gap-3 sm:gap-4">
        <DialogHeader className="space-y-1.5">
          <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-1">
            <Smartphone className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          </div>
          <DialogTitle className="font-serif text-xl sm:text-2xl text-center leading-snug px-2">
            Hönsgården kommer snart som app! 📱
          </DialogTitle>
          <DialogDescription className="text-center text-[13px] sm:text-sm leading-relaxed pt-0.5">
            Vi jobbar på en riktig app för App Store och Google Play. Under tiden kan du installera Hönsgården direkt på hemskärmen – det fungerar precis som en vanlig app.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-muted/40 border border-border/60 p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Så installerar du nu</span>
            </div>
            <div className="flex items-center gap-1 bg-background/60 rounded-full p-0.5 border border-border/60 self-start sm:self-auto">
              <PlatformChip
                active={platform === 'ios'}
                onClick={() => setPlatform('ios')}
                label="iPhone"
              />
              <PlatformChip
                active={platform === 'android'}
                onClick={() => setPlatform('android')}
                label="Android"
              />
            </div>
          </div>

          <AnimatePresence initial={false} mode="wait">
            {!showSteps ? (
              <motion.div
                key="cta"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="pt-1"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl gap-2"
                  onClick={() => {
                    setShowSteps(true);
                    toast.success(
                      platform === 'ios'
                        ? 'Visar steg för iPhone'
                        : platform === 'android'
                        ? 'Visar steg för Android'
                        : 'Visar installationsguide',
                      { duration: 1800 },
                    );
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Visa mig hur
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key={`steps-${platform}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium">
                  <Check className="h-3 w-3" />
                  Visar steg för{' '}
                  {platform === 'ios' ? 'iPhone' : platform === 'android' ? 'Android' : 'din enhet'}
                </div>

                {platform === 'ios' && (
                  <>
                    <Step n={1}>
                      Tryck på <Share className="h-3.5 w-3.5 inline -mt-0.5 text-primary" /> <strong>Dela</strong> i Safari.
                    </Step>
                    <Step n={2}>
                      Välj <strong>"Lägg till på hemskärmen"</strong>.
                    </Step>
                    <Step n={3}>Tryck <strong>Lägg till</strong> – klart! 🎉</Step>
                  </>
                )}

                {platform === 'android' && (
                  <>
                    <Step n={1}>
                      Tryck på <MoreVertical className="h-3.5 w-3.5 inline -mt-0.5 text-primary" /> <strong>menyn</strong> i Chrome.
                    </Step>
                    <Step n={2}>
                      Välj <strong>"Installera app"</strong> eller <strong>"Lägg till på startskärm"</strong>.
                    </Step>
                    <Step n={3}>Klart – ikonen finns nu på din hemskärm! 🎉</Step>
                  </>
                )}

                {platform === 'other' && (
                  <>
                    <Step n={1}>Öppna sidan i mobilens webbläsare (Safari på iPhone, Chrome på Android).</Step>
                    <Step n={2}>Tryck på meny / dela-knappen.</Step>
                    <Step n={3}>Välj <strong>"Lägg till på hemskärmen"</strong> / <strong>"Installera app"</strong>.</Step>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-[11px] sm:text-xs text-muted-foreground text-center">
          Du kan alltid installera senare via menyn i webbläsaren.
        </p>

        <div className="flex justify-center pt-1">
          <Button onClick={dismiss} className="rounded-xl px-6 w-full sm:w-auto h-11">
            Tack, jag förstår
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlatformChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 sm:px-2.5 sm:py-1 rounded-full text-xs sm:text-[11px] font-medium transition-colors min-h-[32px] sm:min-h-0 ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-xs text-foreground">
      <span className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}
