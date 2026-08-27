/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { PWA_NAVIGATION_DENYLIST } from "./lib/pwaNavigationDenylist";

self.importScripts("/push-sw.js");
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const SUPABASE_HOST = "sikbymtrbhrofysgkqsj.supabase.co";
// `images` tas också bort för att rensa eventuella privata Supabase-bilder som
// äldre service-worker-versioner kan ha lagt i den generella bildcachen.
const AUTH_SENSITIVE_CACHES = ["supabase-rest", "supabase-storage", "images"];
// Legacy caches from previous SW versions must be purged on activate so users
// don't keep serving the broken pre-hotfix JS bundle.
const LEGACY_CACHES = [
  "js-chunks",
  "js-chunks-v2",
  "js-chunks-v3",
  "workbox-precache-v2-https://honsgarden.se/",
];

self.addEventListener("install", () => {
  self.skipWaiting();
});

const handler = createHandlerBoundToURL("/index.html");
registerRoute(
  new NavigationRoute(handler, {
    denylist: PWA_NAVIGATION_DENYLIST,
  }),
);

// Supabase-regler registreras före generella asset-regler. Workbox använder den
// första matchande routen, så ordningen är en del av dataskyddet.
registerRoute(
  ({ url, request }) =>
    url.hostname === SUPABASE_HOST &&
    url.pathname.startsWith("/rest/") &&
    request.method === "GET",
  new NetworkOnly(),
  "GET",
);

registerRoute(
  ({ url, request }) =>
    url.hostname === SUPABASE_HOST &&
    url.pathname.startsWith("/storage/v1/object/public/") &&
    request.method === "GET",
  new StaleWhileRevalidate({
    cacheName: "supabase-public-storage-v2",
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

registerRoute(
  ({ url, request }) =>
    url.hostname === SUPABASE_HOST &&
    url.pathname.startsWith("/storage/") &&
    !url.pathname.startsWith("/storage/v1/object/public/") &&
    request.method === "GET",
  new NetworkOnly(),
  "GET",
);

const supabaseMutationMatcher = ({ url }: { url: URL }) => url.hostname === SUPABASE_HOST;
registerRoute(supabaseMutationMatcher, new NetworkOnly(), "POST");
registerRoute(supabaseMutationMatcher, new NetworkOnly(), "PATCH");
registerRoute(supabaseMutationMatcher, new NetworkOnly(), "PUT");
registerRoute(supabaseMutationMatcher, new NetworkOnly(), "DELETE");

// JS-chunkar hämtas alltid nätverket först. StaleWhileRevalidate kunde annars
// servera en gammal shell/chunk-kombination efter en deploy → vit sida.
// Cachen används bara som offline-fallback.
registerRoute(
  ({ request }) => request.destination === "script",
  new NetworkFirst({
    cacheName: "js-chunks-v4",
    networkTimeoutSeconds: 8,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 7,
      }),
    ],
  }),
);


// Den generella bildcachen får aldrig fånga någon Supabase-resurs. Publika
// Supabase-bilder hanteras av den uttryckliga routen ovan; privata går nätverket.
registerRoute(
  ({ url, request }) => request.destination === "image" && url.hostname !== SUPABASE_HOST,
  new CacheFirst({
    cacheName: "images",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
);

registerRoute(
  /^https:\/\/fonts\.googleapis\.com/,
  new StaleWhileRevalidate({ cacheName: "google-fonts-stylesheets" }),
);

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
  }),
);

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
  }),
);

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      ...AUTH_SENSITIVE_CACHES.map((cacheName) => caches.delete(cacheName)),
      ...LEGACY_CACHES.map((cacheName) => caches.delete(cacheName)),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_PRIVATE_CACHES") {
    event.waitUntil(Promise.all(AUTH_SENSITIVE_CACHES.map((cacheName) => caches.delete(cacheName))));
    return;
  }

  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
