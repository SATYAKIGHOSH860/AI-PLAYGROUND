/**
 * Per-client throttling for the execution endpoint.
 *
 * Two separate guards, because they protect two different things:
 *
 *   1. A sliding window caps how often one client may start a run. This is
 *      what keeps a script from hammering the shared public compiler services
 *      until they block this deployment's IP - which would break C/C++ for
 *      every visitor, not just the abuser.
 *
 *   2. A concurrency cap limits how many runs one client may have in flight.
 *      This is the one that protects the hosting bill: each C/C++ run holds a
 *      serverless function open for a couple of seconds, so fifty tabs all
 *      pressing Run at once is far more expensive than fifty runs spread out.
 *
 * State lives in module memory, which on a serverless host means "per warm
 * instance". That makes the limit approximate rather than exact: a client
 * spread across several instances gets a slightly higher effective allowance.
 * That is a deliberate trade - it catches the realistic abuse case (one client
 * looping against a warm instance) with no database, no signup and no cost.
 * Swap in a shared store later if you ever need an exact global limit.
 *
 * Addresses are held only in memory, never logged and never persisted.
 */

const WINDOW_MS = 60_000;

/** Above this many tracked clients we reset rather than grow without bound. */
const MAX_TRACKED_CLIENTS = 5_000;

function readLimit(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return value;
}

/** Runs per minute per client. 0 disables the window entirely. */
export const RUNS_PER_MINUTE = readLimit(process.env.RATE_LIMIT_PER_MINUTE, 15);

/** Simultaneous in-flight runs per client. 0 disables the cap. */
export const MAX_CONCURRENT_RUNS = readLimit(process.env.RATE_LIMIT_CONCURRENT, 2);

const recentRuns = new Map<string, number[]>();
const inFlight = new Map<string, number>();

let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < WINDOW_MS) return;
  lastSweep = now;

  for (const [client, times] of recentRuns) {
    const kept = times.filter((t) => now - t < WINDOW_MS);
    if (kept.length === 0) recentRuns.delete(client);
    else recentRuns.set(client, kept);
  }

  // Fail open rather than let a distributed flood grow the map without limit.
  // Briefly allowing traffic beats exhausting the instance's memory.
  if (recentRuns.size > MAX_TRACKED_CLIENTS) recentRuns.clear();
}

/**
 * Identifies the caller. On Vercel (and most proxies) x-real-ip is set by the
 * platform and cannot be forged by the client, so it is preferred over the
 * x-forwarded-for chain.
 */
export function clientIdentifier(request: Request): string {
  const realIp = request.headers.get('x-real-ip');
  if (realIp?.trim()) return realIp.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  if (first) return first;

  // Local development, or a host that strips the headers: everyone shares one
  // bucket, which is correct behaviour for a single-machine setup.
  return 'unknown';
}

export interface RateDecision {
  allowed: boolean;
  reason?: 'too-many-runs' | 'too-many-concurrent';
  /** Seconds until the client may retry. */
  retryAfter: number;
  limit: number;
  remaining: number;
}

/**
 * Records an attempt and says whether it may proceed. Call `releaseRun` in a
 * finally block for every allowed decision, or the concurrency slot leaks.
 */
export function acquireRun(client: string): RateDecision {
  const now = Date.now();
  sweep(now);

  const times = (recentRuns.get(client) ?? []).filter((t) => now - t < WINDOW_MS);
  const current = inFlight.get(client) ?? 0;
  const remaining = (used: number) => Math.max(0, RUNS_PER_MINUTE - used);

  // Nothing is committed until both guards pass, so a rejected request never
  // spends a slot or a token on a run that did not happen.

  if (MAX_CONCURRENT_RUNS > 0 && current >= MAX_CONCURRENT_RUNS) {
    recentRuns.set(client, times);
    return {
      allowed: false,
      reason: 'too-many-concurrent',
      // Runs are short; a couple of seconds is the honest wait.
      retryAfter: 2,
      limit: RUNS_PER_MINUTE,
      remaining: remaining(times.length),
    };
  }

  if (RUNS_PER_MINUTE > 0 && times.length >= RUNS_PER_MINUTE) {
    recentRuns.set(client, times);
    return {
      allowed: false,
      reason: 'too-many-runs',
      retryAfter: Math.max(1, Math.ceil((WINDOW_MS - (now - times[0])) / 1000)),
      limit: RUNS_PER_MINUTE,
      remaining: 0,
    };
  }

  if (RUNS_PER_MINUTE > 0) times.push(now);
  recentRuns.set(client, times);
  if (MAX_CONCURRENT_RUNS > 0) inFlight.set(client, current + 1);

  return {
    allowed: true,
    retryAfter: 0,
    limit: RUNS_PER_MINUTE,
    remaining: remaining(times.length),
  };
}

/** Frees the concurrency slot taken by an allowed `acquireRun`. */
export function releaseRun(client: string): void {
  if (MAX_CONCURRENT_RUNS <= 0) return;
  const current = inFlight.get(client) ?? 0;
  if (current <= 1) inFlight.delete(client);
  else inFlight.set(client, current - 1);
}

export function rateLimitMessage(decision: RateDecision): string {
  if (decision.reason === 'too-many-concurrent') {
    return (
      `You already have ${MAX_CONCURRENT_RUNS} runs in progress. ` +
      'Wait for one to finish, then try again.'
    );
  }
  return (
    `Too many runs from this connection (limit ${RUNS_PER_MINUTE} per minute). ` +
    `Try again in ${decision.retryAfter}s.`
  );
}

/** Headers describing the current allowance, per the IETF RateLimit draft. */
export function rateLimitHeaders(decision: RateDecision): Record<string, string> {
  const headers: Record<string, string> = {};
  if (RUNS_PER_MINUTE > 0) {
    headers['RateLimit-Limit'] = String(decision.limit);
    headers['RateLimit-Remaining'] = String(decision.remaining);
    headers['RateLimit-Reset'] = String(decision.retryAfter || 60);
  }
  if (!decision.allowed) headers['Retry-After'] = String(decision.retryAfter);
  return headers;
}
