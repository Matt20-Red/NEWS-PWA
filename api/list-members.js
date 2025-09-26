import { list } from '../lib/store.js';

function detect(endpoint='') {
  if (endpoint.includes('api.push.apple.com')) return 'apple';
  if (endpoint.includes('fcm.googleapis.com')) return 'fcm';
  if (endpoint.includes('updates.push.services.mozilla.com')) return 'mozilla';
  if (endpoint.includes('notify.windows.com')) return 'wns';
  return 'unknown';
}

export default async function handler(req,res){
  const code = (req.query.code || req.body?.code || '').toString();
  if (!code) return res.status(400).json({ ok:false, error:'code required' });
  const subs = await list(code);
  const by = { apple:0, fcm:0, mozilla:0, wns:0, unknown:0 };
  const sample = [];
  for (const s of subs) {
    const k = detect(s.endpoint);
    by[k] = (by[k]||0)+1;
    if (sample.length < 10) sample.push({ service:k, endpoint:s.endpoint.slice(0,80)+'...' });
  }
  res.json({ ok:true, total: subs.length, by, sample });
}
