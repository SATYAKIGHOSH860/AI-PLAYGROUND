import type { Diagnostic, LanguageId } from './types';

/**
 * Turns raw compiler / interpreter text into structured diagnostics so the
 * editor can draw squiggles on the offending line instead of making the user
 * read a wall of text and count lines by hand.
 */

/**
 * gcc/clang: `prog.cc:12:5: error: 'x' was not declared in this scope`
 * The file name varies by provider (prog.cc on Wandbox, main.cpp on Piston),
 * so we accept any C-family file name - there is only one file in the editor.
 */
const GCC_LINE = /^\s*(?<file>[^\s:()]+\.(?:c|cc|cpp|cxx|h|hh|hpp))\s*:(?<line>\d+):(?:(?<col>\d+):)?\s*(?<sev>fatal error|error|warning|note):\s*(?<msg>.*)$/;

/** `  File "main.py", line 12, in <module>` - the `, in ...` part is optional. */
const PY_FRAME = /^\s*File "(?<file>[^"]+)", line (?<line>\d+)(?:, in (?<fn>.*))?\s*$/;

/** `ValueError: invalid literal for int()` at column 0 of the last line. */
const PY_EXCEPTION = /^(?<type>[A-Za-z_][\w.]*(?:Error|Exception|Exit|Interrupt|Warning|Fault))(?::\s?(?<msg>[\s\S]*))?$/;

/** Providers report absolute paths like /home/wandbox/main.py; compare tails. */
function basename(path: string): string {
  const normalised = path.replace(/\\/g, '/');
  return normalised.slice(normalised.lastIndexOf('/') + 1);
}

function severityOf(raw: string): Diagnostic['severity'] {
  if (raw === 'warning') return 'warning';
  if (raw === 'note') return 'info';
  return 'error';
}

function parseGcc(text: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const raw of text.split('\n')) {
    const m = GCC_LINE.exec(raw);
    if (!m?.groups) continue;
    const line = Number.parseInt(m.groups.line, 10);
    if (!Number.isFinite(line) || line < 1) continue;
    const column = m.groups.col ? Number.parseInt(m.groups.col, 10) : undefined;
    out.push({
      line,
      column,
      severity: severityOf(m.groups.sev),
      message: m.groups.msg.trim(),
    });
  }
  return out;
}

/**
 * Python reports the failure at the *bottom* of the traceback. We mark the
 * deepest frame inside the user's file as the error and the frames that led
 * there as info, which reproduces the call path in the Problems panel.
 */
function parsePython(text: string, filename: string): Diagnostic[] {
  const lines = text.split('\n');
  const frames: number[] = [];

  for (const raw of lines) {
    const m = PY_FRAME.exec(raw);
    if (!m?.groups) continue;
    // Ignore frames from the standard library - they are not in the editor.
    if (basename(m.groups.file) !== filename) continue;
    const line = Number.parseInt(m.groups.line, 10);
    if (Number.isFinite(line) && line >= 1) frames.push(line);
  }

  if (!frames.length) return [];

  let message = 'Runtime error';
  for (let i = lines.length - 1; i >= 0; i--) {
    const candidate = lines[i].trim();
    if (!candidate) continue;
    const m = PY_EXCEPTION.exec(candidate);
    if (m?.groups) {
      message = m.groups.msg ? `${m.groups.type}: ${m.groups.msg}` : m.groups.type;
      break;
    }
  }

  const deepest = frames[frames.length - 1];
  const out: Diagnostic[] = [{ line: deepest, severity: 'error', message }];

  for (const line of frames.slice(0, -1)) {
    if (line === deepest) continue;
    out.push({ line, severity: 'info', message: 'called from here' });
  }
  return out;
}

export function parseDiagnostics(text: string, language: LanguageId, filename: string): Diagnostic[] {
  if (!text?.trim()) return [];
  const found = language === 'python' ? parsePython(text, filename) : parseGcc(text);

  // Collapse duplicates (gcc repeats a location for the caret line).
  const seen = new Set<string>();
  return found.filter((d) => {
    const key = `${d.line}:${d.column ?? 0}:${d.severity}:${d.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function countBySeverity(diagnostics: Diagnostic[]) {
  return {
    errors: diagnostics.filter((d) => d.severity === 'error').length,
    warnings: diagnostics.filter((d) => d.severity === 'warning').length,
  };
}
