// One-release cleanup worker for the former Workbox app-shell service worker.
// It deliberately leaves unrelated origin caches alone.
const APP_CACHE_NAMES = new Set([
  "images",
  "blog-images",
  "google-fonts-stylesheets",
  "google-fonts-webfonts",
  "js-chunks",
  "js-chunks-v2",
  "js-chunks-v3",
  "supabase-rest",
  "supabase-storage",
  "supabase-public-storage-v2",
]);

function isAppShellCache(name) {
  const isGeneratedWorkboxCache =
    /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name) &&
    name.endsWith(self.registration.scope);

  return APP_CACHE_NAMES.has(name) || isGeneratedWorkboxCache;
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const appCacheNames = cacheNames.filter(isAppShellCache);
        await Promise.allSettled(appCacheNames.map((name) => caches.delete(name)));
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(
          windowClients.map((client) => client.navigate(client.url)),
        );
      } finally {
        await self.registration.unregister();
      }
    })(),
  );
});