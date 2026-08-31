// Temporary recovery worker for iOS Safari clients stuck on an older app shell.
// Keep this file at /sw.js for one release cycle so existing registrations update.
const APP_CACHE_NAMES = new Set([
  "js-chunks",
  "js-chunks-v2",
  "js-chunks-v3",
  "js-chunks-v4",
  "images",
  "blog-images",
  "google-fonts-stylesheets",
  "google-fonts-webfonts",
  "supabase-rest",
  "supabase-storage",
  "supabase-public-storage-v2",
]);

function isAppShellCache(name) {
  return APP_CACHE_NAMES.has(name) || /(^|-)precache-v\d+-/.test(name);
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