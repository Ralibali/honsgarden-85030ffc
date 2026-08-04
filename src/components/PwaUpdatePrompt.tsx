import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { cleanupPreviewServiceWorkers, isPwaRegistrationDisabled, setSwRegistration } from '@/lib/pwaUpdate';

/**
 * Visar en liten toast längst ner när en ny service worker väntar
 * på att aktiveras. Användaren klickar "Uppdatera" → vi skickar
 * SKIP_WAITING till waiting-workern och laddar om vid controllerchange.
 */
export default function PwaUpdatePrompt() {
  const promptShownRef = useRef(false);
  const reloadingRef = useRef(false);
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
      if (promptShownRef.current) return;
      promptShownRef.current = true;

      toast('En ny version av Hönsgården 🐔', {
        description: 'Ladda om för att få de senaste funktionerna och menyvalen.',
        duration: Infinity,
        action: {
          label: 'Uppdatera',
          onClick: () => {
            void updateServiceWorker(true);
          },
        },
      });
    },
    onRegisterError(err) {
      console.warn('[PWA] Service worker-registrering misslyckades:', err);
    },
  });

  useEffect(() => {
    if (disabled) {
      void cleanupPreviewServiceWorkers();
      return;
    }

    if (!('serviceWorker' in navigator)) return;
    const onControllerChange = () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, [disabled]);

  return null;
}
