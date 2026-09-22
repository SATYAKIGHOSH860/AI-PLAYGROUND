import type { LanguageId, ServerRunResult } from './types';
import { LANGUAGES } from './languages';

/**
 * Server-side execution providers.
 *
 * The public Piston API became whitelist-only in Feb 2026, so the default
 * keyless provider is Wandbox, with Paiza as a fallback. A self-hosted Piston
 * instance takes priority whenever PISTON_URL is set - that is the recommended
 * production setup because it has no third-party rate limits.
 */

export class ExecutionError extends Error {
  status: number;
  /** Infrastructure failures are retryable on the next provider. */
  retryable: boolean;

  constructor(message: string, status = 502, retryable = true) {
    super(message);
    this.name = 'ExecutionError';
    this.status = status;
    this.retryable = retryable;
  }
}

export interface ExecuteRequest {
  language: LanguageId;
  code: string;
  stdin: string;
}

interface Provider {
  name: string;
  isConfigured: () => boolean;
  execute: (req: ExecuteRequest, signal: AbortSignal) => Promise<ServerRunResult>;
}

/** Total budget for one /api/run request, across every provider attempt. */
export const RUN_TIMEOUT_MS = clampInt(process.env.RUN_TIMEOUT_MS, 45_000, 3_000, 55_000);

/**
 * Ceiling for a single provider. Deliberately below RUN_TIMEOUT_MS so that a
 * provider having a slow minute is abandoned early and the next one still has
 * time to answer, instead of burning the whole budget on one attempt.
 */
const PROVIDER_TIMEOUT_MS = clampInt(process.env.PROVIDER_TIMEOUT_MS, 25_000, 3_000, 50_000);

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * A process killed by signal N exits with 128+N on POSIX shells. Turning that
 * back into a name is the difference between "exit 139" and "segmentation
 * fault", which is the whole point of an online compiler.
 */
const SIGNALS: Record<number, string> = {
  1: 'SIGHUP',
  2: 'SIGINT',
  4: 'SIGILL',
  6: 'SIGABRT',
  8: 'SIGFPE',
  9: 'SIGKILL',
  11: 'SIGSEGV',
  13: 'SIGPIPE',
  15: 'SIGTERM',
  24: 'SIGXCPU',
  25: 'SIGXFSZ',
};

const SIGNAL_HINTS: Record<string, string> = {
  SIGABRT: 'aborted (uncaught exception or assertion failure)',
  SIGFPE: 'arithmetic error (often integer division by zero)',
  SIGSEGV: 'segmentation fault (invalid memory access)',
  SIGKILL: 'killed - execution time or memory limit exceeded',
  SIGXCPU: 'killed - CPU time limit exceeded',
  SIGTERM: 'terminated by the sandbox',
  SIGINT: 'interrupted',
  SIGPIPE: 'broken pipe',
};

export function describeSignal(signal: string | null | undefined, exitCode: number | null): string | undefined {
  let name = signal && signal.trim() ? signal.trim().toUpperCase() : null;
  if (!name && typeof exitCode === 'number' && exitCode > 128 && exitCode < 160) {
    name = SIGNALS[exitCode - 128] ?? null;
  }
  if (!name) return undefined;
  if (!name.startsWith('SIG')) name = `SIG${name}`;
  const hint = SIGNAL_HINTS[name];
  return hint ? `${name} - ${hint}` : name;
}

/**
 * Providers compile the snippet under their own file name (Wandbox uses
 * prog.cc, Paiza uses its own). Showing the user "prog.cc:3" when their tab
 * says main.cpp is confusing, and it also stops the diagnostics parser from
 * matching Python tracebacks, so we rewrite it to the editor's file name.
 */
const SOURCE_NAME_RE = /(?:[\w./-]*\/)?\b(?:prog|source|main|Main)\.(?:c|cc|cpp|cxx|py)\b/g;

function rewriteSourceName(text: string, filename: string): string {
  return text ? text.replace(SOURCE_NAME_RE, filename) : text;
}

/** True when compiler output contains a real error (warnings alone don't count). */
function hasCompileError(text: string): boolean {
  return /(^|\n)[^\n]*?:\d+:(?:\d+:)?\s*(?:fatal error|error):/.test(text);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  outerSignal: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  outerSignal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    outerSignal.removeEventListener('abort', onAbort);
  }
}

// ---------------------------------------------------------------------------
// Wandbox - https://wandbox.org  (keyless, synchronous, default provider)
// ---------------------------------------------------------------------------

const WANDBOX_URL = (process.env.WANDBOX_URL ?? 'https://wandbox.org').replace(/\/+$/, '');

const WANDBOX_COMPILERS: Record<LanguageId, { compiler: string; options: string; toolchain: string }> = {
  // -O2 keeps hot loops fast; -Wall/-Wextra surface the mistakes a learner
  // actually makes, which is the point of the Problems panel.
  c: { compiler: 'gcc-13.2.0-c', options: '-std=c17\n-O2\n-Wall\n-Wextra', toolchain: 'gcc 13.2.0 (C17)' },
  cpp: { compiler: 'gcc-13.2.0', options: '-std=c++17\n-O2\n-Wall\n-Wextra', toolchain: 'g++ 13.2.0 (C++17)' },
  python: { compiler: 'cpython-3.12.7', options: '', toolchain: 'CPython 3.12.7' },
};

const wandbox: Provider = {
  name: 'wandbox',
  isConfigured: () => true,
  async execute({ language, code, stdin }, signal) {
    const cfg = WANDBOX_COMPILERS[language];
    const started = Date.now();

    const res = await fetchWithTimeout(
      `${WANDBOX_URL}/api/compile.json`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          compiler: cfg.compiler,
          code,
          stdin,
          ...(cfg.options ? { 'compiler-option-raw': cfg.options } : {}),
          save: false,
        }),
      },
      PROVIDER_TIMEOUT_MS,
      signal,
    );

    if (res.status === 429) throw new ExecutionError('Wandbox rate limit reached.', 429);
    if (!res.ok) throw new ExecutionError(`Wandbox responded with HTTP ${res.status}.`);

    const data = (await res.json()) as Record<string, unknown>;
    const compileOutput = String(data.compiler_error ?? '');
    const compileFailed = language !== 'python' && hasCompileError(compileOutput);
    const rawStatus = Number.parseInt(String(data.status ?? ''), 10);
    const exitCode = Number.isFinite(rawStatus) ? rawStatus : null;

    return {
      provider: 'wandbox',
      toolchain: cfg.toolchain,
      compileOutput,
      compileFailed,
      stdout: String(data.program_output ?? ''),
      stderr: String(data.program_error ?? ''),
      exitCode: compileFailed ? null : exitCode,
      killedBy: compileFailed ? undefined : describeSignal(String(data.signal ?? ''), exitCode),
      timeMs: Date.now() - started,
    };
  },
};

// ---------------------------------------------------------------------------
// Paiza.io - https://paiza.io  (keyless "guest" tier, async create/poll)
// ---------------------------------------------------------------------------

const PAIZA_URL = (process.env.PAIZA_URL ?? 'https://api.paiza.io').replace(/\/+$/, '');

/**
 * Paiza compiles with clang, not gcc (verified: clang 14 for C, clang 18 for
 * C++, CPython 3.11). The label says so and names the provider, because clang
 * words its diagnostics differently - "use of undeclared identifier" where gcc
 * says "was not declared in this scope" - and a user who fell through to the
 * fallback deserves to know why the message changed shape. No version number
 * here on purpose: Paiza upgrades its images and a stale number would lie.
 */
const PAIZA_LANGUAGES: Record<LanguageId, { language: string; toolchain: string }> = {
  c: { language: 'c', toolchain: 'clang (C, Paiza)' },
  cpp: { language: 'cpp', toolchain: 'clang (C++, Paiza)' },
  python: { language: 'python3', toolchain: 'CPython 3 (Paiza)' },
};

const paiza: Provider = {
  name: 'paiza',
  isConfigured: () => true,
  async execute({ language, code, stdin }, signal) {
    const cfg = PAIZA_LANGUAGES[language];
    const apiKey = process.env.PAIZA_API_KEY ?? 'guest';
    const started = Date.now();
    const deadline = started + PROVIDER_TIMEOUT_MS;

    const form = (o: Record<string, string>) => new URLSearchParams(o).toString();

    const createRes = await fetchWithTimeout(
      `${PAIZA_URL}/runners/create`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form({ source_code: code, language: cfg.language, input: stdin, api_key: apiKey }),
      },
      Math.max(2_000, deadline - Date.now()),
      signal,
    );

    if (createRes.status === 429) throw new ExecutionError('Paiza rate limit reached.', 429);
    if (!createRes.ok) throw new ExecutionError(`Paiza responded with HTTP ${createRes.status}.`);

    const created = (await createRes.json()) as { id?: string; status?: string; error?: string };
    if (created.error) throw new ExecutionError(`Paiza error: ${created.error}`);
    if (!created.id) throw new ExecutionError('Paiza did not return a job id.');

    let status = created.status ?? 'running';
    while (status !== 'completed') {
      if (Date.now() >= deadline) throw new ExecutionError('Paiza job did not finish in time.', 504);
      await new Promise((r) => setTimeout(r, 350));
      const statusRes = await fetchWithTimeout(
        `${PAIZA_URL}/runners/get_status?${form({ id: created.id, api_key: apiKey })}`,
        { method: 'GET' },
        Math.max(2_000, deadline - Date.now()),
        signal,
      );
      if (!statusRes.ok) throw new ExecutionError(`Paiza status check failed (HTTP ${statusRes.status}).`);
      status = String(((await statusRes.json()) as { status?: string }).status ?? 'running');
    }

    const detailRes = await fetchWithTimeout(
      `${PAIZA_URL}/runners/get_details?${form({ id: created.id, api_key: apiKey })}`,
      { method: 'GET' },
      Math.max(2_000, deadline - Date.now()),
      signal,
    );
    if (!detailRes.ok) throw new ExecutionError(`Paiza details failed (HTTP ${detailRes.status}).`);

    const d = (await detailRes.json()) as Record<string, unknown>;
    const compileOutput = [String(d.build_stdout ?? ''), String(d.build_stderr ?? '')].filter(Boolean).join('');
    const compileFailed = String(d.build_result ?? 'success') !== 'success';
    const rawExit = Number.parseInt(String(d.exit_code ?? ''), 10);
    const exitCode = Number.isFinite(rawExit) ? rawExit : null;

    return {
      provider: 'paiza',
      toolchain: cfg.toolchain,
      compileOutput,
      compileFailed,
      stdout: String(d.stdout ?? ''),
      stderr: String(d.stderr ?? ''),
      exitCode: compileFailed ? null : exitCode,
      killedBy:
        String(d.result ?? '') === 'timeout'
          ? 'killed - execution time limit exceeded'
          : compileFailed
            ? undefined
            : describeSignal(null, exitCode),
      timeMs: Date.now() - started,
    };
  },
};

// ---------------------------------------------------------------------------
// Piston - self-hosted only (https://github.com/engineer-man/piston)
// ---------------------------------------------------------------------------

const PISTON_URL = (process.env.PISTON_URL ?? '').replace(/\/+$/, '');

const PISTON_LANGUAGES: Record<LanguageId, string> = { c: 'c', cpp: 'c++', python: 'python' };

let pistonVersions: { at: number; map: Record<string, string> } | null = null;

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function resolvePistonVersion(language: string, signal: AbortSignal): Promise<string> {
  const fresh = pistonVersions && Date.now() - pistonVersions.at < 10 * 60_000;
  if (!fresh) {
    const res = await fetchWithTimeout(`${PISTON_URL}/runtimes`, { method: 'GET' }, 8_000, signal);
    if (!res.ok) throw new ExecutionError(`Piston runtimes failed (HTTP ${res.status}).`);
    const runtimes = (await res.json()) as Array<{ language: string; version: string }>;
    const map: Record<string, string> = {};
    for (const rt of runtimes) {
      if (!map[rt.language] || compareVersions(rt.version, map[rt.language]) > 0) {
        map[rt.language] = rt.version;
      }
    }
    pistonVersions = { at: Date.now(), map };
  }
  const version = pistonVersions?.map[language];
  if (!version) throw new ExecutionError(`Piston has no runtime for "${language}".`, 501, false);
  return version;
}

const piston: Provider = {
  name: 'piston',
  isConfigured: () => PISTON_URL.length > 0,
  async execute({ language, code, stdin }, signal) {
    const pistonLang = PISTON_LANGUAGES[language];
    const started = Date.now();
    const version = await resolvePistonVersion(pistonLang, signal);

    const res = await fetchWithTimeout(
      `${PISTON_URL}/execute`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          language: pistonLang,
          version,
          files: [{ name: LANGUAGES[language].filename, content: code }],
          stdin,
          args: [],
          compile_timeout: 10_000,
          run_timeout: 6_000,
        }),
      },
      PROVIDER_TIMEOUT_MS,
      signal,
    );

    if (res.status === 429) throw new ExecutionError('Piston rate limit reached.', 429);
    if (!res.ok) throw new ExecutionError(`Piston responded with HTTP ${res.status}.`);

    const data = (await res.json()) as {
      compile?: { stdout?: string; stderr?: string; code?: number; signal?: string };
      run?: { stdout?: string; stderr?: string; code?: number; signal?: string };
    };

    const compileOutput = [data.compile?.stdout ?? '', data.compile?.stderr ?? ''].filter(Boolean).join('');
    const compileFailed = typeof data.compile?.code === 'number' && data.compile.code !== 0;
    const exitCode = typeof data.run?.code === 'number' ? data.run.code : null;

    return {
      provider: 'piston',
      toolchain: `${pistonLang} ${version}`,
      compileOutput,
      compileFailed,
      stdout: data.run?.stdout ?? '',
      stderr: data.run?.stderr ?? '',
      exitCode: compileFailed ? null : exitCode,
      killedBy: compileFailed ? undefined : describeSignal(data.run?.signal, exitCode),
      timeMs: Date.now() - started,
    };
  },
};

// ---------------------------------------------------------------------------

const ALL_PROVIDERS: Record<string, Provider> = { piston, wandbox, paiza };

function providerChain(): Provider[] {
  const requested = (process.env.EXECUTION_PROVIDERS ?? 'piston,wandbox,paiza')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const chain = requested.map((name) => ALL_PROVIDERS[name]).filter((p): p is Provider => Boolean(p));
  return (chain.length ? chain : [wandbox, paiza]).filter((p) => p.isConfigured());
}

export function availableProviders(): string[] {
  return providerChain().map((p) => p.name);
}

/** Runs the request against each configured provider until one answers. */
export async function executeCode(req: ExecuteRequest, signal: AbortSignal): Promise<ServerRunResult> {
  const chain = providerChain();
  if (!chain.length) {
    throw new ExecutionError('No execution provider is configured.', 500, false);
  }

  const failures: string[] = [];

  for (const provider of chain) {
    if (signal.aborted) break;

    // Each attempt gets its own deadline so one sluggish provider cannot eat
    // the whole request budget and starve the fallbacks.
    const attempt = new AbortController();
    const onOuterAbort = () => attempt.abort();
    signal.addEventListener('abort', onOuterAbort, { once: true });
    const attemptTimer = setTimeout(() => attempt.abort(), PROVIDER_TIMEOUT_MS);

    try {
      const result = await provider.execute(req, attempt.signal);
      const filename = LANGUAGES[req.language].filename;
      result.compileOutput = rewriteSourceName(result.compileOutput, filename);
      // Only Python puts a file name in its runtime stderr (the traceback).
      if (req.language === 'python') result.stderr = rewriteSourceName(result.stderr, filename);
      return result;
    } catch (err) {
      // The caller gave up: the client disconnected or the route hit its
      // ceiling. Trying another provider would be pointless.
      if (signal.aborted) throw new ExecutionError('Run cancelled.', 499, false);

      const timedOut = attempt.signal.aborted;
      const message = err instanceof Error ? err.message : String(err);
      failures.push(
        `${provider.name}: ${timedOut ? `no response within ${Math.round(PROVIDER_TIMEOUT_MS / 1000)}s` : message}`,
      );

      // A timeout is always worth retrying elsewhere; a structural refusal
      // (such as an unsupported language) is not.
      if (!timedOut && err instanceof ExecutionError && !err.retryable) break;
    } finally {
      clearTimeout(attemptTimer);
      signal.removeEventListener('abort', onOuterAbort);
    }
  }

  if (signal.aborted) throw new ExecutionError('Run cancelled.', 499, false);

  throw new ExecutionError(`Every execution provider failed. ${failures.join(' | ')}`, 502, false);
}
