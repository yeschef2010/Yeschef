export const FOOD_AREAS = ['Fridge', 'Cupboards', 'Spice rack', 'Freezer'];

export const TOUR_STEPS = [
  { area: 'Fridge', scene: 'Your fridge', tip: 'Talk me through it like you’re showing a mate round. Say roughly how much is left.' },
  { area: 'Cupboards', scene: 'Your cupboards', tip: 'Open each cupboard and say what you see.' },
  { area: 'Spice rack', scene: 'Your spices', tip: 'Just pan along the jars. Tell me anything that’s nearly empty.' },
  { area: 'Freezer', scene: 'Your freezer', tip: 'Don’t forget the mystery tubs at the bottom.' },
  { area: 'Equipment', scene: 'Your kit', tip: 'Pans, gadgets, and anything your oven gets wrong.' },
];

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

export function stockTag(item) {
  const st = (item.status || '').toLowerCase();
  if (st === 'out') return { label: 'Out', cls: 'urgent' };
  if (st === 'low') return { label: 'Low', cls: 'urgent' };
  const d = daysLeft(item);
  if (d == null) return { label: item.area === 'Spice rack' ? 'Got it' : 'Keeps', cls: 'fine' };
  if (d <= 0) return { label: 'Use today', cls: 'urgent' };
  if (d === 1) return { label: 'Tomorrow', cls: 'urgent' };
  if (d <= 2) return { label: `${d} days`, cls: 'urgent' };
  if (d <= 5) return { label: `${d} days`, cls: 'soon' };
  if (d <= 13) return { label: `${d} days`, cls: 'fine' };
  if (d <= 60) return { label: `${Math.round(d / 7)} weeks`, cls: 'fine' };
  return { label: 'Months', cls: 'fine' };
}

export function needsAttention(item) {
  return stockTag(item).cls === 'urgent';
}

export function listJoin(names) {
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

/* ---------- Grouping stock into sensible categories ---------- */

export const AREA_CATEGORIES = {
  Fridge: ['Dairy & eggs', 'Meat & fish', 'Veg', 'Salad', 'Fruit', 'Fresh herbs', 'Leftovers & ready meals', 'Sauces & condiments', 'Drinks', 'Bread & bakery', 'Other'],
  Cupboards: ['Tins & jars', 'Pasta, rice & grains', 'Sauces & condiments', 'Baking', 'Oils & vinegars', 'Snacks & cereal', 'Bread & bakery', 'Veg', 'Fruit', 'Drinks', 'Other'],
  'Spice rack': ['Spices', 'Dried herbs', 'Other'],
  Freezer: ['Frozen veg & fruit', 'Frozen meat & fish', 'Frozen meals & sides', 'Bread & bakery', 'Desserts', 'Other'],
  Equipment: ['Cooking', 'Appliances', 'Pans & trays', 'Tools', 'Other'],
};

// Match words from their start, so "pea" doesn't catch "peach" and "tea" doesn't catch "steak".
const has = (n, words) => words.some((w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(n));

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
};

function guessCategory(item) {
  const n = String(item.name || '').toLowerCase();
  const area = item.area;
  if (area === 'Spice rack') return has(n, W.dried) ? 'Dried herbs' : 'Spices';
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
  if (has(n, W.drinks)) return 'Drinks';
  if (has(n, W.fruit)) return 'Fruit';
  if (has(n, W.bread)) return 'Bread & bakery';
  if (has(n, W.grains)) return 'Pasta, rice & grains';
  if (has(n, W.baking)) return 'Baking';
  if (has(n, W.snacks)) return 'Snacks & cereal';
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
    return t === 'urgent' ? 0 : t === 'soon' ? 1 : 2;
  };
  return order
    .map((c) => ({ category: c, items: groups.get(c).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)) }))
    .filter((g) => g.items.length > 0);
}
