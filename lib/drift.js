// Everyday things get used without a recipe (milk in tea, toast, a banana on the school run).
// We estimate how much is left from when it was last counted, so the kitchen doesn't drift from reality.
// Nothing here changes what's stored; it's a best guess for display, running low and the quick check.
import { formatAmount, totalOf } from './amounts';
import { portions } from './servings';

// How much one portion (an adult) typically gets through in a day, by unit.
const RULES = [
  { re: /\b(milk)\b/i, not: /coconut milk|condensed|evaporated|powder/i, ml: 200 },
  { re: /\b(bread|loaf|sourdough|bloomer)\b/i, not: /crumbs|naan|pitta|flat/i, g: 55, each: 1 / 14 },
  { re: /\b(rolls?|bagels?|crumpets?|muffins?|croissants?)\b/i, each: 0.35 },
  { re: /\beggs?\b/i, not: /easter|chocolate|noodle/i, each: 0.3 },
  { re: /\b(bananas?|apples?|oranges?|satsumas?|clementines?|easy peelers?|pears?|nectarines?|peaches?|kiwis?)\b/i, not: /juice|sauce|cider|vinegar/i, each: 0.45, g: 70 },
  { re: /\b(grapes|berries|blueberries|raspberries|strawberries)\b/i, g: 40 },
  { re: /\b(yogh?urts?)\b/i, g: 45, each: 0.35 },
  { re: /\b(juice)\b/i, not: /lemon juice|lime juice/i, ml: 80 },
  { re: /\b(butter|spread|flora|lurpak)\b/i, not: /peanut|almond|nut/i, g: 7 },
  { re: /\b(cereal|cornflakes|granola|muesli|porridge|weetabix|shreddies|cheerios|rice krispies)\b/i, g: 30, each: 0.4 },
  { re: /\b(tea ?bags|tea)\b/i, not: /teacake|green tea|herbal/i, each: 1.5 },
  { re: /\b(cheddar|cheese)\b/i, not: /cream cheese|parmesan|feta|halloumi|mozzarella|ricotta/i, g: 10 },
];

const ruleFor = (name) => RULES.find((r) => r.re.test(name) && !(r.not && r.not.test(name)));

export function isEveryday(item) {
  return !!(item && item.area !== 'Spice rack' && ruleFor(String(item.name || '')));
}

// Estimated amount left now, or null if we can't (or needn't) guess.
export function estimate(item, eaters, now = Date.now()) {
  const rule = ruleFor(String(item.name || ''));
  if (!rule || item.area === 'Freezer' || item.area === 'Spice rack') return null;
  const total = totalOf(item);
  if (!total || !(total.n > 0)) return null;
  const rate = rule[total.unit];
  if (!rate) return null;
  const since = item.countedAt || item.addedAt;
  if (!since) return null;
  const days = (now - since) / 86400000;
  if (days < 0.5) return null;
  const used = rate * portions(eaters || { adults: 2, kids: 0 }) * days;
  const left = Math.max(0, total.n - used);
  const step = total.unit === 'each' ? 0.5 : total.unit === 'ml' ? 50 : 10;
  const n = Math.round(left / step) * step;
  return { amount: { ...total, n }, fraction: total.n ? left / total.n : 0, days };
}

// The stock as it probably is now: estimated amounts shown with "≈", and Low/Out when it's nearly gone.
export function withEstimates(stock, eaters, now = Date.now()) {
  return stock.map((item) => {
    if (item.status === 'Out') return item;
    const e = estimate(item, eaters, now);
    if (!e) return item;
    const status = item.status || (e.amount.n <= 0 ? 'Out' : e.fraction <= 0.25 ? 'Low' : null);
    return { ...item, qty: e.amount.n <= 0 ? 'Probably gone' : `≈ ${formatAmount(e.amount, totalOf(item))}`, status, estimated: true, estFraction: e.fraction };
  });
}

// What to ask about in the quick "Still got these?" check: everyday things that have probably run down,
// and anything the app hasn't heard about for a while.
export function checkList(stockView, max = 5) {
  return stockView
    .filter((s) => s.estimated && (s.estFraction <= 0.5 || s.status))
    .sort((a, b) => a.estFraction - b.estFraction)
    .slice(0, max);
}

