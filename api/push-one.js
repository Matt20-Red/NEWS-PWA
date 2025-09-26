// /api/push-one.js
import { webpush } from './_common.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();
    const { message, subscription } = req.body || {};
    if (!subscription?.endpoint || typeof message !== 'string') {
      return res.status(400).json({ ok:false, error:'bad request' });
    }
    const payload = JSON.stringify({
      title: '通知',
      body: message || 'テスト',
      url: `/note#msg=${encodeURIComponent(message || 'テスト')}`
    });

    // TTL/Urgency を明示（iOS向け）
    await webpush.sendNotification(subscription, payload, { TTL:60, urgency:'high' });
    return res.json({ ok:true });
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e) });
  }
}
