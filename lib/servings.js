// Who's eating, and scaling recipe amounts to match. A child's portion counts as about 0.6 of an adult's.
import { formatAmount, parseQty } from './amounts';

const KID = 0.6;
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
const num = (s) => (s == null ? null : /^\d+$/.test(s) ? Number(s) : WORDS[s] ?? null);

// "2 adults, 2 kids" → { adults: 2, kids: 2 }
export function parseHousehold(text) {
  const t = String(text || '').toLowerCase();
  const a = t.match(/(\d+|one|two|three|four|five|six)\s*(adults?|grown|parents?|of us)/);
  const k = t.match(/(\d+|one|two|three|four|five|six)\s*(kids?|children|child|boys?|girls?|teens?|little)/);
  const adults = a ? num(a[1]) : null;
  const kids = k ? num(k[1]) : null;
  if (adults == null && kids == null) return null;
  return { adults: adults ?? 2, kids: kids ?? 0 };
}

export const portions = ({ adults = 2, kids = 0 } = {}) => Math.max(0.5, adults + kids * KID);

const tidy = (n, unit) => {
  if (unit === 'each') return n < 2 ? Math.max(0.5, Math.round(n * 2) / 2) : Math.round(n);
  if (n >= 100) return Math.round(n / 10) * 10;
  if (n >= 20) return Math.round(n / 5) * 5;
  return Math.max(1, Math.round(n));
};

export function scaleUse(use, f) {
  const u = parseQty(use);
  if (!u || f === 1) return u;
  return { ...u, n: tidy(u.n * f, u.unit) };
}

// Scale the numbers in an amount like "2 tbsp" or "300g". Words ("a pinch", "to taste") stay as they are.
export function scaleText(text, f) {
  if (!text || f === 1) return text;
  return String(text).replace(/(\d+(?:\.\d+)?)(?!\s*(?:%|°|c\b|minutes?|mins?))/gi, (m) => {
    const v = Number(m) * f;
    return String(v >= 10 ? Math.round(v) : Math.round(v * 2) / 2);
  });
}

export function scaledAmountText(ing, f) {
  if (f === 1) return ing.amount;
  const u = scaleUse(ing.use, f);
  return u ? formatAmount(u) : scaleText(ing.amount, f);
}

// Amounts written into the method ("add 400ml stock", "crack in 4 eggs"). Only numbers followed by a
// measure or a food count are scaled, so oven temperatures, times and "cut into 4 pieces" stay the same.
const UNIT_AFTER =
  /(\d+(?:\.\d+)?)(\s*(?:x\s*)?(?:kg|g|grams?|ml|l|litres?|liters?|pints?|tbsp|tablespoons?|tsp|teaspoons?|cloves?|tins?|cans?|eggs?|rashers?|slices?|handfuls?|cups?|sprigs?|fillets?|thighs?|breasts?|sausages?|onions?|potatoes|peppers?|carrots?|stock cubes?|cubes?)\b)/gi;
export function scaleStepText(text, f) {
  if (!text || f === 1) return text;
  return String(text).replace(UNIT_AFTER, (m, n, rest) => {
    const v = Number(n) * f;
    const whole = /egg|onion|potato|pepper|carrot|sausage|fillet|thigh|breast|clove|rasher|slice|cube/i.test(rest);
    const r = v >= 100 ? Math.round(v / 10) * 10 : v >= 20 ? Math.round(v / 5) * 5 : v >= 10 || whole ? Math.max(1, Math.round(v)) : Math.round(v * 2) / 2;
    if (r >= 1000 && /^\s*(g|grams?)\b/i.test(rest)) return `${Math.round(r / 100) / 10}kg${rest.replace(/^\s*(g|grams?)/i, '')}`;
    if (r >= 1000 && /^\s*ml\b/i.test(rest)) return `${Math.round(r / 100) / 10} litres${rest.replace(/^\s*ml/i, '')}`;
    return `${r}${rest}`;
  });
}
