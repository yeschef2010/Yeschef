import { COLLECTIONS, cleanCode, getDb, key, newCode } from '@/lib/db';
import { accessResponse, clientId, hasAccess, slowDownResponse, underLimit } from '@/lib/guard';

export const dynamic = 'force-dynamic';

function noDb() {
  return Response.json(
    { error: 'no_storage', message: 'Sharing isn’t switched on yet. Add an Upstash Redis database to the project in Vercel.' },
    { status: 503 }
  );
}

const PARTS = [...COLLECTIONS, 'profile'];

// The household's revision number: it goes up on every change, so phones can check it cheaply.
const revOf = async (db, code) => Number((await db.get(key(code, 'rev'))) || 0);

async function readAll(db, code) {
  // One round trip for everything (meta first, to check the household exists).
  const values = await db.mget(key(code, 'meta'), key(code, 'rev'), ...PARTS.map((p) => key(code, p)));
  if (!values[0]) return null;
  const out = { rev: Number(values[1] || 0) };
  PARTS.forEach((p, i) => {
    out[p] = values[i + 2] ?? (p === 'profile' ? {} : []);
  });
  return out;
}

const notFound = () => Response.json({ error: 'not_found', message: 'I can’t find a household with that code.' }, { status: 404 });

// Wrong codes are limited per phone, so codes can't be guessed by trying lots.
async function wrongCode(db, req) {
  await underLimit(db, 'badcode', clientId(req), 1e9, 3600); // count it
  return notFound();
}
async function tooManyWrongCodes(db, req) {
  const k = `yc:rl:badcode:${clientId(req)}:${Math.floor(Date.now() / 1000 / 3600)}`;
  return Number((await db.get(k)) || 0) >= 20;
}

// Load a household's shared kitchen. With ?rev=N, only send it if something has changed since N.
export async function GET(req) {
  const db = getDb();
  if (!db) return noDb();
  const params = new URL(req.url).searchParams;
  const code = cleanCode(params.get('code'));
  if (!code) return Response.json({ error: 'bad_code', message: 'That code doesn’t look right.' }, { status: 400 });
  if (await tooManyWrongCodes(db, req)) return slowDownResponse();

  const since = params.get('rev');
  if (since !== null && since !== '') {
    const rev = await revOf(db, code);
    if (rev > 0 && rev === Number(since)) return Response.json({ same: true, rev });
  }
  const data = await readAll(db, code);
  if (!data) return wrongCode(db, req);
  return Response.json(data);
}

// Create a household from this phone's kitchen (needs the invite code when one is set).
export async function POST(req) {
  const db = getDb();
  if (!db) return noDb();
  if (!(await hasAccess(req, db))) return accessResponse();
  if (!(await underLimit(db, 'create', clientId(req), 10, 3600))) return slowDownResponse();
  const body = await req.json().catch(() => ({}));
  const data = body.data || {};
  let code = newCode();
  for (let i = 0; i < 5 && (await db.get(key(code, 'meta'))); i += 1) code = newCode();
  await db.set(key(code, 'meta'), { created: Date.now() });
  await Promise.all(COLLECTIONS.map((c) => db.set(key(code, c), Array.isArray(data[c]) ? data[c] : [])));
  await db.set(key(code, 'profile'), data.profile || {});
  const rev = await db.incr(key(code, 'rev'));
  return Response.json({ code, rev });
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
  if (!(await underLimit(db, 'write', code, 3000, 3600))) return slowDownResponse();

  if (collection === 'profile') {
    await db.set(key(code, 'profile'), body.value || {});
    const rev = await db.incr(key(code, 'rev'));
    return Response.json({ ok: true, rev });
  }
  if (!COLLECTIONS.includes(collection)) return Response.json({ error: 'bad_request' }, { status: 400 });

  const current = (await db.get(key(code, collection))) || [];
  const deletes = new Set(body.deletes || []);
  const upserts = (body.upserts || []).filter((u) => u && u.id);
  const byId = new Map(current.filter((x) => !deletes.has(x.id)).map((x) => [x.id, x]));
  upserts.forEach((u) => byId.set(u.id, u));
  const next = [...byId.values()];
  await db.set(key(code, collection), next);
  const rev = await db.incr(key(code, 'rev'));
  return Response.json({ ok: true, rev });
}
