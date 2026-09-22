/* eslint-disable no-undef */
/**
 * Python execution worker.
 *
 * Runs CPython (compiled to WASM by Pyodide) off the main thread so that an
 * infinite loop in user code freezes nothing but this worker - which the page
 * can then terminate instantly. That is why Stop is immediate for Python but
 * has to wait for the network for C/C++.
 */

const PYODIDE_VERSION = '0.26.4';
const INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VERSION + '/full/';

let pyodidePromise = null;

function post(type, payload) {
  self.postMessage({ type: type, payload: payload });
}

function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async function () {
      post('status', 'Downloading Python runtime (first run only)...');
      importScripts(INDEX_URL + 'pyodide.js');
      const py = await self.loadPyodide({
        indexURL: INDEX_URL,
        // Pyodide batches these per line, so every print() streams out the
        // moment it happens instead of arriving in one lump at the end.
        stdout: function (line) {
          post('stdout', line + '\n');
        },
        stderr: function (line) {
          post('stderr', line + '\n');
        },
      });
      post('status', 'ready');
      return py;
    })();
  }
  return pyodidePromise;
}

/**
 * The user's code is written to main.py and executed through runpy so that
 * __name__ == "__main__" behaves normally and tracebacks quote real line
 * numbers from main.py. The frame-skipping loop drops this harness's own
 * frames so the user sees only their own call stack.
 */
const HARNESS = [
  'import io, runpy, sys, traceback',
  '',
  'def __playground_run__():',
  '    sys.argv = ["main.py"]',
  '    try:',
  '        sys.stdin = open("input.txt", "r")',
  '    except Exception:',
  '        sys.stdin = io.StringIO("")',
  '    try:',
  '        runpy.run_path("main.py", run_name="__main__")',
  '    except SystemExit as exc:',
  '        code = exc.code',
  '        if code is None:',
  '            return 0',
  '        if isinstance(code, int):',
  '            return code',
  '        print(code, file=sys.stderr)',
  '        return 1',
  '    except BaseException as exc:',
  '        tb = exc.__traceback__',
  '        while tb is not None and tb.tb_frame.f_code.co_filename != "main.py":',
  '            tb = tb.tb_next',
  '        traceback.print_exception(type(exc), exc, tb)',
  '        return 1',
  '    finally:',
  '        try:',
  '            sys.stdout.flush()',
  '            sys.stderr.flush()',
  '        except Exception:',
  '            pass',
  '    return 0',
  '',
  '__playground_run__()',
].join('\n');

self.onmessage = async function (event) {
  const data = event.data || {};

  try {
    if (data.type === 'preload') {
      await getPyodide();
      post('ready', null);
      return;
    }

    if (data.type !== 'run') return;

    const py = await getPyodide();
    const encoder = new TextEncoder();

    // FS.writeFile needs bytes unless told otherwise; encoding explicitly
    // keeps non-ASCII source and input intact.
    py.FS.writeFile('main.py', encoder.encode(String(data.code == null ? '' : data.code)));
    py.FS.writeFile('input.txt', encoder.encode(String(data.stdin == null ? '' : data.stdin)));

    post('started', null);
    const startedAt = performance.now();
    let exitCode = 0;

    try {
      const result = await py.runPythonAsync(HARNESS);
      const n = Number(result);
      exitCode = Number.isFinite(n) ? n : 0;
    } catch (err) {
      // A failure here is the harness itself breaking, not user code.
      post('stderr', (err && err.message ? err.message : String(err)) + '\n');
      exitCode = 1;
    }

    post('done', {
      exitCode: exitCode,
      timeMs: Math.round(performance.now() - startedAt),
      toolchain: 'CPython 3.12 (Pyodide ' + PYODIDE_VERSION + ', WASM)',
    });
  } catch (err) {
    post('fatal', err && err.message ? err.message : String(err));
  }
};
