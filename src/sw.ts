/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, NetworkOnly, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

// Push-notifikationer hanteras av separat messaging worker
self.importScripts("/push-sw.js");

// Precacha alla tillgångar som injiceras av vite-plugin-pwa vid byggtid
precacheAndRoute(self.__WB_MANIFEST);

// Rensa föråldrade caches
cleanupOutdatedCaches();

const SUPABASE_HOST = "sikbymtrbhrofysgkqsj.supabase.co";

// SPA-navigation: alla routes servas från precachad index.html
const handler = createHandlerBoundToURL("/index.html");
registerRoute(
  new NavigationRoute(handler, {
    denylist: [/^\/~oauth/, /^\/api/],
  })
);

// JS-chunks: StaleWhileRevalidate så offline-laddade sidor fungerar
registerRoute(
  ({ request }) => request.destination === "script",
  new StaleWhileRevalidate({
    cacheName: "js-chunks",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 7,
      }),
    ],
  })
);

// Bilder: CacheFirst för snabb rendering
registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "images",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
);

// Google Fonts stylesheets
registerRoute(
  /^https:\/\/fonts\.googleapis\.com/,
  new StaleWhileRevalidate({
    cacheName: "google-fonts-stylesheets",
  })
);

// Google Fonts webfonts
registerRoute(
  /^https:\/\/fonts\.gstatic\.com/,
  new CacheFirst({
    cacheName: "google-fonts-webfonts",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
);

// Bloggbilder
registerRoute(
  /\/blog-images\//,
  new CacheFirst({
    cacheName: "blog-images",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
);

// ---- Supabase runtime cache ----
// GET mot REST-API:t: stale-while-revalidate så listor och profiler visas
// direkt offline och uppdateras i bakgrunden när nätet finns.
registerRoute(
  ({ url, request }) =>
    url.hostname === SUPABASE_HOST &&
    url.pathname.startsWith("/rest/") &&
    request.method === "GET",
  new StaleWhileRevalidate({
    cacheName: "supabase-rest",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 60 * 60 * 24 * 3,
      }),
    ],
  }),
  "GET",
);

// GET mot storage (bilder m.m.)
registerRoute(
  ({ url, request }) =>
    url.hostname === SUPABASE_HOST &&
    url.pathname.startsWith("/storage/") &&
    request.method === "GET",
  new StaleWhileRevalidate({
    cacheName: "supabase-storage",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
  "GET",
);

// Mutationer får aldrig cachas eller replay:as – app-lagret sköter offline-kön.
const supabaseMutationMatcher = ({ url }: { url: URL }) =>
  url.hostname === SUPABASE_HOST;
registerRoute(supabaseMutationMatcher, new NetworkOnly(), "POST");
registerRoute(supabaseMutationMatcher, new NetworkOnly(), "PATCH");
registerRoute(supabaseMutationMatcher, new NetworkOnly(), "PUT");
registerRoute(supabaseMutationMatcher, new NetworkOnly(), "DELETE");

// Ta över klienter när ny SW aktiveras
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Vänta på explicit signal från klienten innan vi byter version,
// så användaren får se uppdateringsprompten innan reload.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
