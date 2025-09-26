// public/sw.js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let d = {};
    try {
      if (event.data) {
        const t = await event.data.text();   // ← Safariに安全
        d = JSON.parse(t);
      }
    } catch (_) {
      // 文字列ペイロードだった場合のフォールバック
      d = { title: '通知', preview: String(event.data || '') };
    }

    const title = (d && d.title && String(d.title).trim()) || '通知';  // ← 空タイトルは避ける
    const body  = (d && d.preview) || '';
    const url   = (d && d.url) || '/';
    const tag   = (d && d.tag) || ('msg-' + Date.now());               // ← 毎回別タグで潰れ防止

    await self.registration.showNotification(title, {
      body,
      data: { url },
      tag,
      renotify: false // 同じtagでも連続バイブ等を抑制
      // icon, badge を入れたい場合は manifest の icons を使ってもOK
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.openWindow(url));
});
