import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Share, Smartphone, Bell, Zap, WifiOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { trackClick } from '@/hooks/useTracking';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const STORAGE_PREFIX = 'pwa-onboarding-seen:';

/**
 * Visas en gång efter inloggning för att introducera PWA-installation.
 * Hoppar över om appen redan körs som installerad PWA, eller om
 * användaren redan sett/avvisat onboardingen.
 */
export default function PwaInstallOnboarding() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (loading || !user?.id) return;

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    if (standalone) return;

    const seenKey = `${STORAGE_PREFIX}${user.id}`;
    if (localStorage.getItem(seenKey)) return;

    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));

    // Vänta lite så det inte krockar med onboarding-wizarden
    const timer = setTimeout(() => {
      setOpen(true);
      trackClick('pwa_onboarding_shown', { elementText: 'auto_open' });
    }, 1500);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [user?.id, loading]);

  const markSeen = () => {
    if (user?.id) {
      localStorage.setItem(`${STORAGE_PREFIX}${user.id}`, '1');
    }
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      markSeen();
      trackClick('pwa_onboarding_dismissed', { elementText: 'close' });
    }
    setOpen(next);
  };

  const handleInstall = async () => {
    trackClick('pwa_onboarding_install', {
      elementText: 'Installera nu',
      metadata: { platform: isIOS ? 'ios' : deferredPrompt ? 'android' : 'other' },
    });
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      trackClick('pwa_onboarding_choice', { elementText: choice.outcome });
      setDeferredPrompt(null);
      markSeen();
      setOpen(false);
    }
  };

  const handleLater = () => {
    markSeen();
    trackClick('pwa_onboarding_later', { elementText: 'Inte nu' });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-2">
            <Smartphone className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center font-serif text-xl">
            Installera Hönsgården på din mobil
          </DialogTitle>
          <DialogDescription className="text-center">
            Få appen direkt på hemskärmen – snabbare och alltid nära till hands.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 my-4">
          <Benefit icon={Zap} label="Öppnas direkt" />
          <Benefit icon={WifiOff} label="Fungerar offline" />
          <Benefit icon={Bell} label="Påminnelser" />
        </div>

        {isIOS ? (
          <div className="space-y-2.5 rounded-xl bg-muted/40 p-4">
            <Step n={1}>
              Tryck på <Share className="h-3.5 w-3.5 inline text-primary -mt-0.5" /> <strong>Dela</strong> i Safari
            </Step>
            <Step n={2}>
              Välj <strong>"Lägg till på hemskärmen"</strong>
            </Step>
            <Step n={3}>
              Tryck <strong>Lägg till</strong> – klart! 🎉
            </Step>
          </div>
        ) : !deferredPrompt ? (
          <div className="space-y-2.5 rounded-xl bg-muted/40 p-4">
            <Step n={1}>
              Tryck på <strong>⋮ menyn</strong> i webbläsaren
            </Step>
            <Step n={2}>
              Välj <strong>"Installera app"</strong> eller <strong>"Lägg till på startskärm"</strong>
            </Step>
          </div>
        ) : null}

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
          <Button variant="ghost" onClick={handleLater} className="w-full sm:w-auto">
            Inte nu
          </Button>
          {!isIOS && deferredPrompt ? (
            <Button onClick={handleInstall} className="w-full sm:w-auto gap-2">
              <Download className="h-4 w-4" />
              Installera nu
            </Button>
          ) : (
            <Button onClick={handleLater} className="w-full sm:w-auto">
              Jag fixar det
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Benefit({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <Icon className="h-4.5 w-4.5 text-primary" />
      </div>
      <span className="text-[11px] text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-xs text-foreground">
      <span className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
        {n}
      </span>
      <span>{children}</span>
    </div>
  );
}
