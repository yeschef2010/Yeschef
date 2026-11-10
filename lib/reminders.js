// What reminders a household should get right now, from its plan. Pure logic, so it's easy to test.
// kind: 'morning' (about 8am) or 'evening' (about 8pm). `london` is the UK local date/time.

const lower = (s) => String(s || '').toLowerCase();
const dish = (s) => String(s || '').replace(/^./, (c) => c.toLowerCase());
const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function londonNow(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const iso = `${parts.year}-${parts.month}-${parts.day}`;
  return { iso, hour: Number(parts.hour) % 24, weekday: parts.weekday }; // weekday: 'Sun', 'Mon', …
}

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

// The cron jobs run twice around each time (Vercel's free plan is only accurate to the hour, and the
// clocks change), so each reminder goes out once, in this window of UK hours.
export const WINDOWS = { morning: [8, 9], evening: [20, 21] };
export const inWindow = (kind, hour) => hour >= WINDOWS[kind][0] && hour <= WINDOWS[kind][1];

export function remindersFor(plan = [], kind, london) {
  const out = [];
  const nightOn = (iso) => plan.find((n) => n && n.date === iso && n.idea && !n.off && !n.cooked);

  if (kind === 'morning') {
    const tonight = nightOn(london.iso);
    const items = tonight ? (tonight.defrost || []).filter((d) => !d.big).map((d) => lower(d.name)) : [];
    if (items.length) {
      out.push({
        tag: `thaw-am-${london.iso}`,
        title: 'Freezer reminder',
        body: `Get the ${list(items)} out of the freezer for tonight’s ${dish(tonight.idea.title)}.`,
        url: '/?go=home',
      });
    }
  }

  if (kind === 'evening') {
    const tomorrow = nightOn(addDays(london.iso, 1));
    const big = tomorrow ? (tomorrow.defrost || []).filter((d) => d.big).map((d) => lower(d.name)) : [];
    if (big.length) {
      out.push({
        tag: `thaw-pm-${addDays(london.iso, 1)}`,
        title: 'Freezer reminder',
        body: `Take the ${list(big)} out of the freezer tonight and pop it in the fridge for tomorrow’s ${dish(tomorrow.idea.title)}.`,
        url: '/?go=plan',
      });
    }
    if (london.weekday === 'Sun') {
      const monday = addDays(london.iso, 1);
      const planned = plan.some((n) => n && n.date === monday && n.idea);
      if (!planned) {
        out.push({ tag: `plan-${monday}`, title: 'Want to plan the week?', body: 'Pick your weeknight dinners and I’ll do the shopping list.', url: '/?go=plan' });
      }
    }
  }
  return out;
}
