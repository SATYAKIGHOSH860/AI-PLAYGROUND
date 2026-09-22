import { NextResponse } from 'next/server';
import { availableProviders, RUN_TIMEOUT_MS } from '@/lib/providers';
import { MAX_CONCURRENT_RUNS, RUNS_PER_MINUTE } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Quick way to confirm which execution providers a deployment will use. */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      providers: availableProviders(),
      runTimeoutMs: RUN_TIMEOUT_MS,
      selfHostedPiston: Boolean(process.env.PISTON_URL),
      rateLimit: {
        runsPerMinute: RUNS_PER_MINUTE || 'disabled',
        maxConcurrent: MAX_CONCURRENT_RUNS || 'disabled',
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
