import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Smartphone, Share, MoreVertical, Sparkles, Check, Apple, Smartphone as Android } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

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
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <Smartphone className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="font-serif text-2xl text-center leading-snug">
            Hönsgården kommer snart som app! 📱
          </DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed pt-1">
            Vi jobbar på en riktig app för App Store och Google Play. Under tiden kan du installera Hönsgården direkt på hemskärmen – det fungerar precis som en vanlig app.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-muted/40 border border-border/60 p-4 space-y-3 mt-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Så installerar du nu</span>
          </div>

          {platform === 'ios' && (
            <div className="space-y-2">
              <Step n={1}>
                Tryck på <Share className="h-3.5 w-3.5 inline -mt-0.5 text-primary" /> <strong>Dela</strong> i Safari.
              </Step>
              <Step n={2}>
                Välj <strong>"Lägg till på hemskärmen"</strong>.
              </Step>
              <Step n={3}>Tryck <strong>Lägg till</strong> – klart! 🎉</Step>
            </div>
          )}

          {platform === 'android' && (
            <div className="space-y-2">
              <Step n={1}>
                Tryck på <MoreVertical className="h-3.5 w-3.5 inline -mt-0.5 text-primary" /> <strong>menyn</strong> i Chrome.
              </Step>
              <Step n={2}>
                Välj <strong>"Installera app"</strong> eller <strong>"Lägg till på startskärm"</strong>.
              </Step>
              <Step n={3}>Klart – ikonen finns nu på din hemskärm! 🎉</Step>
            </div>
          )}

          {platform === 'other' && (
            <div className="space-y-2">
              <Step n={1}>Öppna sidan i mobilens webbläsare (Safari på iPhone, Chrome på Android).</Step>
              <Step n={2}>Tryck på meny / dela-knappen.</Step>
              <Step n={3}>Välj <strong>"Lägg till på hemskärmen"</strong> / <strong>"Installera app"</strong>.</Step>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-2">
          Du kan alltid installera senare via menyn i webbläsaren.
        </p>

        <div className="flex justify-center pt-2">
          <Button onClick={dismiss} className="rounded-xl px-6">
            Tack, jag förstår
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
