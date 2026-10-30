// Supermarkets and how to open a search on their site/app. Links open their real products and prices.
import { categoryOf } from './helpers';
import { sameThing, totalOf } from './amounts';

const q = (s) => encodeURIComponent(String(s || '').trim());

export const SHOPS = [
  { id: 'tesco', name: 'Tesco', search: (t) => `https://www.tesco.com/groceries/en-GB/search?query=${q(t)}` },
  { id: 'sainsburys', name: 'Sainsbury’s', search: (t) => `https://www.sainsburys.co.uk/gol-ui/SearchResults/${q(t)}` },
  { id: 'asda', name: 'Asda', search: (t) => `https://groceries.asda.com/search/${q(t)}` },
  { id: 'morrisons', name: 'Morrisons', search: (t) => `https://groceries.morrisons.com/search?q=${q(t)}` },
  { id: 'waitrose', name: 'Waitrose', search: (t) => `https://www.waitrose.com/ecom/shop/search?searchTerm=${q(t)}` },
  { id: 'ocado', name: 'Ocado', search: (t) => `https://www.ocado.com/search?entry=${q(t)}` },
  { id: 'aldi', name: 'Aldi', search: (t) => `https://www.aldi.co.uk/results?q=${q(t)}` },
  { id: 'iceland', name: 'Iceland', search: (t) => `https://www.iceland.co.uk/search?q=${q(t)}` },
  { id: 'lidl', name: 'Lidl', search: null }, // No online grocery shopping, so no links.
];

export const shopById = (id) => SHOPS.find((s) => s.id === id) || null;

// Aisles, in roughly the order you walk a supermarket.
export const AISLES = ['Fruit & veg', 'Meat & fish', 'Dairy & eggs', 'Bakery', 'Cupboard', 'Frozen', 'Drinks', 'Household', 'Other'];

const FROM_CATEGORY = {
  Veg: 'Fruit & veg', Salad: 'Fruit & veg', Fruit: 'Fruit & veg', 'Cut herbs': 'Fruit & veg', 'Herb pots': 'Fruit & veg',
  'Meat & fish': 'Meat & fish', 'Dairy & eggs': 'Dairy & eggs', 'Bread & bakery': 'Bakery',
  'Leftovers & ready meals': 'Meat & fish',
};

// Which aisle something belongs in: from its stock area if we know it, otherwise a best guess from the name.
export function aisleOf(name, hint = {}) {
  const area = hint.area;
  if (['Cleaning', 'Washing machine', 'Dishwasher'].includes(area)) return 'Household';
  if (area === 'Drinks') return 'Drinks';
  if (area === 'Freezer') return 'Frozen';
  if (area === 'Fresh herbs') return 'Fruit & veg';
  if (area === 'Spice rack') return 'Cupboard';
  if (area === 'Fridge' || area === 'Cupboards') {
    const c = categoryOf({ name, area, category: hint.category });
    return FROM_CATEGORY[c] || (area === 'Fridge' ? 'Dairy & eggs' : 'Cupboard');
  }
  const n = String(name || '').toLowerCase();
  if (/frozen|ice cream|fish finger|oven chips/.test(n)) return 'Frozen';
  if (/fairy|finish|persil|bleach|bin bag|foil|cling|kitchen roll|toilet roll|detergent|washing|dishwasher|sponge|cleaner|spray/.test(n)) return 'Household';
  for (const area2 of ['Fridge', 'Cupboards']) {
    const c = categoryOf({ name, area: area2 });
    if (FROM_CATEGORY[c]) return FROM_CATEGORY[c];
  }
  if (categoryOf({ name, area: 'Drinks' }) !== 'Other') return 'Drinks';
  const c = categoryOf({ name, area: 'Cupboards' });
  return c !== 'Other' ? 'Cupboard' : 'Other';
}

// Running low: someone said so, or the amount has dropped below about a quarter of a pack.
export function isRunningLow(item) {
  if (item.status === 'Low' || item.status === 'Out') return true;
  if (item.area === 'Spice rack') return false;
  const t = totalOf(item);
  if (!t) return false;
  if (item.pack && item.pack.unit === t.unit && item.pack.n > 0) return t.n <= item.pack.n * 0.25;
  if (t.unit === 'ml') return t.n < 300;
  if (t.unit === 'g') return t.n < 100;
  if (t.unit === 'each') return /egg/.test(String(t.word || item.name).toLowerCase()) ? t.n <= 2 : false;
  return false;
}

// Does something bought (or in stock) match a list item? "Whole chicken" ticks off "Roast chicken" if it was one of its options.
export function matchesListItem(listItem, name) {
  const names = [listItem.name, listItem.chosen, ...((listItem.options || []).map((o) => o.name))].filter(Boolean);
  return names.some((n) => sameThing(n, name));
}
