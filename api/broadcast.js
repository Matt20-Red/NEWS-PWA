// api/broadcast.js
import { webpush } from './_common.js';
import { list, remove, count } from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { code, message } = req.body || {};
  if (!code || typeof message !== 'string') return res.status(400).json({ ok:false });

  // ⑦: フラグメントで渡すURL（note.htmlに表示 → 履歴から消す仕様）
  const url = `/note#msg=${encodeURIComponent(message)}`;
  const payload = { title: ' ', preview: '開いて確認してください', url }; // タイトルなし運用
  const subs = list(code).slice();

  let attempted = 0, accepted = 0, expired = 0, retry = 0;
  const errors = []; // ← 追加：エラー記録
  for (const sub of subs) {
    attempted++;
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      accepted++;
    } catch (e) {
      const msg = String(e);
      if (msg.includes('410') || msg.includes('404')) {
        expired += remove(code, sub.endpoint);
      } else if (msg.includes('429') || msg.includes('5')) {
        retry++;
      }
      errors.push({ endpoint: sub.endpoint, error: msg.slice(0, 300) }); // ← 追記
    }
  }
  const remaining = count(code);

  // ⑤⑥: レポートも同報送信
  const report = {
    title: 'System',
    preview: `送信レポート → Attempted:${attempted} / Accepted:${accepted} / Expired:${expired} / Retry:${retry} / Remaining:${remaining}`
  };
  for (const sub of list(code)) {
    try { await webpush.sendNotification(sub, JSON.stringify(report)); } catch {}
  }

  //return res.json({ ok:true, attempted, accepted, expired, retry, remaining });
  return res.json({ ok:true, attempted, accepted, expired, retry, remaining, errors });
}
