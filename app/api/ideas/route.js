import { getClient, MODEL, parseJson, replyText, noKeyResponse, failResponse, withRetry } from '@/lib/ai';

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
});

const SYSTEM =
  "You are the kitchen assistant inside Yes Chef!, a UK app. The user is the chef; you're the helpful sous chef who does the admin. Suggest realistic, tasty family food that wastes nothing.";

function context(b) {
  const tomorrow = b.meal === 'tomorrow';
  const meal = tomorrow ? 'dinner' : b.meal || 'dinner';
  const mode = b.mode === 'fun' ? 'fun' : 'quick';
  const stock = (b.stock || []).slice(0, 200);
  const kit = (b.kit || []).slice(0, 60);
  const stockLines = stock
    .map((s) => `- ${s.name} (${s.qty || 'some'}; ${s.area}${s.daysLeft != null ? `; use within ${s.daysLeft} day(s)` : ''}${s.status ? `; ${s.status}` : ''})`)
    .join('\n');
  const text = `Household: ${b.household || 'not set'}
Dietary needs: ${b.dietary || 'none given'}
Style: ${mode === 'quick' ? 'Quick and easy: 15 minutes or less where possible, few pans, minimal washing up.' : 'Fun in the kitchen: they have time and want something a bit special, but still realistic at home.'}
${b.context ? `Context: ${b.context}` : ''}

Their stock:
${stockLines || '(nothing logged yet)'}

Their equipment:
${kit.map((k) => `- ${k.name}${k.note ? ` (${k.note})` : ''}`).join('\n') || '(not logged; assume a basic hob, oven and pans)'}`;
  return { tomorrow, meal, mode, text };
}

// The AI fills in a form (a "tool") instead of writing JSON as text, so the reply always comes back in shape.
const SCHEMAS = {
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
    },
    required: ['ingredients', 'steps'],
  },
};

async function ask(client, prompt, maxTokens, schema) {
  return withRetry(async () => {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM,
      tools: [{ name: 'answer', description: 'Give your answer by filling this in.', input_schema: SCHEMAS[schema] }],
      tool_choice: { type: 'tool', name: 'answer' },
      messages: [{ role: 'user', content: prompt }],
    });
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
- For each ingredient from their stock, "stockName" is the stock item's name exactly as written above, and "use" is how much the recipe uses as {"n": number, "unit": "g" | "ml" | "each", "word": "tins"}, in the same unit as their stock amount where you can. Don't use more than they have. For ingredients not in stock, "stockName" and "use" are null.
- "usedUp" lists stock item names (exactly as written above) that this meal will finish completely. Never include salt, pepper or cooking oil.
- Steps: 3 to 6 short, clear steps in British English, with temperatures in °C.

Fill in the answer form, like this example:
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
- Mostly use what they have. "missing" lists at most 2 things to buy, ideally none. Salt, pepper and cooking oil are always available.
- "lights": UK front-of-pack traffic lights for one portion, each "low", "medium" or "high" (per portion: high is fat over 21g, saturates over 6g, sugar over 15g, salt over 1.8g; low is fat 3g or less, saturates 1.5g or less, sugar 5g or less, salt 0.3g or less).
- ${tomorrow ? `They're planning ahead late in the evening. "prep" is one short sentence on anything to do tonight to be ready (e.g. "Take the chicken thighs out of the freezer before bed."), or "" if nothing is needed.` : '"prep" is "".'}

Fill in the answer form with exactly three ideas, like this example:
{"ideas": [{"type": "useup", "title": "Chorizo and chickpea one-pan", "time": "15 mins", "tag": "One pan, hob only", "why": "Uses up your chorizo before it goes off.", "missing": [], "lights": {"fat": "medium", "saturates": "medium", "sugar": "low", "salt": "high"}, "prep": ""}]}`,
      2500,
      'cards'
    );
    const list = (Array.isArray(r.ideas) ? r.ideas : []).filter((x) => x && x.title).slice(0, 3).map(cleanCard);
    if (!list.length) throw new Error('No ideas came back');
    return Response.json({ ideas: list });
  } catch (e) {
    return failResponse(e);
  }
}
