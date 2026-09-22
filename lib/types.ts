export type LanguageId = 'python' | 'c' | 'cpp';

/** Where the code actually executed. */
export type Engine = 'browser' | 'server';

/** What the user asked for. 'auto' picks the fastest engine per language. */
export type EnginePref = 'auto' | 'browser' | 'server';

export type OutputStream = 'stdout' | 'stderr' | 'compile' | 'system' | 'success' | 'failure';

export interface OutputChunk {
  id: number;
  stream: OutputStream;
  text: string;
}

export interface Diagnostic {
  line: number;
  column?: number;
  endColumn?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

/** Normalised result shape returned by /api/run, identical for every provider. */
export interface ServerRunResult {
  provider: string;
  /** Human readable toolchain, e.g. "gcc 13.2.0". */
  toolchain: string;
  /** Compiler diagnostics. Empty string for interpreted languages. */
  compileOutput: string;
  /** True when compilation failed, so the program never started. */
  compileFailed: boolean;
  stdout: string;
  stderr: string;
  /** Process exit status. null when the program never started. */
  exitCode: number | null;
  /** Set when the sandbox killed the process (timeout / signal). */
  killedBy?: string;
  /** Wall clock time spent inside the provider, in milliseconds. */
  timeMs: number;
}

export interface RunMeta {
  engine: Engine;
  toolchain: string;
  exitCode: number | null;
  timeMs: number;
  killedBy?: string;
  compileFailed?: boolean;
}
