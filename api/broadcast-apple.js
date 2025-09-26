import { webpush } from './_common.js';
import { list } from '../lib/store.js';

export default async function handler(req,res){
  try {
    if (req.method !== 'POST') return res.status(405).end();
    const { code, message } = req.body || {};
    if (!code || typeof message !== 'string') return res.status(400).json({ ok:false });

    const subs = (await list(code)).filter(s => s.endpoint.includes('api.push.apple.com'));
    const payload = JSON.stringify({ title:'通知', body:message || '', url:`/note#msg=${encodeURIComponent(message||'')}` });

    let attempted=0, accepted=0; const errors=[];
    await Promise.allSettled(subs.map(async s=>{
      attempted++;
      try {
        await webpush.sendNotification(s, payload, { TTL:60, urgency:'high' });
        accepted++;
      } catch(e) {
        errors.push(String(e).slice(0,300));
      }
    }));
    return res.json({ ok:true, attempted, accepted, errors });
  } catch(e) {
    return res.status(500).json({ ok:false, error:String(e) });
  }
}
