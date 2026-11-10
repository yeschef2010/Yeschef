import { ask as askAi, getClient, MODEL, parseJson, replyText, noKeyResponse, failResponse, withRetry } from '@/lib/ai';

export const maxDuration = 60;

// Two quick steps so nothing hits the 60-second limit:
//   step "cards":  three short ideas (title, time, why, traffic lights) — fast.
//   step "recipe": the full recipe for one chosen idea — the app asks for all three at once in the background.

const TYPES = ['useup', 'quick', 'different'];
const lightsOf = (r) =>
  Object.fromEntries(['fat', 'saturates', 'sugar', 'salt'].map((k) => [k, ['low', 'medium', 'high'].includes(r?.lights?.[k]) ? r.lights[k] : null]));

const cleanCard = (r, i) => ({
  type: TYPES.includes(r.type) ? r.type : TYPES[i] || 'different',
  title: String(r.title || 'Something tasty'),
  time: r.time || '',
  tag: r.tag || '',
  why: r.why || '',
  missing: Array.isArray(r.missing) ? r.missing : [],
  lights: lightsOf(r),
  prep: r.prep || '',
});

const cleanRecipe = (r) => ({
  ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
  missing: Array.isArray(r.missing) ? r.missing : [],
  steps: Array.isArray(r.steps) ? r.steps : [],
  usedUp: Array.isArray(r.usedUp) ? r.usedUp : [],
  tip: r.tip || '',
  serves: r.serves && (Number(r.serves.adults) || Number(r.serves.kids)) ? { adults: Number(r.serves.adults) || 0, kids: Number(r.serves.kids) || 0 } : null,
});

const SYSTEM =
  "You are the kitchen assistant inside Yes Chef!, a UK app. The user is the chef; you're the helpful sous chef who does the admin. Suggest realistic, tasty family food that wastes nothing.";

// Strict diets: take anything that breaks them out of the stock list, so the AI can't suggest it.
const MEAT_FISH = /\b(chicken|beef|pork|lamb|mince|bacon|ham|sausages?|chipolatas?|chorizo|salami|pepperoni|prosciutto|pancetta|turkey|duck|venison|steak|burgers?|meatballs?|gammon|black pudding|fish|salmon|tuna|cod|haddock|mackerel|sardines?|anchov(y|ies)|prawns?|shrimp|sea bass|trout|crab|lobster|mussels|squid|scampi|fish fingers?|gelatine|lard|suet|stock cubes? \(chicken|beef\))\b/i;
const ANIMAL = /\b(pesto|milk|cream|butter|cheese|cheddar|mozzarella|parmesan|feta|halloumi|brie|yogh?urt|cr[eè]me fra[iî]che|eggs?|honey|mayonnaise|mayo|ghee|custard|ice cream|whey)\b/i;
const PLANT_OK = /\b(oat|soya|soy|almond|coconut|vegan|plant|dairy.?free|nut)\b/i;

function dietRules(b) {
  const said = `${b.request || ''} ${b.dietary || ''}`.toLowerCase();
  const vegan = /\bvegan\b|plant.?based/.test(said);
  const veggie = vegan || /\bvegetarian\b|\bveggie\b|no meat|meat.?free/.test(said);
  return { vegan, veggie };
}

function allowed(item, { vegan, veggie }) {
  const n = String(item.name || '');
  if (veggie && MEAT_FISH.test(n) && !PLANT_OK.test(n)) return false;
  if (vegan && ANIMAL.test(n) && !PLANT_OK.test(n)) return false;
  return true;
}

function context(b) {
  const tomorrow = b.meal === 'tomorrow';
  const meal = tomorrow ? 'dinner' : b.meal || 'dinner';
  const mode = b.mode === 'fun' ? 'fun' : 'quick';
  const diet = dietRules(b);
  const stock = (b.stock || []).filter((s) => allowed(s, diet)).slice(0, 200);
  const kit = (b.kit || []).slice(0, 60);
  const stockLines = stock
    .map((s) => `- ${s.name} (${s.qty || 'some'}; ${s.area}${s.daysLeft != null ? `; use within ${s.daysLeft} day(s)` : ''}${s.status ? `; ${s.status}` : ''}${s.saved ? `; saved for ${String(s.saved).slice(0, 40)}` : ''})`)
    .join('\n');
  const text = `Household: ${b.household || 'not set'}
Dietary needs: ${b.dietary || 'none given'}
Style: ${mode === 'quick' ? 'Quick and easy: 15 minutes or less where possible, few pans, minimal washing up.' : 'Fun in the kitchen: they have time and want something a bit special, but still realistic at home.'}
${b.context ? `Context: ${b.context}` : ''}
${b.request ? `They've asked for: "${String(b.request).slice(0, 120)}". This comes first, before using things up: every idea, including the "use it up" one, must fully fit it with no swaps or "if you want" notes. "why" says how it fits.` : ''}
${diet.vegan ? 'STRICTLY VEGAN: no meat, fish, dairy, eggs, honey or any animal product, in any idea or ingredient.' : diet.veggie ? 'STRICTLY VEGETARIAN: no meat or fish (including stock, gelatine, anchovies), in any idea or ingredient.' : ''}

Their stock:
${stockLines || '(nothing logged yet)'}

Their equipment:
${kit.map((k) => `- ${k.name}${k.note ? ` (${k.note})` : ''}`).join('\n') || '(not logged; assume a basic hob, oven and pans)'}`;
  return { tomorrow, meal, mode, text };
}

// The AI fills in a form (a "tool") instead of writing JSON as text, so the reply always comes back in shape.
const LIGHT_SCHEMA = { type: 'object', properties: Object.fromEntries(['fat', 'saturates', 'sugar', 'salt'].map((k) => [k, { type: 'string', enum: ['low', 'medium', 'high'] }])) };

const SCHEMAS = {
  week: {
    type: 'object',
    properties: {
      nights: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'The night, exactly as given (YYYY-MM-DD)' },
            title: { type: 'string' },
            time: { type: 'string' },
            tag: { type: 'string' },
            why: { type: 'string' },
            missing: { type: 'array', items: { type: 'string' } },
            lights: LIGHT_SCHEMA,
            prep: { type: 'string' },
          },
          required: ['date', 'title', 'time', 'why'],
        },
      },
    },
    required: ['nights'],
  },
  packs: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'What to buy, plain words' },
            buy: { type: 'string', description: 'The pack(s) to buy, e.g. "1 x 600g tub"' },
            why: { type: 'string', description: 'Which nights it covers and any saving, e.g. "Covers Tue and Thu, cheaper than two 300g pots"' },
          },
          required: ['name', 'buy'],
        },
      },
    },
    required: ['items'],
  },
  cards: {
    type: 'object',
    properties: {
      ideas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: TYPES },
            title: { type: 'string' },
            time: { type: 'string' },
            tag: { type: 'string' },
            why: { type: 'string' },
            missing: { type: 'array', items: { type: 'string' } },
            lights: {
              type: 'object',
              properties: Object.fromEntries(['fat', 'saturates', 'sugar', 'salt'].map((k) => [k, { type: 'string', enum: ['low', 'medium', 'high'] }])),
            },
            prep: { type: 'string' },
          },
          required: ['type', 'title', 'time', 'why'],
        },
      },
    },
    required: ['ideas'],
  },
  recipe: {
    type: 'object',
    properties: {
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            amount: { type: 'string' },
            inStock: { type: 'boolean' },
            stockName: { type: ['string', 'null'] },
            use: {
              type: ['object', 'null'],
              properties: { n: { type: 'number' }, unit: { type: 'string', enum: ['g', 'ml', 'each'] }, word: { type: 'string' } },
            },
          },
          required: ['name', 'amount', 'inStock'],
        },
      },
      missing: { type: 'array', items: { type: 'string' } },
      steps: { type: 'array', items: { type: 'string' } },
      usedUp: { type: 'array', items: { type: 'string' } },
      tip: { type: 'string' },
      serves: { type: 'object', properties: { adults: { type: 'number' }, kids: { type: 'number' } } },
    },
    required: ['ingredients', 'steps'],
  },
};

async function ask(client, prompt, maxTokens, schema) {
  return withRetry(async () => {
    const msg = await askAi(client, {
      max_tokens: maxTokens,
      system: SYSTEM,
      tools: [{ name: 'answer', description: 'Give your answer by filling this in.', input_schema: SCHEMAS[schema] }],
      // This model doesn't allow forcing a tool, so offer it and ask for it in the prompt.
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: prompt }],
    }, { fast: true });
    const used = (msg.content || []).find((b) => b.type === 'tool_use');
    if (used && used.input && typeof used.input === 'object') {
      if (msg.stop_reason === 'max_tokens') throw new Error('Reply cut short (JSON incomplete)');
      return used.input;
    }
    return parseJson(replyText(msg));
  });
}

export async function POST(req) {
  const client = getClient();
  if (!client) return noKeyResponse();

  try {
    const b = await req.json();
    const { tomorrow, meal, mode, text } = context(b);

    // Plan the week: one dinner per night, joined up so nothing half-used is wasted.
    if (b.step === 'week') {
      const nights = (Array.isArray(b.nights) ? b.nights : []).slice(0, 7);
      if (!nights.length) return Response.json({ nights: [] });
      const keep = (Array.isArray(b.keep) ? b.keep : []).slice(0, 7);
      const r = await ask(
        client,
        `Plan weeknight dinners for a busy UK family, one per night, using what they already have.

Nights to plan (date, day, who's eating, anything asked for):
${nights.map((n) => `- ${n.date} (${n.day}): ${n.eaters || 'the household'}${n.request ? `; they asked for "${String(n.request).slice(0, 100)}"` : ''}`).join('\n')}
${keep.length ? `\nAlready planned, keep these and plan around them:\n${keep.map((k) => `- ${k.day}: ${k.title}`).join('\n')}` : ''}

${text}

How to plan:
- Use what needs eating soonest on the earliest nights.
- Join the week up: if one meal uses half a bunch of coriander, half a tub of yoghurt or half a bag of spinach, use the rest on another night. Planned leftovers are good (e.g. roast chicken on Monday, chicken wraps on Wednesday); say so in "why".
- Vary it across the week: different main proteins and cuisines, nothing twice.
- A night's request comes first for that night.
- Weeknights, so mostly 30 minutes or less; one slightly bigger one is fine.
- "missing" lists what to buy for that night (ideally 0 to 2 things).
- "lights": UK front-of-pack traffic lights per portion (low/medium/high for fat, saturates, sugar, salt).
- "prep" is one short sentence on anything to do the night before or that morning (soaking, marinating), or "".
- Return exactly one night per date given, using the same dates.

Give your answer by calling the "answer" tool.`,
        5000,
        'week'
      );
      const byDate = new Map((Array.isArray(r.nights) ? r.nights : []).filter((n) => n && n.title).map((n) => [String(n.date), n]));
      const out = nights.map((n, i) => {
        const x = byDate.get(String(n.date)) || (Array.isArray(r.nights) ? r.nights[i] : null);
        return x ? { date: n.date, ...cleanCard(x, 0), type: 'plan' } : null;
      });
      return Response.json({ nights: out });
    }

    // Pack sizes: turn the week's shopping needs into sensible packs to buy.
    if (b.step === 'packs') {
      const needs = (Array.isArray(b.needs) ? b.needs : []).slice(0, 60);
      if (!needs.length) return Response.json({ items: [] });
      const r = await ask(
        client,
        `Here's everything a UK family needs to buy for this week's dinners, with which nights need it:
${needs.map((n) => `- ${n.name}: ${n.amount || 'some'} (${(n.nights || []).join(', ')})`).join('\n')}

Turn this into a shopping list of real UK supermarket packs:
- Combine the same thing across nights into one line (e.g. 150g and 200g of Greek yoghurt → "1 x 500g tub").
- Pick the pack size that covers everything with least waste, and prefer one bigger pack over two small ones when it's usually better value; say so in "why".
- "buy" is the packs, e.g. "1 x 500g tub", "2 x 400g tins", "1 bunch".
- "why" says which nights it covers, e.g. "Tue and Thu".
- Don't add anything that isn't in the list.

Give your answer by calling the "answer" tool.`,
        2500,
        'packs'
      );
      const items = (Array.isArray(r.items) ? r.items : [])
        .filter((x) => x && x.name)
        .slice(0, 60)
        .map((x) => ({ name: String(x.name).slice(0, 60), buy: String(x.buy || '').slice(0, 40), why: String(x.why || '').slice(0, 100) }));
      return Response.json({ items });
    }

    if (b.step === 'recipe') {
      const idea = b.idea || {};
      const r = await ask(
        client,
        `Write the full recipe for this ${tomorrow ? "tomorrow's dinner" : meal} idea for a busy UK family: "${idea.title}"${idea.why ? ` (${idea.why})` : ''}${idea.time ? `, about ${idea.time}` : ''}.

${text}

Rules:
- Mostly use what they have. Salt, pepper and cooking oil are always available. "missing" lists anything they need to buy (at most 2).
- Only use equipment they have. If the oven has a quirk, put a short warning in "tip", otherwise "tip" is "".
- "ingredients" lists every ingredient with an amount for the household; "inStock" is true if it's in their stock.
- "serves" says who those amounts are for, e.g. {"adults": 2, "kids": 2}. Use their household if it's given.
- Use realistic UK portion sizes, per adult (a child is roughly 60% of that):
  meat or fish (raw, boneless) 150–180g; mince 125g; pasta or rice (dry) 75–100g; potatoes 200–250g; veg on the side 80–100g;
  cheese 30–40g; dips like houmous, whipped feta or tzatziki 30–40g; pesto 1–1.5 tbsp; butter for cooking 10g; flatbreads or wraps 1–2.
- Check every count matches its weight, using typical UK pack sizes: a boneless chicken thigh fillet is about 110g (bone-in about 140g), a chicken breast about 160g, a salmon fillet about 120g, a sea bass fillet about 90g, a medium onion about 150g, a large egg about 60g, a garlic clove about 5g. So "350g (about 3 thighs)", never "about 4".
- Before answering, add up the main protein and carbs and make sure it's a normal amount for this household, not a party-sized one.
- For each ingredient from their stock, "stockName" is the stock item's name exactly as written above, and "use" is how much the recipe uses as {"n": number, "unit": "g" | "ml" | "each", "word": "tins"}, in the same unit as their stock amount where you can. Don't use more than they have. For ingredients not in stock, "stockName" and "use" are null.
- "usedUp" lists stock item names (exactly as written above) that this meal will finish completely. Never include salt, pepper or cooking oil.
- Steps: 3 to 6 short, clear steps in British English, with temperatures in °C.

Give your answer by calling the "answer" tool (don't write it as text), like this example:
{"ingredients": [{"name": "Chorizo", "amount": "Half a ring (110g)", "inStock": true, "stockName": "Chorizo", "use": {"n": 110, "unit": "g"}}], "missing": [], "steps": ["Slice the chorizo and fry for 3 minutes."], "usedUp": ["Chorizo"], "tip": ""}`,
        4000,
        'recipe'
      );
      return Response.json(cleanRecipe(r));
    }

    const avoid = (b.avoid || []).slice(0, 12);
    const r = await ask(
      client,
      `Suggest three ${tomorrow ? "ideas for TOMORROW's dinner" : `${meal} ideas`} for a busy UK family using what they already have.

Make the three deliberately different, in this order:
1. "type": "useup": built around whatever needs eating soonest.
2. "type": "quick": the ${mode === 'quick' ? 'quickest, done in 15 minutes or less' : 'easiest of the three, still a bit special'}.
3. "type": "different": something a bit more interesting than they'd usually make, still mostly from what they have.
Don't build all three around the same main ingredient if you can avoid it.

${text}

${avoid.length ? `Don't suggest any of these again: ${avoid.join('; ')}.` : ''}

Rules:
- "why" is one short sentence on why it suits them, e.g. what it uses up.
- Anything marked "saved for" another night's planned dinner is off limits: don't use it.
- Mostly use what they have. "missing" lists at most 2 things to buy, ideally none. Salt, pepper and cooking oil are always available.
- "lights": UK front-of-pack traffic lights for one portion, each "low", "medium" or "high" (per portion: high is fat over 21g, saturates over 6g, sugar over 15g, salt over 1.8g; low is fat 3g or less, saturates 1.5g or less, sugar 5g or less, salt 0.3g or less).
- ${tomorrow ? `They're planning ahead late in the evening. "prep" is one short sentence on anything to do tonight to be ready (e.g. "Take the chicken thighs out of the freezer before bed."), or "" if nothing is needed.` : '"prep" is "".'}

Give exactly three ideas by calling the "answer" tool (don't write them as text), like this example:
{"ideas": [{"type": "useup", "title": "Chorizo and chickpea one-pan", "time": "15 mins", "tag": "One pan, hob only", "why": "Uses up your chorizo before it goes off.", "missing": [], "lights": {"fat": "medium", "saturates": "medium", "sugar": "low", "salt": "high"}, "prep": ""}]}`,
      4000,
      'cards'
    );
    const list = (Array.isArray(r.ideas) ? r.ideas : []).filter((x) => x && x.title).slice(0, 3).map(cleanCard);
    if (!list.length) throw new Error('No ideas came back');
    return Response.json({ ideas: list });
  } catch (e) {
    return failResponse(e);
  }
}
