import { NextResponse } from 'next/server';
import { executeCode, ExecutionError, RUN_TIMEOUT_MS } from '@/lib/providers';
import { isLanguageId } from '@/lib/languages';
import {
  acquireRun,
  clientIdentifier,
  rateLimitHeaders,
  rateLimitMessage,
  releaseRun,
} from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Must exceed RUN_TIMEOUT_MS so our own error wins over the platform's. */
export const maxDuration = 60;

const MAX_CODE_BYTES = 100_000;
const MAX_STDIN_BYTES = 64_000;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const { language, code, stdin } = (body ?? {}) as {
    language?: unknown;
    code?: unknown;
    stdin?: unknown;
  };

  if (!isLanguageId(language)) {
    return NextResponse.json(
      { error: 'Unsupported language. Use "python", "c" or "cpp".' },
      { status: 400 },
    );
  }
  if (typeof code !== 'string' || !code.trim()) {
    return NextResponse.json({ error: 'There is no code to run.' }, { status: 400 });
  }
  if (code.length > MAX_CODE_BYTES) {
    return NextResponse.json(
      { error: `Source is too large (limit ${MAX_CODE_BYTES.toLocaleString()} characters).` },
      { status: 413 },
    );
  }
  const input = typeof stdin === 'string' ? stdin : '';
  if (input.length > MAX_STDIN_BYTES) {
    return NextResponse.json(
      { error: `Input is too large (limit ${MAX_STDIN_BYTES.toLocaleString()} characters).` },
      { status: 413 },
    );
  }

  // Throttling happens after validation on purpose: rejecting a malformed
  // request costs nothing, so a buggy client should not burn a real user's
  // allowance. Only requests that are about to reach a compiler are counted.
  const client = clientIdentifier(request);
  const decision = acquireRun(client);

  if (!decision.allowed) {
    return NextResponse.json(
      { error: rateLimitMessage(decision) },
      { status: 429, headers: { ...rateLimitHeaders(decision), 'Cache-Control': 'no-store' } },
    );
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, RUN_TIMEOUT_MS);

  try {
    const result = await executeCode({ language, code, stdin: input }, controller.signal);
    return NextResponse.json(result, {
      headers: { ...rateLimitHeaders(decision), 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    // Checked first: our own deadline explains the failure better than the
    // generic "cancelled" the abort produces downstream.
    if (timedOut) {
      return NextResponse.json(
        {
          error:
            `No compiler answered within ${Math.round(RUN_TIMEOUT_MS / 1000)}s. ` +
            'The free public compiler services are busy - try again in a moment.',
        },
        { status: 504 },
      );
    }
    if (err instanceof ExecutionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Unknown execution failure.';
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timer);
    // Must always run, or the client's concurrency slot leaks and they get
    // locked out of their own quota.
    releaseRun(client);
  }
}
