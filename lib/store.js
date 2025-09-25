// lib/store.js
// 学習用：Vercelのサーバレスはインスタンスごとでメモリが揮発します。
// 本運用はここを Vercel KV などに差し替えてください。

const groups = new Map(); // code -> [subscription]

export function list(code) {
  return groups.get(code) || [];
}

export function add(code, sub) {
  const arr = groups.get(code) || [];
  if (!arr.some(s => s.endpoint === sub.endpoint)) {
    arr.push(sub);
    groups.set(code, arr);
    return true; // added
  }
  return false; // already existed
}

export function remove(code, endpoint) {
  const arr = groups.get(code) || [];
  const next = arr.filter(s => s.endpoint !== endpoint);
  if (next.length) groups.set(code, next);
  else groups.delete(code);
  return arr.length - next.length; // removed count
}

export function count(code) {
  return list(code).length;
}
