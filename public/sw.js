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
  const absUrl = new URL(u, self.location.origin);

  // ★ 同一URL判定を回避するため、毎回ユニークな ts を付与
  try { absUrl.searchParams.set('ts', String(Date.now())); } catch {}

  event.waitUntil((async () => {
    // ★ デバッグ：クリックが発火したことをページに知らせる
    try {
      const all0 = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      for (const c of all0) c.postMessage({ __debug: 'notification-click', target: absUrl.href });
    } catch {}

    // ★ 二系統の橋渡し手段を準備
    let bc = null;
    try { bc = new BroadcastChannel('sw-bridge'); } catch {}

    // 1) 既存ウィンドウがあれば → focus → navigate を試みつつ、同時に二系統で“開け”シグナルを先に送る
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url && new URL(c.url).origin === self.location.origin) {
        // 先にページへ合図（postMessage / BroadcastChannel 両方）
        try { c.postMessage({ __open: absUrl.href }); } catch {}
        try { bc && bc.postMessage({ __open: absUrl.href }); } catch {}

        // 前面化 → navigate（iOS 26 での競合を避けるため順序をこの形に）
        try { await c.focus(); } catch {}
        try {
          if ('navigate' in c && typeof c.navigate === 'function') {
            await c.navigate(absUrl.href);
            return; // ここで成功したら完了
          }
        } catch {}

        // navigate に失敗しても、合図は既に送ってあるので return
        return;
      }
    }

    // 2) 既存ウィンドウが無ければ、新規ウィンドウを開く（最終手段）
    try { await self.clients.openWindow(absUrl.href); } catch {}
  })());
});


  
