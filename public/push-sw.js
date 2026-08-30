/* Web Push – importeras in i den Workbox-genererade service workern */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || 'Hönsgården';
  const options = {
    body: data.body || '',
    icon: data.icon || '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: data.tag || 'honsgarden',
    renotify: !!data.tag,
    data: { url: data.url || '/app' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/app';
  // Meddela appen så att klick kan mätas (swarm I: full-chain-instrumentering).
  const notifyClick = (client) => {
    try { client.postMessage({ type: 'honsgarden:push-notification-click', url }); } catch (e) { /* ignore */ }
  };
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(url);
          notifyClick(client);
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url).then((client) => { if (client) notifyClick(client); });
      }
    })
  );
});
