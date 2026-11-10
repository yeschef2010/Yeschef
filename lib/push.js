// Phone notifications (web push). The security keys are made once and kept in the database,
// so there's nothing to set up in Vercel.
import webpush from 'web-push';
import { key } from './db';

const VAPID_KEY = 'yc:vapid';
export const PUSH_HOUSEHOLDS = 'yc:push-households';

export async function vapid(db) {
  let keys = await db.get(VAPID_KEY);
  if (!keys || !keys.publicKey) {
    keys = webpush.generateVAPIDKeys();
    // Only keep ours if nobody else made a pair at the same moment.
    const ok = await db.set(VAPID_KEY, keys, { nx: true });
    if (!ok) keys = await db.get(VAPID_KEY);
  }
  return keys;
}

export const subsKey = (code) => key(code, 'push');

// Send one message to every phone in a household. Phones that have unsubscribed are tidied away.
export async function sendToHousehold(db, code, message) {
  const keys = await vapid(db);
  webpush.setVapidDetails('mailto:hello@yeschef.app', keys.publicKey, keys.privateKey);
  const subs = (await db.get(subsKey(code))) || [];
  let sent = 0;
  const keep = [];
  for (const s of subs) {
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify(message), { TTL: 6 * 3600, urgency: 'normal', topic: String(message.tag || 'yeschef').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) });
      sent += 1;
      keep.push(s);
    } catch (e) {
      console.error('[yes-chef] push failed:', e && e.statusCode, e && (e.body || e.message));
      if (e && (e.statusCode === 404 || e.statusCode === 410)) continue; // gone for good
      keep.push(s);
    }
  }
  if (keep.length !== subs.length) await db.set(subsKey(code), keep);
  return sent;
}
