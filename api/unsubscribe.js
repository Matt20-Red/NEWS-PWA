// api/unsubscribe.js
import { webpush } from './_common.js';
import { remove, count, list } from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { code, endpoint } = req.body || {};
  if (!code || !endpoint) return res.status(400).json({ ok: false });

  const removed = remove(code, endpoint);
  const members = count(code);

  if (removed > 0) {
    await notifyTo(code, {
      title: 'System',
      preview: `購読削除あり: "${code}" → 現在 ${members} 件`
    });
    await reportDelivery(code, {
      title: 'System',
      preview: `配信レポート（購読削除通知）`
    });
  }
  return res.json({ ok: true, members, removed });
}

async function notifyTo(code, payload) {
  const subs = list(code);
  const data = JSON.stringify(payload);
  for (const sub of subs) {
    try { await webpush.sendNotification(sub, data); } catch {}
  }
}
async function reportDelivery(code, headPayload) {
  const subs = list(code).slice();
  let attempted = 0, accepted = 0, expired = 0, retry = 0;
  for (const sub of subs) {
    attempted++;
    try {
      await webpush.sendNotification(sub, JSON.stringify(headPayload));
      accepted++;
    } catch (e) {
      const msg = String(e);
      if (msg.includes('410') || msg.includes('404')) expired++;
      else if (msg.includes('429') || msg.includes('5')) retry++;
    }
  }
  const remaining = count(code);
  const summary = {
    title: 'System',
    preview:
      `Attempted:${attempted} / Accepted:${accepted} / Expired:${expired} / Retry:${retry} / Remaining:${remaining}`
  };
  for (const sub of list(code)) {
    try { await webpush.sendNotification(sub, JSON.stringify(summary)); } catch {}
  }
}
