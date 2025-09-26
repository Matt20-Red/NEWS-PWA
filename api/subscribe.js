import { add, count } from '../lib/store.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();
    const { code, subscription } = req.body || {};
    if (!code || !subscription?.endpoint) {
      return res.status(400).json({ ok: false, error: 'bad request' });
    }
    const added = await add(code, subscription);
    const members = await count(code);
    return res.json({ ok: true, added, members });
  } catch (e) {
    console.error('subscribe error:', e);
    return res.status(500).json({ ok:false, error: String(e) });
  }
}
