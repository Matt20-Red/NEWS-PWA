// lib/store.js（node-redis 版）
import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL,
});

client.on('error', (err) => console.error('Redis Client Error', err));

let connected = false;
async function connectOnce() {
  if (!connected) {
    await client.connect();
    connected = true;
  }
}

const parse = v => (typeof v === 'string' ? JSON.parse(v) : v);

export async function list(code) {
  await connectOnce();
  const key = `group:${code}`;
  const obj = await client.hGetAll(key); // { endpoint: jsonString, ... } or {}
  return Object.values(obj).map(parse);
}

export async function add(code, sub) {
  await connectOnce();
  const key = `group:${code}`;
  const field = sub.endpoint;
  const exists = await client.hExists(key, field);
  await client.hSet(key, field, JSON.stringify(sub));
  return !exists;
}

export async function remove(code, endpoint) {
  await connectOnce();
  const key = `group:${code}`;
  return await client.hDel(key, endpoint); // 削除した数（0/1）
}

export async function count(code) {
  await connectOnce();
  const key = `group:${code}`;
  return (await client.hLen(key)) || 0;
}

