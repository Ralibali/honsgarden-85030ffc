export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;

  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

export function isPwaRegistrationDisabled(): boolean {
  if (typeof window === 'undefined') return true;

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const hostname = window.location.hostname;
  const isPreviewHost = hostname.includes('id-preview--') || hostname.endsWith('.lovableproject.com');

  return isInIframe || isPreviewHost;
}

/** Den rena push-workern. Den har ingen fetch-hanterare och cachar ingenting. */
export const PUSH_SW_URL = '/push-sw.js';

/**
 * Sant för en registrering som bara kör push-workern.
 *
 * Återställningen nedan avregistrerar service workers för att bli av med ett
 * gammalt cachat app-skal. Push-workern kan inte servera något app-skal, och
 * att avregistrera den säger samtidigt upp användarens push-prenumeration.
 * Den ska därför lämnas i fred.
 */
export function isPushOnlyRegistration(
  registration: Pick<ServiceWorkerRegistration, 'active' | 'waiting' | 'installing'>,
): boolean {
  const worker = registration.active ?? registration.waiting ?? registration.installing;
  if (!worker?.scriptURL) return false;
  try {
    return new URL(worker.scriptURL, window.location.origin).pathname === PUSH_SW_URL;
  } catch {
    return false;
  }
}

export async function cleanupPreviewServiceWorkers() {
  if (typeof window === 'undefined' || !isPwaRegistrationDisabled()) return;
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(registrations.map((registration) => registration.unregister()));
}

export async function recoverStalePwaShell(reason = 'stale-pwa-shell') {
  if (typeof window === 'undefined') return;

  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.allSettled(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(
        registrations
          .filter((registration) => !isPushOnlyRegistration(registration))
          .map((registration) => registration.unregister()),
      );
    }
  } finally {
    const url = new URL(window.location.href);
    url.searchParams.set('app-refresh', Date.now().toString());
    url.searchParams.set('reason', reason);
    window.location.replace(url.toString());
  }
}

/** The deployed web bundle is independent of the optional push worker. */
export async function checkForPwaUpdate(): Promise<{ hasUpdate: boolean; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch('/app-version.json', { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error();
    const version = await response.json();
    if (typeof version?.buildTime !== 'string' || !Number.isFinite(Date.parse(version.buildTime))) {
      throw new Error();
    }
    return { hasUpdate: version.buildTime !== __BUILD_TIME__ };
  } catch {
    return { hasUpdate: false, error: 'Kunde inte hämta den senaste versionen. Kontrollera anslutningen och försök igen.' };
  } finally {
    clearTimeout(timeout);
  }
}
