export async function clearBrowserAppCaches(options: { unregisterServiceWorkers?: boolean } = {}) {
  if (typeof window === 'undefined') return;

  const tasks: Promise<unknown>[] = [];

  if ('caches' in window) {
    tasks.push(
      caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name)))),
    );
  }

  if ('serviceWorker' in navigator) {
    tasks.push(
      navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(
        registrations.map((registration) => (
          options.unregisterServiceWorkers
            ? registration.unregister()
            : registration.update().catch(() => false)
        )),
      )),
    );
  }

  await Promise.allSettled(tasks);
}

export async function forceFreshAppReload(reason = 'app-cache-refresh') {
  if (typeof window === 'undefined') return;

  try {
    await clearBrowserAppCaches({ unregisterServiceWorkers: true });
  } finally {
    const url = new URL(window.location.href);
    url.searchParams.set('app-refresh', Date.now().toString());
    url.searchParams.set('reason', reason);
    window.location.replace(url.toString());
  }
}