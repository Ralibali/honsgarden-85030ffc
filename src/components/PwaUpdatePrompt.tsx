import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Visar en diskret prompt i hörnet när en ny service worker-version av
 * appen är installerad och väntar på att aktiveras. När användaren
 * klickar "Ladda om" skickas SKIP_WAITING-meddelandet och sidan
 * laddas om med nya assets.
 *
 * Körs bara i produktion (SW registreras inte i dev av vite-plugin-pwa
 * som standard). Prompt visas inte för offline-ready-toasten.
 */
export default function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      // Polla efter ny version var 60:e min så fliken fångar upp deploys
      // även om användaren håller den öppen länge.
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {
            /* nätverksfel – vi försöker igen nästa intervall */
          });
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(err) {
      console.warn('[PWA] Service worker-registrering misslyckades:', err);
    },
  });

  // Exponera för integrationer/debug – inte nödvändigt men praktiskt
  useEffect(() => {
    if (needRefresh) {
      console.info('[PWA] Ny version tillgänglig – väntar på användarbeslut.');
    }
  }, [needRefresh]);

  if (!needRefresh) return null;

  const handleReload = () => {
    void updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-primary/30 bg-card/95 backdrop-blur shadow-lg p-3 flex items-center gap-3 animate-in slide-in-from-bottom-2 fade-in"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Ny version finns 🐣</p>
        <p className="text-xs text-muted-foreground">Ladda om för att uppdatera Hönsgården.</p>
      </div>
      <Button size="sm" onClick={handleReload} className="h-9 gap-1.5 shrink-0">
        <RefreshCw className="h-3.5 w-3.5" />
        Ladda om
      </Button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Stäng uppdateringsmeddelande"
        className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
