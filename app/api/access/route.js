import { getDb } from '@/lib/db';
import { clientId, inviteMatches, inviteRequired, slowDownResponse, underLimit } from '@/lib/guard';

export const dynamic = 'force-dynamic';

// Does the app need an invite code right now?
export async function GET() {
  return Response.json({ required: inviteRequired() });
}

// Check an invite code (limited, so it can't be guessed by trying lots).
export async function POST(req) {
  if (!inviteRequired()) return Response.json({ ok: true });
  const db = getDb();
  if (!(await underLimit(db, 'invite', clientId(req), 10, 3600))) return slowDownResponse();
  const body = await req.json().catch(() => ({}));
  if (inviteMatches(body.code)) return Response.json({ ok: true });
  return Response.json({ error: 'wrong_code', message: 'That invite code isn’t right. Check it and try again.' }, { status: 403 });
}
