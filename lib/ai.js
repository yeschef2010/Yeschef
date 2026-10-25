import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

export function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Pull the first JSON object out of the model's reply.
export function parseJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in reply');
  return JSON.parse(text.slice(start, end + 1));
}

export function replyText(msg) {
  return (msg.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

export function imageBlock(dataUrl) {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
}

export function noKeyResponse() {
  return Response.json(
    { error: 'missing_key', message: 'The AI isn’t switched on yet. Add your Anthropic API key in Vercel to turn it on.' },
    { status: 503 }
  );
}

export function failResponse(e) {
  console.error(e);
  return Response.json(
    { error: 'failed', message: 'Sorry Chef, I couldn’t work that one out. Try again in a moment.' },
    { status: 500 }
  );
}
