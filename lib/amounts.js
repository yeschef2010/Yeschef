// Amounts the app can do maths with: { n, unit, word? }
// unit is 'g', 'ml' or 'each'. word names what's being counted ("tins", "eggs") for 'each'.

const PINT = 568;

const UNIT_MAP = {
  g: ['g', 1], gram: ['g', 1], grams: ['g', 1], gr: ['g', 1],
  kg: ['g', 1000], kilo: ['g', 1000], kilos: ['g', 1000], kgs: ['g', 1000],
  ml: ['ml', 1], millilitre: ['ml', 1], millilitres: ['ml', 1],
  cl: ['ml', 10],
  l: ['ml', 1000], ltr: ['ml', 1000], litre: ['ml', 1000], litres: ['ml', 1000], liter: ['ml', 1000], liters: ['ml', 1000],
  pint: ['ml', PINT], pints: ['ml', PINT], pt: ['ml', PINT],
  each: ['each', 1],
};

const round = (n) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10);

// Clean whatever the AI (or a person) gave us into { n, unit, word } or null.
export function normAmount(a) {
  if (!a || typeof a !== 'object') return null;
  const n = Number(a.n);
  if (!Number.isFinite(n) || n < 0) return null;
  const u = String(a.unit || '').toLowerCase().trim();
  const hit = UNIT_MAP[u];
  if (!hit) {
    // Anything else is a count: "tins", "eggs", "bottles".
    if (!u) return null;
    return { n: round(n), unit: 'each', word: u };
  }
  const out = { n: round(n * hit[1]), unit: hit[0] };
  // Remember milk was counted in pints, so it stays in pints after a splash is taken off.
  if (hit[0] === 'ml' && (a.pints || /^(pint|pints|pt)$/.test(u))) out.pints = true;
  if (hit[0] === 'each' && a.word) out.word = String(a.word).toLowerCase().trim();
  return out;
}

// Best-effort reading of everyday text: "500g", "2 x 1kg", "2 pints", "1.5L", "6 eggs", "3 tins", "6".
export function parseQty(text) {
  if (text == null) return null;
  if (typeof text === 'object') return normAmount(text);
  const t = String(text).toLowerCase().replace(/,/g, '').trim();
  if (!t) return null;
  let m = t.match(/^(\d+(?:\.\d+)?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)\s*([a-z]+)\b/);
  if (m && UNIT_MAP[m[3]]) return normAmount({ n: Number(m[1]) * Number(m[2]), unit: m[3] });
  m = t.match(/^(?:about\s+|around\s+|roughly\s+)?(\d+(?:\.\d+)?)\s*([a-z]+)?\b/);
  if (!m) {
    if (/^(a|an|one)\s+(tin|can|jar|bottle|bag|box|pack|packet|loaf|carton)\b/.test(t)) return { n: 1, unit: 'each', word: t.split(/\s+/)[1] + 's' };
    return null;
  }
  const n = Number(m[1]);
  const w = m[2];
  if (!w) return { n, unit: 'each' };
  if (UNIT_MAP[w]) return normAmount({ n, unit: w });
  // "2 tins", "6 eggs", "1 bag": a count. Words like "bag" don't tell us a weight, but the count still helps.
  if (/^(x|half|quarter)$/.test(w)) return null;
  return { n, unit: 'each', word: n === 1 && !w.endsWith('s') ? `${w}s` : w };
}

function plural(word, n) {
  if (!word) return '';
  if (n === 1) return word.replace(/(ches|shes|oes)$/, (s) => s.slice(0, -2)).replace(/ies$/, 'y').replace(/s$/, '');
  return word;
}

// "like" keeps the same style as another amount: 9 pints take away a splash is "8.9 pints", not "5.1 L".
export function formatAmount(a, like) {
  const x = normAmount(a) || (a && a.unit === 'each' ? a : null);
  if (!x) return '';
  const { n, unit, word } = x;
  const l = like ? parseQty(like) : null;
  const pintish = x.pints || (l && l.unit === 'ml' && (l.pints || (l.n >= PINT && Math.abs(l.n / PINT - Math.round(l.n / PINT)) < 0.03)));
  if (unit === 'ml' && pintish && n >= PINT / 2) {
    const p = Math.round((n / PINT) * 10) / 10;
    return `${p} pint${p === 1 ? '' : 's'}`;
  }
  if (unit === 'g') return n >= 1000 ? `${round(n / 1000)} kg` : `${Math.round(n)} g`;
  if (unit === 'ml') {
    const pints = n / PINT;
    if (n >= PINT && Math.abs(pints - Math.round(pints)) < 0.03) {
      const p = Math.round(pints);
      return `${p} pint${p === 1 ? '' : 's'}`;
    }
    return n >= 1000 ? `${round(n / 1000)} L` : `${Math.round(n)} ml`;
  }
  const count = Number.isInteger(n) ? n : round(n);
  return word ? `${count} ${plural(word, count)}` : String(count);
}

export function sameUnit(a, b) {
  return !!(a && b && a.unit === b.unit);
}

export function addAmounts(a, b) {
  const x = parseQty(a);
  const y = parseQty(b);
  if (!x || !y || !sameUnit(x, y)) return null;
  return { n: round(x.n + y.n), unit: x.unit, ...(x.word || y.word ? { word: x.word || y.word } : {}), ...(x.pints || y.pints ? { pints: true } : {}) };
}

export function subtractAmounts(a, b) {
  const x = parseQty(a);
  const y = parseQty(b);
  if (!x || !y || !sameUnit(x, y)) return null;
  return { ...x, n: Math.max(0, round(x.n - y.n)) };
}

// Total across an item's locations, when every location has a number in the same unit.
export function totalOf(item) {
  const vals = Object.values(item.locations || { main: item.qty });
  if (!vals.length) return parseQty(item.qty);
  let total = null;
  for (const v of vals) {
    const a = parseQty(v);
    if (!a) return null;
    total = total ? addAmounts(total, a) : a;
    if (!total) return null;
  }
  return total;
}

// Take an amount off an item, starting with things stored away from home (the chilled one, the defrosting one).
// Returns the new locations, or null if the maths can't be done.
export function takeFrom(item, use) {
  const u = parseQty(use);
  if (!u) return null;
  const locs = { ...(item.locations || { main: item.qty }) };
  const keys = Object.keys(locs).sort((a, b) => (a === 'main') - (b === 'main'));
  let left = u.n;
  for (const k of keys) {
    const have = parseQty(locs[k]);
    if (!have || !sameUnit(have, u)) return null;
    const take = Math.min(have.n, left);
    left = round(left - take);
    const rest = round(have.n - take);
    if (rest <= 0) delete locs[k];
    else locs[k] = { ...have, n: rest };
    if (left <= 0) break;
  }
  return locs;
}

// Loose name matching so "Semi-skimmed milk" on a receipt finds "Milk" in the fridge.
export function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 ? w.replace(/(ies)$/, 'y').replace(/(oes|ches|shes)$/, (x) => x.slice(0, -2)).replace(/s$/, '') : w))
    .join(' ');
}

export function findSame(list, item) {
  const n = normName(item.name);
  const exact = list.findIndex((x) => x.area === item.area && normName(x.name) === n);
  if (exact >= 0) return exact;
  // One name is the other plus only describing words ("Milk" / "Semi skimmed milk", "Eggs" / "Free range eggs").
  const words = n.split(' ');
  return list.findIndex((x) => {
    if (x.area !== item.area) return false;
    const xw = normName(x.name).split(' ');
    const [small, big] = xw.length <= words.length ? [xw, words] : [words, xw];
    if (!small.length || !small.every((w) => big.includes(w))) return false;
    return big.filter((w) => !small.includes(w)).every((w) => DESCRIBERS.has(w));
  });
}

// Same food, allowing only describing words to differ ("Milk" = "Semi skimmed milk", but not "Coconut milk").
export function sameThing(a, b) {
  const x = normName(a).split(' ').filter(Boolean);
  const y = normName(b).split(' ').filter(Boolean);
  if (!x.length || !y.length) return false;
  const [small, big] = x.length <= y.length ? [x, y] : [y, x];
  if (!small.every((w) => big.includes(w))) return false;
  return big.filter((w) => !small.includes(w)).every((w) => DESCRIBERS.has(w));
}

const DESCRIBERS = new Set(
  'semi skimmed skim whole full fat free low reduced range organic british fresh large small medium big mini natural plain unsalted salted smoked unsmoked lean extra mature mild sliced unsliced own brand tesco sainsbury sainsburys asda aldi lidl waitrose morrison morrisons finest essential value pack x'.split(' ')
);
