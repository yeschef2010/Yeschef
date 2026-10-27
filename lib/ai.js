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

// Turn whatever went wrong into a plain message, so the app says what actually happened.
export function explainError(e) {
  const status = e && (e.status || e.statusCode);
  const text = `${(e && e.message) || ''} ${JSON.stringify((e && e.error) || '')}`.toLowerCase();
  if (/credit balance|billing|purchase credits|insufficient/.test(text))
    return { code: 'credit', status: 402, message: 'The AI has run out of credit. Top up at console.anthropic.com → Billing, then try again.' };
  if (status === 401 || /authentication|invalid x-api-key|api key/.test(text))
    return { code: 'key', status: 401, message: 'The AI key isn’t working. Check ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables.' };
  if (status === 404 || /model/.test(text) && /not.?found|does not exist/.test(text))
    return { code: 'model', status: 500, message: 'The AI model name isn’t recognised. Check ANTHROPIC_MODEL in Vercel, or remove it to use the default.' };
  if (status === 429 || /rate.?limit/.test(text))
    return { code: 'busy', status: 429, message: 'Lots of requests at once. Give it a minute and try again.' };
  if (status === 529 || /overloaded/.test(text))
    return { code: 'overloaded', status: 503, message: 'The AI is very busy right now. Try again in a moment.' };
  if (/json|no json|unexpected token|unterminated/.test(text))
    return { code: 'garbled', status: 500, message: 'Sorry Chef, my answer came back jumbled. Try again.' };
  if (/timeout|timed out|aborted/.test(text))
    return { code: 'slow', status: 504, message: 'That took too long. Try again.' };
  return { code: 'other', status: 500, message: 'Sorry Chef, I couldn’t work that one out. Try again in a moment.' };
}

export function failResponse(e) {
  const x = explainError(e);
  console.error(`[yes-chef] ${x.code}:`, e);
  return Response.json({ error: x.code, message: `${x.message} (${x.code})` }, { status: x.status });
}

// Worth one more go: the AI was busy, or its reply didn't come back as clean JSON.
export async function withRetry(fn) {
  try {
    return await fn();
  } catch (e) {
    const code = explainError(e).code;
    if (code !== 'garbled' && code !== 'overloaded' && code !== 'other') throw e;
    await new Promise((r) => setTimeout(r, 1200));
    return fn();
  }
}

export function documentBlock(dataUrl) {
  const m = /^data:application\/pdf;base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: m[1] } };
}
