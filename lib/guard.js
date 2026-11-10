// Keeping the app to invited people, and stopping anyone hammering it.
import { cleanCode, getDb, key } from './db';

const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// YESCHEF_INVITE_CODE in Vercel: one code, or several separated by commas. Not set = open, as before.
export function inviteCodes() {
  return String(process.env.YESCHEF_INVITE_CODE || '')
    .split(',')
    .map(norm)
    .filter(Boolean);
}

export const inviteRequired = () => inviteCodes().length > 0;
export const inviteMatches = (code) => inviteCodes().includes(norm(code));

export function clientId(req) {
  const fwd = req.headers.get('x-forwarded-for') || '';
  return (fwd.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim().slice(0, 64);
}

// Counts requests in a time window; true while under the limit. Without a database, everything is allowed.
export async function underLimit(db, bucket, id, max, windowSec) {
  if (!db) return true;
  const k = `yc:rl:${bucket}:${id}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  const n = await db.incr(k);
  if (n === 1) await db.expire(k, windowSec + 60);
  return n <= max;
}

// Has this phone got access? A matching invite code, or membership of a real household, both count.
export async function hasAccess(req, db) {
  if (!inviteRequired()) return true;
  if (inviteMatches(req.headers.get('x-yc-access'))) return true;
  const hh = cleanCode(req.headers.get('x-yc-household'));
  if (hh && db && (await db.get(key(hh, 'meta')))) return true;
  return false;
}

export const accessResponse = () =>
  Response.json({ error: 'access', message: 'Yes Chef! is invite-only while we test. Enter your invite code to carry on.' }, { status: 403 });

export const slowDownResponse = () =>
  Response.json({ error: 'busy', message: 'That’s a lot of requests in a short time. Give it a few minutes and try again.' }, { status: 429 });

// For the AI routes: check access, then the hourly allowance for this phone.
export async function guardAi(req, perHour = 150) {
  const db = getDb();
  if (!(await hasAccess(req, db))) return accessResponse();
  if (!(await underLimit(db, 'ai', clientId(req), perHour, 3600))) return slowDownResponse();
  return null;
}
