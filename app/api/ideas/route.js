import { getClient, MODEL, parseJson, replyText, noKeyResponse, failResponse } from '@/lib/ai';

export const maxDuration = 60;

const SHAPE = `Return JSON only: {"ideas": [three ideas]}, each in this shape:
{
  "type": "useup",
  "title": "Chorizo and chickpea one-pan",
  "time": "15 mins",
  "tag": "One pan, hob only",
  "why": "Uses up your chorizo and yoghurt before they go off.",
  "ingredients": [{"name": "Chorizo", "amount": "Half a ring (110g)", "inStock": true, "stockName": "Chorizo", "use": {"n": 110, "unit": "g"}}],
  "missing": ["Fresh basil"],
  "steps": ["Slice the chorizo and fry for 3 minutes."],
  "usedUp": ["Chorizo"],
  "tip": "Your oven runs hot on the left, so turn the tray halfway.",
  "lights": {"fat": "medium", "saturates": "low", "sugar": "low", "salt": "high"},
  "prep": ""
}`;

const clean = (r, i) => ({
  type: ['useup', 'quick', 'different'].includes(r.type) ? r.type : ['useup', 'quick', 'different'][i] || 'different',
  title: r.title || 'Something tasty',
  time: r.time || '',
  tag: r.tag || '',
  why: r.why || '',
  ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
  missing: Array.isArray(r.missing) ? r.missing : [],
  steps: Array.isArray(r.steps) ? r.steps : [],
  usedUp: Array.isArray(r.usedUp) ? r.usedUp : [],
  tip: r.tip || '',
  lights: Object.fromEntries(['fat', 'saturates', 'sugar', 'salt'].map((k) => [k, ['low', 'medium', 'high'].includes(r.lights?.[k]) ? r.lights[k] : null])),
  prep: r.prep || '',
});

export async function POST(req) {
  const client = getClient();
  if (!client) return noKeyResponse();

  try {
    const b = await req.json();
    const tomorrow = b.meal === 'tomorrow';
    const meal = tomorrow ? 'dinner' : b.meal || 'dinner';
    const mode = b.mode === 'fun' ? 'fun' : 'quick';
    const stock = (b.stock || []).slice(0, 200);
    const kit = (b.kit || []).slice(0, 60);
    const avoid = (b.avoid || []).slice(0, 10);

    const stockLines = stock
      .map((s) => `- ${s.name} (${s.qty || 'some'}; ${s.area}${s.daysLeft != null ? `; use within ${s.daysLeft} day(s)` : ''}${s.status ? `; ${s.status}` : ''})`)
      .join('\n');

    const prompt = `Suggest three ${tomorrow ? "ideas for TOMORROW's dinner" : `${meal} ideas`} for a busy UK family using what they already have.

Make the three deliberately different, in this order:
1. "type": "useup": built around whatever needs eating soonest.
2. "type": "quick": the ${mode === 'quick' ? 'quickest, done in 15 minutes or less' : 'easiest of the three, still a bit special'}.
3. "type": "different": something a bit more interesting than they'd usually make, still mostly from what they have.
Don't repeat a main ingredient across all three if you can avoid it.
${tomorrow ? `It's late evening, so they're planning ahead. In "prep", say in one short sentence what to do tonight to be ready (e.g. "Take the chicken thighs out of the freezer before bed." or "Pop the beans in to soak."), or "" if nothing is needed.` : '"prep" is "".'}

Household: ${b.household || 'not set'}
Dietary needs: ${b.dietary || 'none given'}
Style: ${mode === 'quick' ? 'Quick and easy: 15 minutes or less where possible, few pans, minimal washing up.' : 'Fun in the kitchen: they have time and want something a bit special, but still realistic at home.'}
${b.context ? `Context: ${b.context}` : ''}

Their stock:
${stockLines || '(nothing logged yet)'}

Their equipment:
${kit.map((k) => `- ${k.name}${k.note ? ` (${k.note})` : ''}`).join('\n') || '(not logged; assume a basic hob, oven and pans)'}

${avoid.length ? `Don't suggest any of these again: ${avoid.join('; ')}.` : ''}

Rules:
- Say in "why" (one short sentence) why this idea suits them, e.g. what it uses up.
- Mostly use what they have. Need at most 2 missing items, ideally 0. Salt, pepper and cooking oil are always available.
- Only use equipment they have. If the oven has a quirk, put a short warning in "tip", otherwise "tip" is "".
- "ingredients" lists every ingredient with an amount for the household; "inStock" is true if it's in their stock.
- For each ingredient from their stock, "stockName" is the stock item's name exactly as written above, and "use" is how much of it the recipe uses as {"n": number, "unit": "g" | "ml" | "each", "word": "tins"}, in the same unit as their stock amount where you can (if they have "2 pints" of milk, use ml; if "6 eggs", use each). Don't use more than they have. For ingredients not in stock, "stockName" and "use" are null.
- "usedUp" lists stock item names (exactly as written above) that this meal will finish completely.
- Never take salt, pepper or cooking oil off their stock.
- "lights": UK front-of-pack traffic lights for one portion: "fat", "saturates", "sugar" and "salt", each "low", "medium" or "high" (UK guidance: per portion, high fat over 21g, saturates over 6g, sugar over 15g, salt over 1.8g; low is fat 3g or less, saturates 1.5g or less, sugar 5g or less, salt 0.3g or less).
- Steps: 3 to 6 short, clear steps in British English, with temperatures in °C.

${SHAPE}`;

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 7000,
      system:
        "You are the kitchen assistant inside Yes Chef!, a UK app. The user is the chef; you're the helpful sous chef who does the admin. Suggest realistic, tasty family food that wastes nothing.",
      messages: [{ role: 'user', content: prompt }],
    });

    const r = parseJson(replyText(msg));
    const list = (Array.isArray(r.ideas) ? r.ideas : [r]).filter((x) => x && x.title).slice(0, 3).map(clean);
    if (!list.length) throw new Error('No ideas came back');
    return Response.json({ ideas: list });
  } catch (e) {
    return failResponse(e);
  }
}
