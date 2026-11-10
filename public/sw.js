// Yes Chef! service worker: shows reminders and opens the app when one is tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let m = {};
  try {
    m = event.data ? event.data.json() : {};
  } catch (e) {
    m = { title: 'Yes Chef!', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(m.title || 'Yes Chef!', {
      body: m.body || '',
      tag: m.tag || undefined,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: m.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
