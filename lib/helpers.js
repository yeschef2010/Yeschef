import { formatAmount } from './amounts';
export const FOOD_AREAS = ['Fridge', 'Freezer', 'Cupboards', 'Spice rack', 'Fresh herbs', 'Drinks'];

// Household products live on their own tab.
export const PRODUCT_AREAS = ['Cleaning', 'Washing machine', 'Dishwasher'];
export const PRODUCT_STEPS = [
  { area: 'Cleaning', scene: 'Your cleaning cupboard', tip: 'Under the sink and the cleaning cupboard. Say if anything’s nearly empty.' },
  { area: 'Washing machine', scene: 'Your laundry stuff', tip: 'Detergent, fabric conditioner, stain removers. How much is left?' },
  { area: 'Dishwasher', scene: 'Your dishwasher bits', tip: 'Tablets, rinse aid and salt. Roughly how many tablets are left?' },
];
// Areas shown as one open list, without category headings.
export const FLAT_AREAS = [];
export const WINE_STYLES = ['Red', 'White', 'Rosé', 'Sparkling'];
export const kindOfArea = (area) => (area === 'Equipment' ? 'kit' : PRODUCT_AREAS.includes(area) ? 'product' : 'food');

// The full kitchen tour. Fresh herbs are picked up during the fridge step; drinks and wine share a step.
export const TOUR_STEPS = [
  { area: 'Fridge', scene: 'Your fridge', tip: 'Talk me through it like you’re showing a mate round. Say roughly how much is left, herbs too.' },
  { area: 'Freezer', scene: 'Your freezer', tip: 'Don’t forget the mystery tubs at the bottom.' },
  { area: 'Cupboards', scene: 'Your cupboards', tip: 'Open each cupboard and say what you see.' },
  { area: 'Spice rack', scene: 'Your spices', tip: 'Just pan along the jars. Tell me anything that’s nearly empty.' },
  { area: 'Drinks', label: 'Drinks & wine', scene: 'Your drinks, wine and spirits', tip: 'Soft drinks, mixers, the wine rack and the spirits. Say if a bottle’s open or nearly empty.' },
  { area: 'Equipment', label: 'Kit', scene: 'Your kit', tip: 'Pans, gadgets, and anything your oven gets wrong.' },
];

// Steps for updating a single area from the Kitchen tab.
export const AREA_STEPS = {
  'Fresh herbs': { area: 'Fresh herbs', scene: 'Your herbs', tip: 'Fresh herbs in the fridge, and any pots on the windowsill.' },
  Drinks: { area: 'Drinks', scene: 'Your drinks', tip: 'Soft drinks, mixers, beer, wine and spirits. Say if a bottle’s open.' },
};
export const stepForArea = (area) => TOUR_STEPS.find((t) => t.area === area && area !== 'Drinks') || AREA_STEPS[area];

export function mealForHour(h) {
  if (h >= 5 && h < 11) return 'breakfast';
  if (h >= 11 && h < 17) return 'lunch';
  return 'dinner';
}

export const MEALS = {
  breakfast: { tab: 'Breakfast', greeting: 'Morning, Chef' },
  lunch: { tab: 'Lunch', greeting: 'Good afternoon, Chef' },
  dinner: { tab: 'Dinner', greeting: 'Evening, Chef' },
};

export function dateLine(d) {
  const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
  const h = d.getHours();
  const h12 = ((h + 11) % 12) + 1;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${day} · ${h12}:${m}${h < 12 ? 'am' : 'pm'}`;
}

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

// Days until an item should be used, or null when it keeps for ages.
export function daysLeft(item, now = Date.now()) {
  if (item.shelfDays == null) return null;
  const used = (now - (item.addedAt || now)) / 86400000;
  return Math.round(item.shelfDays - used);
}

// Traffic light for freshness: green = good, amber = getting close, red = check before use.
// Grey is for things that keep (tins, dried goods, spices, frozen food).
export function stockTag(item) {
  const st = (item.status || '').toLowerCase();
  if (st === 'out') return { label: 'Run out', cls: 'red' };
  if (st === 'low') return { label: 'Running low', cls: 'amber' };
  const d = daysLeft(item);
  if (d == null) return { label: item.area === 'Spice rack' ? 'Got it' : 'Keeps', cls: 'grey' };
  if (d < 0) return { label: 'Check it', cls: 'red' };
  if (d === 0) return { label: 'Use today', cls: 'red' };
  if (d === 1) return { label: 'Tomorrow', cls: 'red' };
  if (d <= 2) return { label: `${d} days`, cls: 'red' };
  if (d <= 5) return { label: `${d} days`, cls: 'amber' };
  if (d <= 13) return { label: `${d} days`, cls: 'green' };
  if (d <= 60) return { label: `${Math.round(d / 7)} weeks`, cls: 'green' };
  return { label: 'Months', cls: 'green' };
}

// Food that's close to its date, or has run low or out.
export function needsAttention(item) {
  const t = stockTag(item).cls;
  return t === 'red' || (t === 'amber' && !!item.status);
}

export function listJoin(names) {
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

/* ---------- Grouping stock into sensible categories ---------- */

export const AREA_CATEGORIES = {
  Fridge: ['Dairy & eggs', 'Meat & fish', 'Veg', 'Salad', 'Fruit', 'Leftovers & ready meals', 'Sauces & condiments', 'Bread & bakery', 'Other'],
  Cupboards: ['Tins & jars', 'Pasta, rice & grains', 'Sauces & condiments', 'Baking', 'Oils & vinegars', 'Snacks & cereal', 'Bread & bakery', 'Veg', 'Fruit', 'Other'],
  'Fresh herbs': ['Cut herbs', 'Herb pots', 'Other'],
  'Spice rack': ['Spices', 'Dried herbs', 'Other'],
  Freezer: ['Frozen veg & fruit', 'Frozen meat & fish', 'Frozen meals & sides', 'Bread & bakery', 'Desserts', 'Other'],
  Drinks: ['Soft drinks', 'Mixers', 'Beer & cider', 'Wine', 'Spirits', 'Other'],
  Equipment: ['Cooking', 'Appliances', 'Pans & trays', 'Tools', 'Other'],
  Cleaning: ['Sprays & surfaces', 'Bathroom & toilet', 'Washing up', 'Floors', 'Cloths & sponges', 'Bin bags & foil', 'Other'],
  'Washing machine': ['Detergent', 'Fabric conditioner', 'Stain removers', 'Other'],
  Dishwasher: ['Tablets', 'Rinse aid', 'Salt', 'Machine cleaner', 'Other'],
};

// Match words from their start, so "pea" doesn't catch "peach" and "tea" doesn't catch "steak".
const has = (n, words) => words.some((w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${w.length <= 3 ? 's?([^a-z]|$)' : ''}`).test(n));

const W = {
  tins: ['tin', 'canned', 'chickpea', 'baked bean', 'kidney bean', 'butter bean', 'black bean', 'lentil', 'coconut milk', 'chopped tomato', 'passata', 'tomato puree', 'olive', 'sweetcorn tin', 'jar of'],
  leftovers: ['leftover', 'bolognese', 'chilli con', 'curry', 'soup', 'stew', 'lasagne', 'pie', 'pizza', 'ready meal', 'casserole'],
  dairy: ['milk', 'cheese', 'cheddar', 'mozzarella', 'feta', 'parmesan', 'halloumi', 'yoghurt', 'yogurt', 'butter', 'cream', 'egg', 'fraiche', 'fraîche', 'custard', 'brie', 'ricotta', 'mascarpone'],
  meat: ['chicken', 'beef', 'pork', 'lamb', 'mince', 'bacon', 'ham', 'sausage', 'chorizo', 'salami', 'turkey', 'steak', 'fish', 'salmon', 'cod', 'haddock', 'prawn', 'duck', 'pepperoni', 'gammon'],
  freshHerbs: ['basil', 'coriander', 'parsley', 'mint', 'dill', 'chive', 'rosemary', 'thyme', 'sage'],
  salad: ['lettuce', 'rocket', 'spinach', 'cucumber', 'tomato', 'salad', 'spring onion', 'radish', 'watercress', 'celery', 'avocado', 'beansprout'],
  veg: ['carrot', 'potato', 'onion', 'pepper', 'broccoli', 'courgette', 'aubergine', 'mushroom', 'cabbage', 'cauliflower', 'leek', 'garlic', 'ginger', 'sweetcorn', 'green bean', 'peas', 'petit pois', 'squash', 'parsnip', 'kale', 'sprout', 'beetroot', 'chilli', 'asparagus', 'swede'],
  fruit: ['apple', 'banana', 'orange', 'lemon', 'lime', 'grape', 'berr', 'pear', 'melon', 'mango', 'pineapple', 'kiwi', 'plum', 'peach', 'satsuma', 'clementine', 'cherr', 'raisin'],
  bread: ['bread', 'loaf', 'wrap', 'tortilla', 'pitta', 'bagel', 'roll', 'crumpet', 'naan', 'croissant', 'muffin'],
  sauces: ['ketchup', 'mayo', 'mustard', 'sauce', 'pesto', 'chutney', 'jam', 'honey', 'marmite', 'peanut butter', 'soy', 'dressing', 'hummus', 'houmous', 'stock', 'gravy', 'relish', 'syrup', 'paste'],
  drinks: ['juice', 'water', 'cola', 'beer', 'wine', 'lemonade', 'coffee', 'tea', 'cordial', 'squash drink', 'fizzy'],
  grains: ['pasta', 'spaghetti', 'penne', 'fusilli', 'rice', 'noodle', 'couscous', 'quinoa', 'oat', 'porridge', 'bulgur', 'macaroni', 'lasagne sheet'],
  baking: ['flour', 'sugar', 'baking', 'yeast', 'cocoa', 'vanilla', 'icing', 'bicarb', 'cornflour', 'chocolate chip'],
  snacks: ['crisp', 'biscuit', 'cereal', 'granola', 'cornflake', 'weetabix', 'nut', 'popcorn', 'chocolate', 'cracker', 'bar'],
  oils: ['oil', 'vinegar'],
  dried: ['oregano', 'thyme', 'basil', 'parsley', 'mixed herb', 'bay', 'rosemary', 'sage', 'dill', 'mint', 'tarragon', 'herbes'],
  desserts: ['ice cream', 'ice lolly', 'sorbet', 'dessert', 'cheesecake', 'gateau'],
  frozenMeals: ['chip', 'wedge', 'hash brown', 'nugget', 'fish finger', 'burger', 'pizza', 'lasagne', 'leftover', 'bolognese', 'curry', 'soup', 'pie', 'yorkshire'],
  appliances: ['air fryer', 'slow cooker', 'microwave', 'blender', 'food processor', 'mixer', 'kettle', 'toaster', 'instant pot', 'pressure cooker', 'grill', 'rice cooker'],
  cooking: ['oven', 'hob', 'cooker', 'range', 'aga'],
  pans: ['pan', 'wok', 'tray', 'tin', 'dish', 'pot', 'casserole', 'skillet'],
  alcohol: ['wine', 'red wine', 'white wine', 'rosé', 'rose wine', 'prosecco', 'champagne', 'cava', 'beer', 'lager', 'ale', 'ipa', 'stout', 'cider', 'gin', 'vodka', 'whisky', 'whiskey', 'rum', 'brandy', 'tequila', 'liqueur', 'port', 'sherry', 'merlot', 'rioja', 'malbec', 'shiraz', 'cabernet', 'pinot', 'sauvignon', 'chardonnay', 'riesling', 'prosecco', 'bordeaux', 'chianti', 'primitivo'],
  alcoholFree: ['alcohol-free', 'alcohol free', 'non-alcoholic', '0%', 'zero', 'low alcohol'],
  softDrinks: ['cola', 'coke', 'lemonade', 'fizzy', 'tonic', 'ginger beer', 'ginger ale', 'soda', 'pop', 'sprite', 'fanta', 'irn', 'mixer'],
  juices: ['juice', 'smoothie'],
  squash: ['squash', 'cordial', 'robinsons', 'ribena'],
  waters: ['water', 'sparkling water', 'still water'],
  hotDrinks: ['tea', 'coffee', 'hot chocolate', 'teabag'],
  red: ['red', 'merlot', 'rioja', 'malbec', 'shiraz', 'cabernet', 'pinot noir', 'bordeaux', 'chianti', 'primitivo', 'tempranillo', 'zinfandel'],
  white: ['white', 'sauvignon', 'chardonnay', 'pinot grigio', 'riesling', 'chenin', 'albari', 'viognier', 'picpoul'],
  rose: ['rosé', 'rose'],
  sparkling: ['prosecco', 'champagne', 'cava', 'sparkling', 'cremant', 'crémant', 'fizz'],
  mixers: ['tonic', 'soda water', 'club soda', 'ginger ale', 'ginger beer', 'bitter lemon', 'mixer', 'slimline'],
  beer: ['beer', 'lager', 'ale', 'ipa', 'stout', 'cider', 'porter'],
  spirits: ['gin', 'vodka', 'whisky', 'whiskey', 'bourbon', 'scotch', 'rum', 'brandy', 'cognac', 'tequila', 'liqueur', 'baileys', 'aperol', 'campari', 'pimm', 'cointreau', 'amaretto', 'kahlua', 'schnapps', 'cassis', 'vermouth'],
  fortified: ['port', 'sherry', 'madeira', 'marsala'],
};

function guessCategory(item) {
  const n = String(item.name || '').toLowerCase();
  const area = item.area;
  if (area === 'Spice rack') return has(n, W.dried) ? 'Dried herbs' : 'Spices';
  if (area === 'Fresh herbs') return /pot|plant|grow/.test(n) ? 'Herb pots' : 'Cut herbs';
  if (area === 'Cleaning') {
    if (/washing.?up|dish soap|fairy/.test(n)) return 'Washing up';
    if (/toilet|bathroom|limescale|shower|bleach|loo/.test(n)) return 'Bathroom & toilet';
    if (/floor|mop/.test(n)) return 'Floors';
    if (/cloth|sponge|scourer|wipe|kitchen roll|paper towel/.test(n)) return 'Cloths & sponges';
    if (/bin bag|bin liner|foil|cling|baking paper|sandwich bag|freezer bag/.test(n)) return 'Bin bags & foil';
    if (/spray|surface|polish|glass|multi/.test(n)) return 'Sprays & surfaces';
    return 'Other';
  }
  if (area === 'Washing machine') {
    if (/conditioner|softener|lenor|comfort/.test(n)) return 'Fabric conditioner';
    if (/stain|vanish|pre.?wash/.test(n)) return 'Stain removers';
    if (/detergent|liquid|powder|pod|capsule|bio|persil|ariel|non.?bio|laundry/.test(n)) return 'Detergent';
    return 'Other';
  }
  if (area === 'Dishwasher') {
    if (/rinse/.test(n)) return 'Rinse aid';
    if (/salt/.test(n)) return 'Salt';
    if (/cleaner|machine/.test(n)) return 'Machine cleaner';
    if (/tablet|tab|pod|capsule|finish/.test(n)) return 'Tablets';
    return 'Other';
  }
  if (area === 'Drinks') {
    if (has(n, W.mixers) && !/\b(gin|vodka|rum|whisky)\b/.test(n)) return 'Mixers';
    if (has(n, W.alcoholFree)) return 'Soft drinks';
    if (has(n, W.juices) || has(n, W.squash) || has(n, W.waters) || has(n, W.hotDrinks) || has(n, W.softDrinks)) return 'Soft drinks';
    if (has(n, W.spirits)) return 'Spirits';
    if (has(n, W.beer)) return 'Beer & cider';
    if (has(n, W.alcohol) || has(n, W.fortified)) return 'Wine';
    return 'Other';
  }
  if (area === 'Equipment') {
    if (has(n, W.appliances)) return 'Appliances';
    if (has(n, W.cooking)) return 'Cooking';
    if (has(n, W.pans)) return 'Pans & trays';
    return 'Tools';
  }
  if (area === 'Freezer') {
    if (has(n, W.desserts)) return 'Desserts';
    if (has(n, W.frozenMeals)) return 'Frozen meals & sides';
    if (has(n, W.meat)) return 'Frozen meat & fish';
    if (has(n, W.bread)) return 'Bread & bakery';
    if (has(n, W.veg) || has(n, W.fruit)) return 'Frozen veg & fruit';
    return 'Other';
  }
  if (has(n, W.oils)) return 'Oils & vinegars';
  if (has(n, W.tins)) return area === 'Fridge' ? 'Sauces & condiments' : 'Tins & jars';
  if (area === 'Fridge' && has(n, W.leftovers)) return 'Leftovers & ready meals';
  if (has(n, W.sauces)) return 'Sauces & condiments';
  if (has(n, W.meat)) return 'Meat & fish';
  if (has(n, W.dairy)) return 'Dairy & eggs';
  if (area === 'Fridge' && has(n, W.freshHerbs)) return 'Fresh herbs';
  if (has(n, W.salad)) return 'Salad';
  if (has(n, W.veg)) return 'Veg';
  if (has(n, W.fruit)) return 'Fruit';
  if (has(n, W.bread)) return 'Bread & bakery';
  if (has(n, W.grains)) return 'Pasta, rice & grains';
  if (has(n, W.baking)) return 'Baking';
  if (has(n, W.snacks)) return 'Snacks & cereal';
  return 'Other';
}

// Wines are split by style inside the Wine group.
export function wineStyleOf(item) {
  if (WINE_STYLES.includes(item.style)) return item.style;
  const n = String(item.name || '').toLowerCase();
  if (has(n, W.sparkling)) return 'Sparkling';
  if (has(n, W.rose)) return 'Rosé';
  if (has(n, W.white)) return 'White';
  if (has(n, W.red)) return 'Red';
  return 'Other';
}

export function categoryOf(item) {
  const list = AREA_CATEGORIES[item.area] || AREA_CATEGORIES.Fridge;
  if (item.category && list.includes(item.category)) return item.category;
  const g = guessCategory(item);
  return list.includes(g) ? g : 'Other';
}

// Items for one area, grouped by category in a sensible order, with urgent things first in each group.
export function groupByCategory(items, area, urgentFirst = true) {
  const order = AREA_CATEGORIES[area] || ['Other'];
  const groups = new Map(order.map((c) => [c, []]));
  items.forEach((it) => {
    const c = categoryOf({ ...it, area: it.area || area });
    (groups.get(c) || groups.get('Other')).push(it);
  });
  const rank = (it) => {
    if (!urgentFirst) return 0;
    const t = stockTag(it).cls;
    return t === 'red' ? 0 : t === 'amber' ? 1 : t === 'green' ? 2 : 3;
  };
  return order
    .map((c) => ({ category: c, items: groups.get(c).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)) }))
    .filter((g) => g.items.length > 0);
}

// Older stock used Fridge/Cupboards for herbs and drinks, and Wine for spirits. Move them to their own areas.
const NOT_DRINKS = /watermelon|watercress|water chestnut|wine vinegar|cooking wine|tonic water chestnut/;
export function migrateArea(item) {
  const n = String(item.name || '').toLowerCase();
  const isSpirit = has(n, W.spirits) && !has(n, W.alcoholFree);
  // Wine and Spirits used to be their own areas; now they're groups inside Drinks.
  if (item.area === 'Spirits' || (item.area === 'Wine' && isSpirit)) return { ...item, area: 'Drinks', category: 'Spirits' };
  if (item.area === 'Wine') {
    const beer = has(n, W.beer);
    return { ...item, area: 'Drinks', category: beer ? 'Beer & cider' : 'Wine', style: WINE_STYLES.includes(item.category) ? item.category : item.style || null };
  }
  if (item.area === 'Drinks' && item.category && !AREA_CATEGORIES.Drinks.includes(item.category)) return { ...item, category: null };
  if (!['Fridge', 'Cupboards'].includes(item.area)) return item;
  if (item.area === 'Fridge' && (item.category === 'Fresh herbs' || (!item.category && has(n, W.freshHerbs)))) {
    return { ...item, area: 'Fresh herbs', category: null };
  }
  if (NOT_DRINKS.test(n)) return item;
  const drinkish = item.category === 'Drinks' || has(n, W.drinks) || has(n, W.alcohol) || has(n, W.softDrinks) || isSpirit;
  if (drinkish && !has(n, ['milk'])) {
    const to = 'Drinks';
    // Keep a note that some of it is chilled.
    const locations = item.area === 'Fridge' ? { Fridge: item.qty || '' } : undefined;
    return { ...item, area: to, category: null, ...(locations ? { locations, qty: qtyFromLocations(locations) } : {}) };
  }
  return item;
}

// Where things physically are, kept per item so a fridge scan never overwrites what's in the cupboard.
const PLACE_WORDS = { Fridge: 'chilled', Freezer: 'frozen' };
export function locationKey(scanArea, itemArea) {
  if (!scanArea || scanArea === itemArea) return 'main';
  return PLACE_WORDS[scanArea] ? scanArea : 'main';
}
export function qtyFromLocations(locations) {
  const entries = Object.entries(locations || {})
    .filter(([, q]) => q !== undefined && q !== null)
    .map(([k, q]) => [k, typeof q === 'object' ? formatAmount(q) : q]);
  if (entries.length === 0) return '';
  const main = entries.filter(([k]) => k === 'main').map(([, q]) => q);
  const extra = entries.filter(([k]) => k !== 'main').map(([k, q]) => `${q || 'some'} ${PLACE_WORDS[k] || 'elsewhere'}`.trim());
  return [...main, ...extra].filter(Boolean).join(' · ');
}
