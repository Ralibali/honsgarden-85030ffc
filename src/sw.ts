/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, NetworkOnly, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

// Push-notifikationer hanteras av separat messaging worker.
self.importScripts("/push-sw.js");

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const SUPABASE_HOST = "sikbymtrbhrofysgkqsj.supabase.co";
const PRIVATE_RUNTIME_CACHES = ["supabase-rest", "supabase-storage"];

// SPA-navigation: alla routes servas från precachad index.html.
const handler = createHandlerBoundToURL("/index.html");
registerRoute(
  new NavigationRoute(handler, {
    denylist: [/^\/~oauth/, /^\/api/],
  }),
);

// JS-chunks kan delas mellan användare eftersom de inte innehåller användardata.
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
  }),
);

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

// Autentiserade Supabase REST-svar får aldrig hamna i en delad service-worker-cache.
// RLS filtrerar svar med Authorization-headern, medan Cache Storage normalt matchar
// på URL. NetworkOnly förhindrar att ett konto får ett annat kontos gamla svar.
registerRoute(
  ({ url, request }) =>
    url.hostname === SUPABASE_HOST &&
    url.pathname.startsWith("/rest/") &&
    request.method === "GET",
  new NetworkOnly(),
  "GET",
);

// Endast uttryckligen publika Supabase Storage-filer cachelagras. Signerade och
// autentiserade filer går alltid via nätverket.
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

// Mutationer får aldrig cachas eller replay:as – app-lagret sköter offline-kön.
const supabaseMutationMatcher = ({ url }: { url: URL }) => url.hostname === SUPABASE_HOST;
registerRoute(supabaseMutationMatcher, new NetworkOnly(), "POST");
registerRoute(supabaseMutationMatcher, new NetworkOnly(), "PATCH");
registerRoute(supabaseMutationMatcher, new NetworkOnly(), "PUT");
registerRoute(supabaseMutationMatcher, new NetworkOnly(), "DELETE");

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      ...PRIVATE_RUNTIME_CACHES.map((cacheName) => caches.delete(cacheName)),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_PRIVATE_CACHES") {
    event.waitUntil(Promise.all(PRIVATE_RUNTIME_CACHES.map((cacheName) => caches.delete(cacheName))));
    return;
  }

  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
