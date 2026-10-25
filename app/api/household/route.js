import { COLLECTIONS, cleanCode, getDb, key, newCode } from '@/lib/db';

export const dynamic = 'force-dynamic';

function noDb() {
  return Response.json(
    { error: 'no_storage', message: 'Sharing isn’t switched on yet. Add an Upstash Redis database to the project in Vercel.' },
    { status: 503 }
  );
}

async function readAll(db, code) {
  const exists = await db.get(key(code, 'meta'));
  if (!exists) return null;
  const parts = await Promise.all([...COLLECTIONS, 'profile'].map((p) => db.get(key(code, p))));
  const out = {};
  [...COLLECTIONS, 'profile'].forEach((p, i) => {
    out[p] = parts[i] ?? (p === 'profile' ? {} : []);
  });
  return out;
}

// Load a household's shared kitchen.
export async function GET(req) {
  const db = getDb();
  if (!db) return noDb();
  const code = cleanCode(new URL(req.url).searchParams.get('code'));
  if (!code) return Response.json({ error: 'bad_code', message: 'That code doesn’t look right.' }, { status: 400 });
  const data = await readAll(db, code);
  if (!data) return Response.json({ error: 'not_found', message: 'I can’t find a household with that code.' }, { status: 404 });
  return Response.json(data);
}

// Create a household from this phone's kitchen.
export async function POST(req) {
  const db = getDb();
  if (!db) return noDb();
  const body = await req.json().catch(() => ({}));
  const data = body.data || {};
  let code = newCode();
  for (let i = 0; i < 5 && (await db.get(key(code, 'meta'))); i += 1) code = newCode();
  await db.set(key(code, 'meta'), { created: Date.now() });
  await Promise.all(COLLECTIONS.map((c) => db.set(key(code, c), Array.isArray(data[c]) ? data[c] : [])));
  await db.set(key(code, 'profile'), data.profile || {});
  return Response.json({ code });
}

// Apply changes from one phone: add or update items by id, and remove deleted ones.
export async function PATCH(req) {
  const db = getDb();
  if (!db) return noDb();
  const body = await req.json().catch(() => ({}));
  const code = cleanCode(body.code);
  const collection = body.collection;
  if (!code || !(await db.get(key(code, 'meta')))) {
    return Response.json({ error: 'not_found', message: 'I can’t find that household.' }, { status: 404 });
  }

  if (collection === 'profile') {
    await db.set(key(code, 'profile'), body.value || {});
    return Response.json({ ok: true });
  }
  if (!COLLECTIONS.includes(collection)) return Response.json({ error: 'bad_request' }, { status: 400 });

  const current = (await db.get(key(code, collection))) || [];
  const deletes = new Set(body.deletes || []);
  const upserts = (body.upserts || []).filter((u) => u && u.id);
  const byId = new Map(current.filter((x) => !deletes.has(x.id)).map((x) => [x.id, x]));
  upserts.forEach((u) => byId.set(u.id, u));
  const next = [...byId.values()];
  await db.set(key(code, collection), next);
  return Response.json({ ok: true, items: next });
}
