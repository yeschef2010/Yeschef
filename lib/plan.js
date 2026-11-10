// Planning the week: which nights, what each dinner needs from the freezer, and what to buy.
import { addAmounts, formatAmount, parseQty, sameThing, subtractAmounts, totalOf } from './amounts';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fromIso = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const dayShort = (iso) => DAY[fromIso(iso).getDay()];
export const dayLong = (iso) => DAY_LONG[fromIso(iso).getDay()];

// The next five weeknights: from tonight (if it's a weekday and dinner's not done) or from Monday.
export function weeknights(now = new Date(), count = 5) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const late = now.getHours() * 60 + now.getMinutes() >= 20 * 60 + 30;
  if (late) d.setDate(d.getDate() + 1);
  const out = [];
  while (out.length < count) {
    const wd = d.getDay();
    if (wd >= 1 && wd <= 5) out.push(isoDate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export const eatersText = (e) => (e ? `${e.adults} adult${e.adults === 1 ? '' : 's'}${e.kids ? `, ${e.kids} kid${e.kids === 1 ? '' : 's'}` : ''}` : '');

const BIG = /\b(whole|joint|leg of|shoulder|crown|turkey|brisket|gammon|rib of|ribs?|topside|silverside|pork belly)\b/i;

// What a night's recipe needs out of the freezer. "big" things need a day in the fridge, so they get an evening reminder.
export function defrostFor(recipe, stock) {
  const out = [];
  for (const ing of recipe.ingredients || []) {
    const want = String(ing.stockName || ing.name || '').toLowerCase();
    if (!want) continue;
    const item = stock.find((s) => s.area === 'Freezer' && (s.name.toLowerCase() === want || sameThing(s.name, want)));
    if (!item || out.some((o) => o.name === item.name)) continue;
    const use = parseQty(ing.use);
    const heavy = use && use.unit === 'g' && use.n >= 1500;
    out.push({ name: item.name, big: BIG.test(item.name) || !!heavy });
  }
  return out;
}

// Stock that upcoming planned dinners are counting on, so everyday ideas leave it alone: name → "Thu's dinner".
export function savedFor(plan, todayIso) {
  const saved = new Map();
  for (const n of plan) {
    if (!n.idea || n.cooked || n.date < todayIso) continue;
    for (const ing of n.idea.ingredients || []) {
      const k = String(ing.stockName || '').toLowerCase();
      if (!k) continue;
      const label = `${dayShort(n.date)}'s dinner`;
      saved.set(k, saved.has(k) ? `${saved.get(k)} and ${label}` : label);
    }
  }
  return saved;
}

// Everything the week still needs to buy: things not in stock, plus the shortfall on things we have too little of.
export function weekNeeds(nights, stock) {
  const needs = [];
  const add = (name, amount, day) => {
    const hit = needs.find((n) => sameThing(n.name, name));
    if (!hit) return needs.push({ name, amounts: [amount].filter(Boolean), nights: [day] });
    if (amount) hit.amounts.push(amount);
    if (!hit.nights.includes(day)) hit.nights.push(day);
  };
  const usedOf = new Map();
  for (const n of nights) {
    if (!n.idea || n.cooked) continue;
    const day = dayShort(n.date);
    for (const ing of n.idea.ingredients || []) {
      if (/^(salt|pepper|black pepper|water|oil|olive oil|vegetable oil|sunflower oil)$/i.test(String(ing.name).trim())) continue;
      if (!ing.inStock && !ing.stockName) {
        add(ing.name, ing.amount, day);
        continue;
      }
      const item = stock.find((s) => s.name.toLowerCase() === String(ing.stockName || ing.name).toLowerCase());
      const use = parseQty(ing.use);
      if (!item || !use) continue;
      const prev = usedOf.get(item.id);
      usedOf.set(item.id, { item, total: prev ? addAmounts(prev.total, use) || prev.total : use, nights: [...new Set([...(prev ? prev.nights : []), day])] });
    }
  }
  for (const { item, total, nights: days } of usedOf.values()) {
    const have = totalOf(item);
    if (!have || !total) continue;
    const short = subtractAmounts(total, have);
    if (short && short.n > 0) needs.push({ name: item.name, amounts: [`${formatAmount(short)} more`], nights: days, area: item.area, category: item.category });
  }
  return needs.map((n) => ({ ...n, amount: n.amounts.join(' + ') }));
}
