import { count, list } from '../lib/store.js';

export default async function handler(req, res) {
  const code = (req.query.code || req.body?.code || '').toString();
  if (!code) return res.status(400).json({ ok:false, error:'code required' });
  const n = await count(code);
  res.json({ ok:true, code, members:n });
}
