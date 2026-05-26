import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Tvingad auto-uppdatering: så fort en ny service worker-version är
 * tillgänglig aktiveras den och sidan laddas om automatiskt. Ingen
 * prompt visas för användaren – de får alltid senaste versionen.
 *
 * - Pollar var 5:e minut samt vid fokus/online-event.
 * - Lyssnar på `controllerchange` som extra säkerhet om en annan flik
 *   triggar uppdateringen först.
 */
export default function PwaUpdatePrompt() {
  const reloadedRef = useRef(false);

  const triggerReload = () => {
    if (reloadedRef.current) return;
    reloadedRef.current = true;
    window.location.reload();
  };

  const { updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegistered(registration) {
      if (!registration) return;

      const check = () => {
        registration.update().catch(() => {
          /* ignorera nätfel – nästa intervall försöker igen */
        });
      };

      // Polla regelbundet så öppna flikar fångar nya deploys snabbt.
      const interval = window.setInterval(check, 5 * 60 * 1000);
      window.addEventListener('focus', check);
      window.addEventListener('online', check);

      return () => {
        window.clearInterval(interval);
        window.removeEventListener('focus', check);
        window.removeEventListener('online', check);
      };
    },
    onNeedRefresh() {
      // Auto-aktivera ny SW och ladda om utan att fråga användaren.
      void updateServiceWorker(true);
    },
    onRegisterError(err) {
      console.warn('[PWA] Service worker-registrering misslyckades:', err);
    },
  });

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = () => triggerReload();
    navigator.serviceWorker.addEventListener('controllerchange', handler);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handler);
    };
  }, []);

  return null;
}
