import { getClient, MODEL, parseJson, replyText, noKeyResponse, failResponse, withRetry } from '@/lib/ai';

export const maxDuration = 30;

const SCHEMA = {
  type: 'object',
  properties: {
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'What to search for in the supermarket, 2-4 words, no brand' },
          note: { type: 'string', description: 'Short helpful note, e.g. size or why' },
        },
        required: ['name'],
      },
    },
  },
  required: ['options'],
};

// "Roast chicken" → a few sensible things to buy, each searched at the person's supermarket.
export async function POST(req) {
  const client = getClient();
  if (!client) return noKeyResponse();
  try {
    const b = await req.json();
    const item = String(b.item || '').slice(0, 80);
    if (!item.trim()) return Response.json({ options: [] });
    const prompt = `A UK family is adding "${item}" to their shopping list${b.shop ? ` for ${b.shop}` : ''}.
Household: ${b.household || 'not set'}. Dietary needs: ${b.dietary || 'none given'}.${b.why ? ` It's for: ${b.why}.` : ''}

If "${item}" is general and could mean quite different products (e.g. "roast chicken" could be a whole chicken, a crown, or ready-roasted), give 3 or 4 sensible options to choose between, best first. Size things for their household.
If it's already specific (e.g. "semi-skimmed milk", "basmati rice"), give 1 or 2 options at most, e.g. pack sizes.
Each "name" is what to type into the supermarket search: plain words, 2 to 4 words, no brands (e.g. "whole chicken", "chicken crown", "cooked whole chicken"). "note" is a few words: size, how many it feeds, or why (e.g. "About 1.6kg, feeds 4 with leftovers").

Give your answer by calling the "answer" tool.`;
    const r = await withRetry(async () => {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 800,
        system: 'You help a busy UK family shop sensibly at the supermarket. Be brief and practical.',
        tools: [{ name: 'answer', description: 'Give your answer by filling this in.', input_schema: SCHEMA }],
        tool_choice: { type: 'auto' },
        messages: [{ role: 'user', content: prompt }],
      });
      const used = (msg.content || []).find((x) => x.type === 'tool_use');
      return used && used.input ? used.input : parseJson(replyText(msg));
    });
    const options = (Array.isArray(r.options) ? r.options : [])
      .filter((o) => o && o.name)
      .slice(0, 4)
      .map((o) => ({ name: String(o.name).slice(0, 60), note: String(o.note || '').slice(0, 80) }));
    return Response.json({ options });
  } catch (e) {
    return failResponse(e);
  }
}
