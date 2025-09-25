// node-redis 自己診断
import { createClient } from 'redis';

export default async function handler(req, res) {
  const url = process.env.REDIS_URL || '';
  const client = createClient({ url });
  client.on('error', (err) => console.error('Redis Error:', err));

  try {
    await client.connect();
    const key = 'selftest:last';
    const now = Date.now().toString();
    await client.set(key, now, { EX: 60 });
    const back = await client.get(key);
    await client.quit();
    res.json({ ok: true, urlScheme: url.split(':')[0], wrote: now, read: back });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e), urlScheme: url.split(':')[0] });
  }
}
