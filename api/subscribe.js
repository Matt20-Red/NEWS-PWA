// api/subscribe.js
import { webpush } from './_common.js';
import { add, count, list, remove } from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { code, subscription } = req.body || {};
  if (!code || !subscription?.endpoint) {
    return res.status(400).json({ ok: false, error: 'bad request' });
  }
  const existed = !add(code, subscription);
  const members = count(code);

  // 追加があった時のみ「購読申込あり」メッセージ & レポート配信
  if (!existed) {
    await notifyTo(code, {
      title: 'System',
      preview: `購読申込あり: "${code}" → 現在 ${members} 件`
    });
    await reportDelivery(code, {
      title: 'System',
      preview: `配信レポート（購読申込通知）`
    });
  }
  return res.json({ ok: true, members });
}

// ユーティリティ
async function notifyTo(code, payload) {
  const subs = list(code);
  const data = JSON.stringify(payload);
  for (const sub of subs) {
    try { await webpush.sendNotification(sub, data); }
    catch { /* 通知失敗はここでは無視（レポートで処理） */ }
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
      if (msg.includes('410') || msg.includes('404')) {
        expired += remove(code, sub.endpoint);
      } else if (msg.includes('429') || msg.includes('5')) {
        retry++;
      }
    }
  }
  const remaining = count(code);
  const summary = {
    title: 'System',
    preview:
      `Attempted:${attempted} / Accepted:${accepted} / Expired:${expired} / Retry:${retry} / Remaining:${remaining}`
  };
  // 成果も投げる（失効はすでに削除済み）
  const finalSubs = list(code);
  for (const sub of finalSubs) {
    try { await webpush.sendNotification(sub, JSON.stringify(summary)); } catch {}
  }
}
