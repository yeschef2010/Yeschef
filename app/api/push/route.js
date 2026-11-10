import { cleanCode, getDb, key } from '@/lib/db';
import { PUSH_HOUSEHOLDS, subsKey, vapid } from '@/lib/push';

export const dynamic = 'force-dynamic';

const noDb = () => Response.json({ error: 'no_storage', message: 'Reminders need the household database. Add Upstash Redis in Vercel.' }, { status: 503 });

// The public key phones need to sign up for reminders.
export async function GET() {
  const db = getDb();
  if (!db) return noDb();
  const { publicKey } = await vapid(db);
  return Response.json({ publicKey });
}

// A phone signs up: remember it against the household so everyone in it gets the reminders.
export async function POST(req) {
  const db = getDb();
  if (!db) return noDb();
  const body = await req.json().catch(() => ({}));
  const code = cleanCode(body.code);
  const sub = body.subscription;
  if (!code || !(await db.get(key(code, 'meta')))) return Response.json({ error: 'not_found', message: 'Set up a household first.' }, { status: 404 });
  if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys) return Response.json({ error: 'bad_request' }, { status: 400 });
  const subs = ((await db.get(subsKey(code))) || []).filter((s) => s.subscription.endpoint !== sub.endpoint).slice(-20);
  subs.push({ subscription: { endpoint: sub.endpoint, keys: { p256dh: String(sub.keys.p256dh || ''), auth: String(sub.keys.auth || '') } }, at: Date.now() });
  await db.set(subsKey(code), subs);
  await db.sadd(PUSH_HOUSEHOLDS, code);
  return Response.json({ ok: true, phones: subs.length });
}

// A phone turns reminders off.
export async function DELETE(req) {
  const db = getDb();
  if (!db) return noDb();
  const body = await req.json().catch(() => ({}));
  const code = cleanCode(body.code);
  if (!code) return Response.json({ ok: true });
  const subs = ((await db.get(subsKey(code))) || []).filter((s) => s.subscription.endpoint !== body.endpoint);
  await db.set(subsKey(code), subs);
  return Response.json({ ok: true });
}
