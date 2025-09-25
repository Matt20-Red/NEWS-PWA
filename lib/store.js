// lib/store.js（Upstash/Serverless Redis 版）
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv(); // 自動で UPSTASH_REDIS_REST_URL / TOKEN を読む
const parse = v => (typeof v === 'string' ? JSON.parse(v) : v);

export async function list(code) {
  const key = `group:${code}`;
  const obj = await redis.hgetall(key);   // { endpoint: jsonString, ... } or null
  if (!obj) return [];
  return Object.values(obj).map(parse);
}

export async function add(code, sub) {
  const key = `group:${code}`;
  const field = sub.endpoint;
  const existed = await redis.hexists(key, field);
  await redis.hset(key, { [field]: JSON.stringify(sub) });
  return !existed; // 新規なら true
}

export async function remove(code, endpoint) {
  const key = `group:${code}`;
  return await redis.hdel(key, endpoint); // 削除した数（0/1）
}

export async function count(code) {
  const key = `group:${code}`;
  return (await redis.hlen(key)) || 0;
}

export async function count(code) {
  const key = `group:${code}`;
  return (await kv.hlen(key)) || 0;
}
