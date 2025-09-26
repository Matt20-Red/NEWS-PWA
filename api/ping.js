// /api/ping.js
export default async function handler(req, res) {
  res.json({ ok: true, now: Date.now() });
}
