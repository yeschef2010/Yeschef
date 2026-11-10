import { runReminders } from '@/lib/cronRun';

export const dynamic = 'force-dynamic';

// About 8pm UK: big things to defrost overnight for tomorrow, and on Sundays "Want to plan the week?".
export async function GET(req) {
  return runReminders(req, 'evening');
}
