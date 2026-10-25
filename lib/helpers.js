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
