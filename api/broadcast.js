
// api/broadcast.js
import { webpush } from './_common.js';
import { list, remove, count } from '../lib/store.js';

function detectService(endpoint = '') {
  if (endpoint.includes('fcm.googleapis.com')) return 'fcm';
  if (endpoint.includes('updates.push.services.mozilla.com')) return 'mozilla';
  if (endpoint.includes('api.push.apple.com')) return 'apple';
  if (endpoint.includes('notify.windows.com')) return 'wns';
  return 'unknown';
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();
    const { code, message } = req.body || {};
    if (!code || typeof message !== 'string') return res.status(400).json({ ok:false });

    const url = `/note#msg=${encodeURIComponent(message)}`;
    const payload = { title: ' ', preview: '開いて確認してください', url };

    const subs = [...await list(code)];
    let attempted = 0, accepted = 0, expired = 0, retry = 0;
    const errors = [];
    const skipped = [];

    for (const sub of subs) {
      const service = detectService(sub.endpoint);
      // WNS は一旦スキップ（web-push非対応のため）
      if (service === 'wns') {
        skipped.push({ endpoint: sub.endpoint, reason: 'wns-not-supported' });
        continue;
      }
      attempted++;
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
        accepted++;
      } catch (e) {
        const msg = String(e);
        if (msg.includes('410') || msg.includes('404')) {
          expired += await remove(code, sub.endpoint);
        } else if (msg.includes('429') || msg.match(/\b5\d\d\b/)) {
          retry++;
        }
        errors.push({ endpoint: sub.endpoint, service, error: msg.slice(0, 300) });
      }
    }

    const remaining = await count(code);

    // レポートも同報送信（レポート送信で落ちないよう try/catch）
    const report = {
      title: 'System',
      preview:
        `送信レポート → Attempted:${attempted} / Accepted:${accepted} / Expired:${expired} / Retry:${retry} / Remaining:${remaining} / Skipped(WNS):${skipped.length}`
    };
    for (const sub of await list(code)) {
      try { await webpush.sendNotification(sub, JSON.stringify(report)); } catch {}
    }

    return res.json({ ok:true, attempted, accepted, expired, retry, remaining, skipped, errors });
  } catch (e) {
    // 最後の砦：必ずJSONで返す
    return res.status(500).json({ ok:false, error: String(e) });
  }
}
