import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone, Share, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { trackClick } from '@/hooks/useTracking';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const VISIT_COUNT_KEY = 'dashboard-visit-count';
const MIN_VISITS_BEFORE_PROMPT = 3;

export default function InstallAppCard() {
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [visitCount, setVisitCount] = useState(0);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));

    const wasDismissed = localStorage.getItem('install-card-dismissed');
    if (wasDismissed) setDismissed(true);

    // Öka besöksräknaren en gång per dashboard-mount så prompten dyker
    // upp först vid tredje besöket – diskret introduktion, inte spam.
    try {
      const prev = parseInt(localStorage.getItem(VISIT_COUNT_KEY) ?? '0', 10) || 0;
      const next = prev + 1;
      localStorage.setItem(VISIT_COUNT_KEY, String(next));
      setVisitCount(next);
    } catch {
      setVisitCount(MIN_VISITS_BEFORE_PROMPT);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isStandalone || dismissed) return null;
  if (visitCount < MIN_VISITS_BEFORE_PROMPT) return null;
  // Android/Chrome: visa bara när browsern faktiskt kan installera.
  // iOS: visa hjälpsteg (inget beforeinstallprompt finns där).
  if (!deferredPrompt && !isIOS) return null;

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem('install-card-dismissed', '1');
    trackClick('install_card_dismissed', { elementText: 'dismiss' });
  };

  const handleInstall = async () => {
    trackClick('install_card_cta', { elementText: 'Installera nu', metadata: { platform: isIOS ? 'ios' : 'android' } });
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      trackClick('install_prompt_choice', { elementText: choice.outcome });
      if (choice.outcome === 'accepted') {
        setDismissed(true);
        localStorage.setItem('install-card-dismissed', '1');
      }
      setDeferredPrompt(null);
    } else {
      setShowSteps(true);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 shadow-md overflow-hidden relative">
          <button
            onClick={dismiss}
            aria-label="Stäng"
            className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors z-10"
          >
            <X className="h-4 w-4" />
          </button>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0 shadow-inner">
                <Smartphone className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-serif text-lg sm:text-xl text-foreground">Installera Hönsgården</p>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                    <Sparkles className="h-3 w-3" /> Snabbare
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Få appen på hemskärmen – öppnas direkt, fungerar offline och påminner dig om kvällsräkningen.
                </p>

                {!showSteps && !isIOS && (
                  <Button onClick={handleInstall} size="lg" className="rounded-xl gap-2 w-full sm:w-auto">
                    <Download className="h-4 w-4" />
                    {deferredPrompt ? 'Installera nu' : 'Visa hur'}
                  </Button>
                )}

                {!showSteps && isIOS && (
                  <Button onClick={handleInstall} size="lg" variant="outline" className="rounded-xl gap-2 w-full sm:w-auto border-primary/40">
                    <Share className="h-4 w-4" />
                    Visa hur (iPhone/iPad)
                  </Button>
                )}

                {showSteps && (
                  <div className="space-y-2.5 mt-1 animate-fade-in">
                    {isIOS ? (
                      <>
                        <Step n={1}>Tryck på <Share className="h-3.5 w-3.5 inline text-primary -mt-0.5" /> <strong>Dela</strong> i Safari</Step>
                        <Step n={2}>Välj <strong>"Lägg till på hemskärmen"</strong></Step>
                        <Step n={3}>Tryck <strong>Lägg till</strong> – klart! 🎉</Step>
                      </>
                    ) : (
                      <>
                        <Step n={1}>Tryck på <strong>⋮ menyn</strong> i webbläsaren</Step>
                        <Step n={2}>Välj <strong>"Installera app"</strong> eller <strong>"Lägg till på startskärm"</strong></Step>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-xs text-foreground">
      <span className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">{n}</span>
      <span>{children}</span>
    </div>
  );
}
