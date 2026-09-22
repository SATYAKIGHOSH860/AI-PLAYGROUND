import type { OutputStream } from './types';

export interface BrowserRunResult {
  exitCode: number;
  timeMs: number;
  toolchain: string;
}

export class RunCancelledError extends Error {
  constructor() {
    super('Run stopped.');
    this.name = 'RunCancelledError';
  }
}

type OutputHandler = (stream: OutputStream, text: string) => void;
type StatusHandler = (status: string) => void;

/**
 * Thin wrapper around the Pyodide worker.
 *
 * Deliberately framework-free: React owns no part of the worker lifecycle, so
 * a re-render can never restart the Python runtime.
 */
export class BrowserPythonRunner {
  private worker: Worker | null = null;
  private pending: {
    resolve: (r: BrowserRunResult) => void;
    reject: (e: Error) => void;
  } | null = null;

  onOutput: OutputHandler = () => {};
  onStatus: StatusHandler = () => {};

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker('/pyodide-worker.js');

    worker.onmessage = (event: MessageEvent) => {
      const { type, payload } = (event.data ?? {}) as { type?: string; payload?: unknown };

      switch (type) {
        case 'stdout':
        case 'stderr':
          this.onOutput(type, String(payload ?? ''));
          break;
        case 'status':
          this.onStatus(String(payload ?? ''));
          break;
        case 'started':
          this.onStatus('running');
          break;
        case 'done': {
          const done = this.pending;
          this.pending = null;
          done?.resolve(payload as BrowserRunResult);
          break;
        }
        case 'fatal': {
          const failed = this.pending;
          this.pending = null;
          failed?.reject(new Error(String(payload ?? 'Python runtime failed.')));
          break;
        }
        default:
          break;
      }
    };

    worker.onerror = (event: ErrorEvent) => {
      const failed = this.pending;
      this.pending = null;
      // A load failure leaves the worker unusable; drop it so the next run
      // gets a clean one.
      this.worker = null;
      failed?.reject(new Error(event.message || 'Could not load the Python runtime.'));
    };

    this.worker = worker;
    return worker;
  }

  /** Warms the runtime up so the first Run is not a 10 MB download. */
  preload(): void {
    try {
      this.ensureWorker().postMessage({ type: 'preload' });
    } catch {
      /* Workers unavailable - the server engine still works. */
    }
  }

  run(code: string, stdin: string): Promise<BrowserRunResult> {
    if (this.pending) {
      return Promise.reject(new Error('A run is already in progress.'));
    }
    return new Promise<BrowserRunResult>((resolve, reject) => {
      this.pending = { resolve, reject };
      try {
        this.ensureWorker().postMessage({ type: 'run', code, stdin });
      } catch (err) {
        this.pending = null;
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /**
   * Terminating is the only reliable way to interrupt WASM mid-loop. The cost
   * is a reload of the runtime on the next run, served from HTTP cache.
   */
  stop(): void {
    const pending = this.pending;
    this.pending = null;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    pending?.reject(new RunCancelledError());
  }

  dispose(): void {
    this.pending = null;
    this.worker?.terminate();
    this.worker = null;
  }
}
