// public/sw.js

let __lastOpenUrl = null;
// クリック多重防止（300ms）
let __lastClickAt = 0;

// intent ACK 待ち用
let __awaitingIntentId = null;
let __awaitingResolve = null;
function waitIntentAck(id, ms = 500) {
  __awaitingIntentId = id;
  return new Promise((resolve) => {
    __awaitingResolve = resolve;
    setTimeout(() => {
      if (__awaitingResolve) { __awaitingResolve(false); __awaitingResolve = null; __awaitingIntentId = null; }
    }, ms);
  });
}

let __lastOpenTs = 0;

let __lastIntent = null;     // { title, body, url, ts }
let __lastIntentTs = 0;

async function saveIntentEphemeral(intent) {
  __lastIntent = intent;
  __lastIntentTs = intent?.ts || Date.now();
  try {
    const cache = await caches.open('intent-ephemeral');
    const res = new Response(JSON.stringify({ intent, ts: __lastIntentTs }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
    await cache.put(new Request('/__last_intent', { method: 'GET' }), res);
  } catch {}
}
async function loadIntentEphemeral(maxAgeMs = 60000) {
  try {
    const cache = await caches.open('intent-ephemeral');
    const res = await cache.match('/__last_intent');
    if (!res) return null;
    const { intent, ts } = await res.json();
    if (ts && (Date.now() - ts) <= maxAgeMs) return intent;
  } catch {}
  return null;
}



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

  //---------------ここから（ア）まで入替
  /* event.notification.close();
  const u = event.notification.data?.url || '/';
  const absUrl = new URL(u, self.location.origin);
  // absUrl を作った直後あたりで
  __lastOpenUrl = absUrl.href;
  __lastOpenTs = Date.now();

  try { absUrl.searchParams.set('ts', String(Date.now())); } catch {}

  event.waitUntil((async () => {
    // デバッグ：クリック検知
    try {
      const all0 = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      for (const c of all0) c.postMessage({ __debug: 'notification-click', target: absUrl.href });
    } catch {}

    // 二系統シグナルを“先出し”
    let bc = null;
    try { bc = new BroadcastChannel('sw-bridge'); } catch {}
    try {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if (c.url && new URL(c.url).origin === self.location.origin) {
          try { c.postMessage({ __open: absUrl.href }); } catch {}
        }
      }
      try { bc && bc.postMessage({ __open: absUrl.href }); } catch {}
    } catch {}

    // ★ 既存ウィンドウの有無に関係なく “必ず” 新規／既存で開かせる
    try { await self.clients.openWindow(absUrl.href); } catch {}

    // （端末差対策）ごく短い待ちののち、もう一度 openWindow を試す
    try { await new Promise(r => setTimeout(r, 50)); } catch {}
    try { await self.clients.openWindow(absUrl.href); } catch {}
  })());
});
*/
//-----------------------（ア）------------------

  event.notification.close();
  // --- 追加: クリック多重防止 ---
  const now = Date.now();
  if (now - __lastClickAt < 300) return;
  __lastClickAt = now;
  
  const u = event.notification.data?.url || '/';
  const absUrl = new URL(u, self.location.origin);
  try { absUrl.searchParams.set('ts', String(Date.now())); } catch {}

  __lastOpenUrl = absUrl.href; __lastOpenTs = Date.now();

  // ★ intent に一意の id を付与
  const intent = {
    id: Math.random().toString(36).slice(2),
    title: event.notification.title || '通知',
    body: event.notification.body || '',  // showNotification で渡した body が入る
    url: absUrl.href,
    ts: Date.now()
  };

  // __lastOpenUrl = absUrl.href; __lastOpenTs = Date.now();
  
  event.waitUntil((async () => {
    // 1) 短命保存（落ちてもページが拾える）
    await saveIntentEphemeral(intent);

    // 2) 二系統で既存クライアントへ即時ハンドオフ
    let bc = null;
    try { bc = new BroadcastChannel('sw-bridge'); } catch {}
    const all = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    let hasSameOrigin = false;
    for (const c of all) {
      if (c.url && new URL(c.url).origin === self.location.origin) {
        hasSameOrigin = true;
        try { c.postMessage({ __intent: intent }); } catch {}
      }
    }
    try { bc && bc.postMessage({ __intent: intent }); } catch {}

    // ★ 既存クライアントがいる想定でも ACK を待つ。来なければ /note へフォールバック
    let acked = false;
    if (hasSameOrigin) {
      try { acked = await waitIntentAck(intent.id, 600); } catch {}
    }
    
    // 3) 既存クライアントが無ければ /note.html を開く（フォールバック）
    // if (!hasSameOrigin) {
    if (!hasSameOrigin || !acked) {
      // 既存なし or 合図ロスト → /note.html を開く（保険）
      try { await self.clients.openWindow(absUrl.href); } catch {}
      try { await new Promise(r => setTimeout(r, 150)); await self.clients.openWindow(absUrl.href); } catch {}
    }
  })());
});

/*
self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.__req_open) {
    // 直近のクリック（例：60秒以内）だけ有効にする
    const fresh = __lastOpenUrl && (Date.now() - __lastOpenTs < 60000);
    try {
      event.source && event.source.postMessage(
        fresh ? { __open: __lastOpenUrl, __ts: __lastOpenTs } : { __open: null }
      );
    } catch {}
  }

    // メモリがあればそれ、無ければ短命キャッシュから
  let intent = __lastIntent;
  if (!intent || (Date.now() - (__lastIntentTs||0) > 60000)) {
   intent = await loadIntentEphemeral(60000);
  }
  try {
    event.source && event.source.postMessage(
      intent ? { __intent: intent } : { __intent: null }
    );
  } catch {}
  */

self.addEventListener('message', async (event) => {
  const msg = event.data || {};

  // 既存: __req_open への応答（そのまま維持）
  if (msg.__req_open) {
    const fresh = __lastOpenUrl && (Date.now() - __lastOpenTs < 60000);
    try {
      event.source && event.source.postMessage(
        fresh ? { __open: __lastOpenUrl, __ts: __lastOpenTs } : { __open: null }
      );
    } catch {}
  }

  // 追加: __req_intent の時だけ intent を返す（← ガードが重要）
  if (msg.__req_intent) {
    let intent = __lastIntent;
    if (!intent || (Date.now() - (__lastIntentTs || 0) > 60000)) {
      intent = await loadIntentEphemeral(60000);
    }
    try {
      event.source && event.source.postMessage(
        intent ? { __intent: intent } : { __intent: null }
      );
    } catch {}
  }

  // ★ intent ACK を受け取る
  if (msg.__intent_ack && msg.id && __awaitingIntentId && msg.id === __awaitingIntentId) {
    if (__awaitingResolve) { try { __awaitingResolve(true); } catch {} }
    __awaitingResolve = null;
    __awaitingIntentId = null;
  }
    
});

  
