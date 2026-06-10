/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

// Push-notifikationer hanteras av separat messaging worker
self.importScripts("/push-sw.js");

// Precacha alla tillgångar som injiceras av vite-plugin-pwa vid byggtid
precacheAndRoute(self.__WB_MANIFEST);

// Rensa föråldrade caches
cleanupOutdatedCaches();

// HTML-navigeringar: NetworkFirst med fallback till precachad index.html
const navigationHandler = new NetworkFirst({
  cacheName: "html-pages",
  networkTimeoutSeconds: 3,
  plugins: [
    new ExpirationPlugin({
      maxEntries: 20,
      maxAgeSeconds: 60 * 60,
    }),
  ],
});

registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/~oauth/, /^\/api/],
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

// Hoppa över waiting direkt och ta över klienter
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
