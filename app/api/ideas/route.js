import { getClient, MODEL, parseJson, replyText, noKeyResponse, failResponse } from '@/lib/ai';

export const maxDuration = 60;

const SHAPE = `Return JSON only, in this shape:
{
  "title": "Chorizo and chickpea one-pan",
  "time": "15 mins",
  "tag": "One pan, hob only",
  "why": "Uses up your chorizo and yoghurt before they go off.",
  "ingredients": [{"name": "Chorizo", "amount": "Half a ring (110g)", "inStock": true, "stockName": "Chorizo", "use": {"n": 110, "unit": "g"}}],
  "missing": ["Fresh basil"],
  "steps": ["Slice the chorizo and fry for 3 minutes."],
  "usedUp": ["Chorizo"],
  "tip": "Your oven runs hot on the left, so turn the tray halfway."
}`;

export async function POST(req) {
  const client = getClient();
  if (!client) return noKeyResponse();

  try {
    const b = await req.json();
    const meal = b.meal || 'dinner';
    const mode = b.mode === 'fun' ? 'fun' : 'quick';
    const stock = (b.stock || []).slice(0, 200);
    const kit = (b.kit || []).slice(0, 60);
    const avoid = (b.avoid || []).slice(0, 10);

    const stockLines = stock
      .map((s) => `- ${s.name} (${s.qty || 'some'}; ${s.area}${s.daysLeft != null ? `; use within ${s.daysLeft} day(s)` : ''}${s.status ? `; ${s.status}` : ''})`)
      .join('\n');

    const prompt = `Suggest one ${meal} for a busy UK family using what they already have.

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
- Use up food that goes off soonest first, and say so in "why" (one short sentence).
- Mostly use what they have. Need at most 2 missing items, ideally 0. Salt, pepper and cooking oil are always available.
- Only use equipment they have. If the oven has a quirk, put a short warning in "tip", otherwise "tip" is "".
- "ingredients" lists every ingredient with an amount for the household; "inStock" is true if it's in their stock.
- For each ingredient from their stock, "stockName" is the stock item's name exactly as written above, and "use" is how much of it the recipe uses as {"n": number, "unit": "g" | "ml" | "each", "word": "tins"}, in the same unit as their stock amount where you can (if they have "2 pints" of milk, use ml; if "6 eggs", use each). Don't use more than they have. For ingredients not in stock, "stockName" and "use" are null.
- "usedUp" lists stock item names (exactly as written above) that this meal will finish completely.
- Never take salt, pepper or cooking oil off their stock.
- Steps: 3 to 6 short, clear steps in British English, with temperatures in °C.

${SHAPE}`;

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system:
        "You are the kitchen assistant inside Yes Chef!, a UK app. The user is the chef; you're the helpful sous chef who does the admin. Suggest realistic, tasty family food that wastes nothing.",
      messages: [{ role: 'user', content: prompt }],
    });

    const r = parseJson(replyText(msg));
    return Response.json({
      title: r.title || 'Something tasty',
      time: r.time || '',
      tag: r.tag || '',
      why: r.why || '',
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      missing: Array.isArray(r.missing) ? r.missing : [],
      steps: Array.isArray(r.steps) ? r.steps : [],
      usedUp: Array.isArray(r.usedUp) ? r.usedUp : [],
      tip: r.tip || '',
    });
  } catch (e) {
    return failResponse(e);
  }
}
