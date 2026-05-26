let swRegistration: ServiceWorkerRegistration | null = null;
let onUpdateFoundCb: (() => void) | null = null;

export function setSwRegistration(reg: ServiceWorkerRegistration | null) {
  swRegistration = reg;
  if (reg) {
    reg.addEventListener('updatefound', () => {
      onUpdateFoundCb?.();
    });
  }
}

export async function checkForPwaUpdate(): Promise<{ hasUpdate: boolean; error?: string }> {
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
