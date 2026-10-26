// Drinks you can make from what's in, across every area (gin and tonic in Drinks, lemon in the Fridge).
// Each recipe lists what it needs; each need is "any of these words". Garnishes are nice-to-haves.

const RECIPES = [
  { name: 'Gin & tonic', needs: [['gin'], ['tonic']], garnish: [['lemon'], ['lime'], ['cucumber']], alcoholFree: false },
  { name: 'Vodka & tonic', needs: [['vodka'], ['tonic']], garnish: [['lime'], ['lemon']] },
  { name: 'Rum & cola', needs: [['rum'], ['cola', 'coke']], garnish: [['lime']] },
  { name: 'Whisky & ginger', needs: [['whisky', 'whiskey', 'bourbon'], ['ginger ale', 'ginger beer']], garnish: [['lemon'], ['lime']] },
  { name: 'Moscow mule', needs: [['vodka'], ['ginger beer'], ['lime']], garnish: [['mint']] },
  { name: 'Dark and stormy', needs: [['rum'], ['ginger beer'], ['lime']] },
  { name: 'Mojito', needs: [['rum'], ['mint'], ['lime'], ['soda', 'sparkling water']] },
  { name: 'Aperol spritz', needs: [['aperol'], ['prosecco', 'cava', 'sparkling wine', 'champagne'], ['soda', 'sparkling water']], garnish: [['orange']] },
  { name: 'Pimm’s', needs: [['pimm'], ['lemonade']], garnish: [['cucumber'], ['strawberr'], ['mint']] },
  { name: 'Buck’s fizz', needs: [['prosecco', 'champagne', 'cava'], ['orange juice']] },
  { name: 'Kir royale', needs: [['cassis'], ['prosecco', 'champagne', 'cava']] },
  { name: 'Hot toddy', needs: [['whisky', 'whiskey'], ['lemon'], ['honey']] },
  { name: 'Virgin mojito', needs: [['mint'], ['lime'], ['soda', 'sparkling water', 'lemonade']], alcoholFree: true },
  { name: 'Elderflower spritz', needs: [['elderflower'], ['sparkling water', 'soda']], garnish: [['lime'], ['mint']], alcoholFree: true },
  { name: 'Alcohol-free G&T', needs: [['alcohol-free gin', 'alcohol free gin', '0% gin', 'non-alcoholic gin'], ['tonic']], garnish: [['lemon'], ['lime']], alcoholFree: true },
];

// Short words must be whole words: "ginger beer" isn't gin, "rump steak" isn't rum.
const startsWord = (text, word) => new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${word.length <= 3 ? 's?([^a-z]|$)' : ''}`).test(text);

function findItem(stock, words, excludeIds) {
  return stock.find(
    (s) => !excludeIds.has(s.id) && (s.status || '').toLowerCase() !== 'out' && words.some((w) => startsWord(String(s.name).toLowerCase(), w))
  );
}

export function drinksYouCanMake(stock, limit = 4) {
  const out = [];
  for (const r of RECIPES) {
    const used = new Set();
    const found = [];
    let ok = true;
    for (const need of r.needs) {
      const hit = findItem(stock, need, used);
      if (!hit) {
        ok = false;
        break;
      }
      used.add(hit.id);
      found.push(hit);
    }
    if (!ok) continue;
    // A G&T made with alcohol-free gin is the alcohol-free version, not the real thing.
    if (!r.alcoholFree && found.some((f) => /alcohol.?free|0%|non.?alcoholic/.test(String(f.name).toLowerCase()))) continue;
    const garnish = (r.garnish || []).map((g) => findItem(stock, g, used)).find(Boolean);
    out.push({ name: r.name, items: found, garnish, alcoholFree: !!r.alcoholFree });
    if (out.length >= limit) break;
  }
  return out;
}
