let swRegistration: ServiceWorkerRegistration | null = null;
let onUpdateFoundCb: (() => void) | null = null;
let updateFoundListenersAttached = new WeakSet<ServiceWorkerRegistration>();

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

export async function cleanupPreviewServiceWorkers() {
  if (typeof window === 'undefined' || !isPwaRegistrationDisabled()) return;
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(registrations.map((registration) => registration.unregister()));
}

export function setSwRegistration(reg: ServiceWorkerRegistration | null) {
  swRegistration = reg;
  if (reg && !updateFoundListenersAttached.has(reg)) {
    updateFoundListenersAttached.add(reg);
    reg.addEventListener('updatefound', () => {
      onUpdateFoundCb?.();
    });
  }
}

export async function checkForPwaUpdate(): Promise<{ hasUpdate: boolean; error?: string }> {
  if (isPwaRegistrationDisabled()) {
    return { hasUpdate: false, error: 'Uppdateringskontroll är bara aktiv i den publicerade appen' };
  }

  if (!('serviceWorker' in navigator)) {
    return { hasUpdate: false, error: 'Service Worker stöds inte i den här webbläsaren' };
  }
  if (!swRegistration) {
    return { hasUpdate: false, error: 'Ingen Service Worker registrerad ännu' };
  }

  return new Promise((resolve) => {
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        onUpdateFoundCb = null;
        resolve({ hasUpdate: false });
      }
    }, 5000);

    onUpdateFoundCb = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        onUpdateFoundCb = null;
        resolve({ hasUpdate: true });
      }
    };

    swRegistration!.update().catch((err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        onUpdateFoundCb = null;
        resolve({ hasUpdate: false, error: String(err) });
      }
    });
  });
}
