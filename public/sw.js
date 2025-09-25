// public/sw.js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  const d = event.data?.json?.() || {};
  event.waitUntil(
    self.registration.showNotification(d.title || '通知', {
      body: d.preview || '',
      data: { url: d.url || '/' },
      tag: d.tag || 'msg'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.openWindow(url));
});
