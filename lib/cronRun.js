import { getDb, key } from './db';
import { PUSH_HOUSEHOLDS, sendToHousehold } from './push';
import { inWindow, londonNow, remindersFor } from './reminders';

// Shared by the morning and evening jobs: work out each household's reminders and send them once.
export async function runReminders(req, kind) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'unauthorised' }, { status: 401 });
  const db = getDb();
  if (!db) return Response.json({ skipped: 'no database' });
  const london = londonNow();
  if (!inWindow(kind, london.hour)) return Response.json({ skipped: `not ${kind} in the UK (${london.hour}:00)` });

  const codes = (await db.smembers(PUSH_HOUSEHOLDS)) || [];
  let sent = 0;
  for (const code of codes) {
    const plan = (await db.get(key(code, 'plan'))) || [];
    for (const m of remindersFor(plan, kind, london)) {
      // Each reminder once per household, however many times the job runs.
      const first = await db.set(`yc:sent:${code}:${m.tag}`, 1, { nx: true, ex: 3 * 86400 });
      if (!first) continue;
      sent += await sendToHousehold(db, code, m);
    }
  }
  return Response.json({ kind, london, households: codes.length, sent });
}
