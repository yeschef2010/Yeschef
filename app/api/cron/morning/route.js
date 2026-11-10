import { runReminders } from '@/lib/cronRun';

export const dynamic = 'force-dynamic';

// About 8am UK: "Get the chicken out of the freezer for tonight".
export async function GET(req) {
  return runReminders(req, 'morning');
}
