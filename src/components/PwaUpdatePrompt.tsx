import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { cleanupPreviewServiceWorkers, isPwaRegistrationDisabled, setSwRegistration } from '@/lib/pwaUpdate';

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
  const updateTriggeredRef = useRef(false);
  const disabled = isPwaRegistrationDisabled();

  const { updateServiceWorker } = useRegisterSW({
    immediate: !disabled,
    onRegistered(registration) {
      if (disabled) {
        setSwRegistration(null);
        void cleanupPreviewServiceWorkers();
        return;
      }

      setSwRegistration(registration ?? null);
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
      if (updateTriggeredRef.current) return;
      updateTriggeredRef.current = true;
      void updateServiceWorker(true);
    },
    onRegisterError(err) {
      console.warn('[PWA] Service worker-registrering misslyckades:', err);
    },
  });

  useEffect(() => {
    if (disabled) void cleanupPreviewServiceWorkers();
  }, [disabled]);

  return null;
}
