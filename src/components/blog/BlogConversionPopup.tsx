import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Egg, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STORAGE_KEY = 'blog-popup-v1';
const DISMISS_DAYS = 30;
const SCROLL_TRIGGER = 0.5; // 50 %

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export default function BlogConversionPopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (wasRecentlyDismissed()) return;

    let fired = false;
    const trigger = () => {
      if (fired) return;
      fired = true;
      cleanup();
      // Liten fördröjning så det inte känns aggressivt
      window.setTimeout(() => setOpen(true), 250);
    };

    const onScroll = () => {
      const doc = document.documentElement;
      const scrolled = (window.scrollY + window.innerHeight) / Math.max(doc.scrollHeight, 1);
      if (scrolled >= SCROLL_TRIGGER) trigger();
    };

    const onMouseLeave = (e: MouseEvent) => {
      // Desktop exit-intent: muspekaren lämnar uppåt
      if (e.clientY <= 0) trigger();
    };

    const idleTimer = window.setTimeout(trigger, 45_000); // fallback efter 45 s

    function cleanup() {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mouseleave', onMouseLeave);
      window.clearTimeout(idleTimer);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);

    return cleanup;
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) markDismissed();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Ange en giltig e-postadress');
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('newsletter_subscribers' as any)
      .insert({ email: trimmed } as any);
    setLoading(false);

    if (error && error.code !== '23505') {
      toast.error('Något gick fel. Försök igen.');
      return;
    }
    if (error?.code === '23505') {
      toast.info('Du prenumererar redan!');
    } else {
      toast.success('Tack! Din guide är på väg 🐣');
    }
    setSuccess(true);
    markDismissed();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border/40">
        <div className="bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary mb-3">
            <Egg className="h-3.5 w-3.5" />
            Gratisguide från Hönsgården
          </div>

          {success ? (
            <div className="text-center py-4">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-3" />
              <DialogTitle className="font-serif text-xl text-foreground mb-2">
                Tack – kolla din inkorg!
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mb-5">
                Vi har lagt till dig och skickar våra bästa hönstips varje vecka.
              </DialogDescription>
              <Link to="/auth" onClick={() => setOpen(false)}>
                <Button size="lg" className="w-full gap-2">
                  Skapa gratiskonto i appen <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <p className="text-[11px] text-muted-foreground mt-3">
                Logga ägg, hälsa och ekonomi – helt gratis.
              </p>
            </div>
          ) : (
            <>
              <DialogTitle className="font-serif text-2xl leading-tight text-foreground mb-2">
                Lär dig hönshållning på riktigt
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mb-5">
                Få vår nybörjarguide och de bästa tipsen från Hönsgården direkt i mejlen.
                Ingen spam – bara sånt du har nytta av.
              </DialogDescription>

              <form onSubmit={handleSubmit} className="space-y-2">
                <Input
                  type="email"
                  placeholder="din@epost.se"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  required
                  autoFocus
                />
                <Button type="submit" disabled={loading} size="lg" className="w-full gap-2">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Skicka mig guiden <ArrowRight className="h-4 w-4" /></>
                  )}
                </Button>
              </form>

              <div className="mt-5 pt-5 border-t border-border/40 text-center">
                <p className="text-xs text-muted-foreground mb-2">
                  Vill du gå hela vägen?
                </p>
                <Link
                  to="/auth"
                  onClick={() => {
                    markDismissed();
                    setOpen(false);
                  }}
                  className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  Skapa gratiskonto i appen <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <p className="text-[11px] text-muted-foreground mt-4 text-center">
                Avsluta när du vill. Vi delar aldrig din e-post.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
