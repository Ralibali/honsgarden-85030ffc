import { useEffect } from 'react';
import { trackClick } from './useTracking';

const STANDALONE_LOGGED_KEY = 'pwa_standalone_logged';

/**
 * Spårar PWA-installationer:
 * - `pwa_install_prompted` när Chrome/Android visar install-prompten
 * - `pwa_installed` när `appinstalled`-eventet triggas
 * - `pwa_standalone_session` en gång per enhet när appen körs i standalone
 *   (fångar iOS som saknar `appinstalled`-event)
 */
export function usePwaInstallTracking() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstall = (e: Event) => {
      const platform = /iPad|iPhone|iPod/.test(navigator.userAgent)
        ? 'ios'
        : /Android/.test(navigator.userAgent)
        ? 'android'
        : 'other';
      trackClick('pwa_install_prompted', {
        elementText: 'beforeinstallprompt',
        metadata: { platform, source: 'browser_event' },
      });
    };

    const handleInstalled = () => {
      const platform = /Android/.test(navigator.userAgent) ? 'android' : 'other';
      trackClick('pwa_installed', {
        elementText: 'appinstalled',
        metadata: { platform, source: 'browser_event' },
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    // Logga en gång per enhet om appen körs som installerad PWA
    try {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true;
      if (standalone && !localStorage.getItem(STANDALONE_LOGGED_KEY)) {
        const platform = /iPad|iPhone|iPod/.test(navigator.userAgent)
          ? 'ios'
          : /Android/.test(navigator.userAgent)
          ? 'android'
          : 'other';
        trackClick('pwa_standalone_session', {
          elementText: 'standalone_detected',
          metadata: { platform, source: 'display_mode' },
        });
        localStorage.setItem(STANDALONE_LOGGED_KEY, '1');
      }
    } catch {
      /* ignorera localStorage-fel */
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);
}
