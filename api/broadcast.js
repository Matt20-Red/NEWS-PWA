import { webpush } from './_common.js';
import { list, remove, count } from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { code, message } = req.body || {};
  if (!code || typeof message !== 'string') return res.status(400).json({ ok:false });

  const url = `/note#msg=${encodeURIComponent(message)}`;
  const payload = { title: ' ', preview: '開いて確認してください', url };

  const subs = [...await list(code)];            // ★ await
  let attempted = 0, accepted = 0, expired = 0, retry = 0;
  const errors = [];

  for (const sub of subs) {
    attempted++;
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      accepted++;
    } catch (e) {
      const msg = String(e);
      if (msg.includes('410') || msg.includes('404')) {
        expired += await remove(code, sub.endpoint);   // ★ await
      } else if (msg.includes('429') || msg.includes('5')) {
        retry++;
      }
      errors.push({ endpoint: sub.endpoint, error: msg.slice(0, 300) });
    }
  }
  const remaining = await count(code);           // ★ await

  // レポートも同報送信
  const report = {
    title: 'System',
    preview: `送信レポート → Attempted:${attempted} / Accepted:${accepted} / Expired:${expired} / Retry:${retry} / Remaining:${remaining}`
  };
  for (const sub of await list(code)) {          // ★ await
    try { await webpush.sendNotification(sub, JSON.stringify(report)); } catch {}
  }

  return res.json({ ok:true, attempted, accepted, expired, retry, remaining, errors });
}

