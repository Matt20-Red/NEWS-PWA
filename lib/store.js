// lib/store.js（KV版）
import { kv } from '@vercel/kv';

// 文字列⇄オブジェクト
const parse = v => (typeof v === 'string' ? JSON.parse(v) : v);

export async function list(code) {
  const key = `group:${code}`;
  const obj = await kv.hgetall(key);        // { endpoint: jsonString, ... }
  if (!obj) return [];
  return Object.values(obj).map(parse);
}

export async function add(code, sub) {
  const key = `group:${code}`;
  const field = sub.endpoint;
  const existed = await kv.hexists(key, field);
  await kv.hset(key, { [field]: JSON.stringify(sub) });
  return !existed; // 新規追加ならtrue
}

export async function remove(code, endpoint) {
  const key = `group:${code}`;
  // 削除できたフィールド数を返す（0 or 1）
  return await kv.hdel(key, endpoint);
}

export async function count(code) {
  const key = `group:${code}`;
  return (await kv.hlen(key)) || 0;
}
