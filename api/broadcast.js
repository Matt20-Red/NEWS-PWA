// api/broadcast.js (fast & timeout)
import { webpush } from './_common.js';
import { list, remove, count } from '../lib/store.js';

function detectService(endpoint = '') {
  if (endpoint.includes('fcm.googleapis.com')) return 'fcm';
  if (endpoint.includes('updates.push.services.mozilla.com')) return 'mozilla';
  if (endpoint.includes('api.push.apple.com')) return 'apple';
  if (endpoint.includes('notify.windows.com')) return 'wns';
  return 'unknown';
}

// web-push にタイムアウトを付ける
function sendWithTimeout(sub, payload, ms = 3000) {
  return Promise.race([
    webpush.sendNotification(sub, payload),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();
    const { code, message } = req.body || {};
    if (!code || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ ok:false, error: 'bad request' });
    }

    const url = `/note#msg=${encodeURIComponent(message)}`;
    const payload = JSON.stringify({ title: ' ', preview: '開いて確認してください', url });

    const subsAll = await list(code);
    const targets = subsAll.filter(s => detectService(s.endpoint) !== 'wns'); // WNS除外
    let attempted = 0, accepted = 0, expired = 0, retry = 0;
    const errors = [];
    const skipped = subsAll.length - targets.length;

    // 並列で一気に送る（各3秒タイムアウト）
    const results = await Promise.allSettled(
      targets.map(async (sub) => {
        attempted++;
        try {
          await sendWithTimeout(sub, payload, 3000);
          return { ok:true, sub };
        } catch (e) {
          const msg = String(e);
          if (msg.includes('410') || msg.includes('404')) {
            // 失効 → 削除
            await remove(code, sub.endpoint);
            return { ok:false, sub, type:'expired', error: msg };
          } else if (msg.includes('429') || /\b5\d\d\b/.test(msg)) {
            return { ok:false, sub, type:'retry', error: msg };
          } else {
            return { ok:false, sub, type:'other', error: msg };
          }
        }
      })
    );

    // 集計
    for (const r of results) {
      if (r.status === 'fulfilled') { accepted++; }
      else if (r.reason) { errors.push({ error: String(r.reason).slice(0,300) }); }
      else if (r.value) {
        const v = r.value;
        if (!v.ok) {
          if (v.type === 'expired') expired++;
          else if (v.type === 'retry') retry++;
          errors.push({ endpoint: v.sub.endpoint, error: v.error.slice(0,300) });
        }
      }
    }

    const remaining = await count(code);
    return res.json({ ok:true, attempted, accepted, expired, retry, remaining, skipped, errors });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e) });
  }
}

