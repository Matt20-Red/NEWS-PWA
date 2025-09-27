
// api/broadcast.js
import { webpush } from './_common.js';
import { list, remove, count } from '../lib/store.js';

function detectService(endpoint = '') {
  if (endpoint.includes('web.push.apple.com') || endpoint.includes('api.push.apple.com')) return 'apple';
  if (endpoint.includes('fcm.googleapis.com')) return 'fcm';
  if (endpoint.includes('updates.push.services.mozilla.com')) return 'mozilla';
  if (endpoint.includes('notify.windows.com')) return 'wns';
  return 'unknown';
}

// web-push にタイムアウトを付ける
function sendWithTimeout(sub, payload, ms = 3000) {
  return Promise.race([
    webpush.sendNotification(sub, payload, { TTL: 60, urgency: 'high' }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);
}

// エラー分類（削除すべきか判断）
function classifyWebPushError(e) {
  // web-push の WebPushError は statusCode/body/headers を持つ
  const sc = e?.statusCode || null;
  const msg = String(e && (e.body || e.message || e));

  if (sc === 404 || sc === 410) return { type: 'expired', reason: `gone:${sc}` };
  if (sc === 400) return { type: 'expired', reason: 'bad-subscription' }; // 破損や無効
  if (sc === 401 || sc === 403) return { type: 'unauthorized', reason: `auth:${sc}` }; // グローバル問題
  if (sc === 429) return { type: 'retry', reason: 'rate' };
  if (sc >= 500 && sc < 600) return { type: 'retry', reason: `server:${sc}` };

  if (msg.includes('timeout')) return { type: 'retry', reason: 'timeout' };

  return { type: 'other', reason: msg.slice(0, 300) };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();
    const { code, message } = req.body || {};
    if (!code || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ ok:false, error: 'bad request' });
    }

    // 一意化URLで“同一URL最適化による無視”を避ける
    // const url = `/note.html?ts=${Date.now()}#msg=${encodeURIComponent(message)}`;
    const url = `/note.html?ts=${Date.now()}&m=${encodeURIComponent(message)}`;
    // const payload = JSON.stringify({ title: '通知', body: message, url });
    // const payload = JSON.stringify({ title: '通知', body: message || '', url });
    const payload = JSON.stringify({ title: 'Bat — ${code}', body: message || '', url, code });

    const subsAll = await list(code);
    const targets = subsAll.filter(s => detectService(s.endpoint) !== 'wns'); // WNSは非対応なので除外
    const skipped = subsAll.length - targets.length;

    let attempted = 0, accepted = 0, expired = 0, retry = 0;
    const removedEndpoints = [];
    const errors = [];
    const authErrors = [];

    const results = await Promise.allSettled(
      targets.map(async (sub) => {
        attempted++;
        try {
          await sendWithTimeout(sub, payload, 3000);
          return { ok:true, sub };
        } catch (e) {
          const cls = classifyWebPushError(e);
          if (cls.type === 'expired') {
            // 即削除（未達整理）
            try {
              await remove(code, sub.endpoint);
              expired++;
              removedEndpoints.push(sub.endpoint);
            } catch {}
          } else if (cls.type === 'retry') {
            retry++;
          } else if (cls.type === 'unauthorized') {
            // グローバル鍵/subjectの問題 → 削除はしない
            authErrors.push({ endpoint: sub.endpoint, reason: cls.reason });
          } else {
            errors.push({ endpoint: sub.endpoint, reason: cls.reason });
          }
          return { ok:false, sub, cls };
        }
      })
    );

    // Promise.allSettled 自体のrejectを errors に集約
    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value?.ok) accepted++;
      } else {
        errors.push({ reason: String(r.reason).slice(0,300) });
      }
    }

    const remaining = await count(code);

    // レスポンスで整理結果を可視化（UIのログに出ます）
    return res.json({
      ok: true,
      attempted, accepted, expired, retry,
      remaining, skipped,
      removed: removedEndpoints.length,
      removedEndpoints, // 長い場合はUIで先頭数件だけ表示でもOK
      authErrors, errors
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e) });
  }
}
