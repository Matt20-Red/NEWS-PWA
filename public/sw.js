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
    // const body  = (d && d.preview) || '';
    const body  = (d && (d.preview || d.body)) || '';  // ← body も拾う
    const url   = (d && d.url) || '/';
    const tag   = (d && d.tag) || ('msg-' + Date.now());               // ← 毎回別タグで潰れ防止

    // ★ デバッグ：クライアントへ「push受信したよ」と知らせる
    try {
      const all = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      for (const c of all) c.postMessage({ __debug: 'push-received', title, body, url, tag });
    } catch {}

    
    await self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',          // ← 念のためアイコン/バッジも付与
      badge: '/icon-192.png',
      data: { url },
      tag,
      renotify: false // 同じtagでも連続バイブ等を抑制
      // icon, badge を入れたい場合は manifest の icons を使ってもOK
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const u = event.notification.data?.url || '/';
  const abs = new URL(u, self.location.origin).href;

  event.waitUntil((async () => {
    // ★ 追加: BroadcastChannel でも橋渡し（届く経路を増やす）
    let bc = null;
    try { bc = new BroadcastChannel('sw-bridge'); } catch {}

    // 1) 既存ウィンドウがあれば → focus → navigate を試みる
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url && new URL(c.url).origin === self.location.origin) {
        try { await c.focus(); } catch {}
        try {
          if ('navigate' in c && typeof c.navigate === 'function') {
            await c.navigate(abs);
            // 併せて二系統で「開け」シグナルを送る（念のため）
            try { c.postMessage({ __open: abs }); } catch {}
            try { bc && bc.postMessage({ __open: abs }); } catch {}
            return;
          }
        } catch {}

        // 2) navigate が効かない系 → ページ側に任せる（二系統）
        try { c.postMessage({ __open: abs }); } catch {}
        try { bc && bc.postMessage({ __open: abs }); } catch {}
        return;
      }
    }

    // 3) 既存ウィンドウがなければ新規に開く（最終手段）
    try { await self.clients.openWindow(abs); } catch {}
  })());
});
  
});
