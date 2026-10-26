import { Redis } from '@upstash/redis';

// Works with the variable names Vercel's Upstash integration sets, or Upstash's own.
export function getDb() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export const COLLECTIONS = ['stock', 'kit', 'shop', 'products'];
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newCode() {
  let c = '';
  for (let i = 0; i < 8; i += 1) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}

export function cleanCode(code) {
  return String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

export const key = (code, part) => `hh:${code}:${part}`;
