'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Monaco } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';

import { LANGUAGES, LANGUAGE_ORDER, isLanguageId } from '@/lib/languages';
import { parseDiagnostics } from '@/lib/diagnostics';
import { BrowserPythonRunner, RunCancelledError } from '@/lib/browserRunner';
import { decodeShare, encodeShare } from '@/lib/share';
import type {
  Diagnostic,
  Engine,
  EnginePref,
  LanguageId,
  OutputChunk,
  OutputStream,
  RunMeta,
  ServerRunResult,
} from '@/lib/types';

import { applyTheme, loadSettings, persistSettings } from '@/lib/applyTheme';
import { defaultSettings, type PlaygroundSettings } from '@/lib/settings';
import { KeySoundPlayer } from '@/lib/keySounds';

import EditorSkeleton from './EditorSkeleton';
import OutputPanel, { type PanelTab } from './OutputPanel';
import SettingsMenu from './SettingsMenu';
import SoundMenu from './SoundMenu';
import SplitPane from './SplitPane';
import { FileIcon, PlayIcon, ResetIcon, ShareIcon, SparkIcon, SpinnerIcon, StopIcon } from './Icons';

const CodeEditor = dynamic(() => import('./CodeEditor'), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});

const STORAGE_KEY = 'playground:state:v1';

/** Keeps a runaway loop from growing the DOM until the tab dies. */
const MAX_OUTPUT_CHARS = 200_000;

/** Browser runs are not sandboxed by a timeout, so we impose our own. */
const BROWSER_RUN_TIMEOUT_MS = 30_000;

const TRIM_NOTICE_ID = -1;

function mergeChunks(previous: OutputChunk[], batch: OutputChunk[]): OutputChunk[] {
  const next = previous.slice();

  for (const chunk of batch) {
    const last = next[next.length - 1];
    if (last && last.stream === chunk.stream && last.id !== TRIM_NOTICE_ID) {
      next[next.length - 1] = { ...last, text: last.text + chunk.text };
    } else {
      next.push(chunk);
    }
  }

  let total = 0;
  for (const chunk of next) total += chunk.text.length;
  if (total <= MAX_OUTPUT_CHARS) return next;

  let excess = total - MAX_OUTPUT_CHARS;
  while (excess > 0 && next.length) {
    const head = next[0];
    if (head.text.length <= excess) {
      excess -= head.text.length;
      next.shift();
    } else {
      next[0] = { ...head, text: head.text.slice(excess) };
      excess = 0;
    }
  }

  if (next[0]?.id === TRIM_NOTICE_ID) next.shift();
  next.unshift({
    id: TRIM_NOTICE_ID,
    stream: 'system',
    text: `[earlier output trimmed at ${MAX_OUTPUT_CHARS.toLocaleString()} characters]\n`,
  });
  return next;
}

function resolveEngine(preference: EnginePref, language: LanguageId): Engine {
  // C and C++ need a real compiler, which only the server side has.
  if (!LANGUAGES[language].browserCapable) return 'server';
  return preference === 'server' ? 'server' : 'browser';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function endWithNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}

export default function Playground() {
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<PlaygroundSettings>(() => defaultSettings(false));
  const [language, setLanguage] = useState<LanguageId>('python');
  const [enginePref, setEnginePref] = useState<EnginePref>('auto');

  const [sources, setSources] = useState<Record<LanguageId, string>>(() => ({
    python: LANGUAGES.python.template,
    c: LANGUAGES.c.template,
    cpp: LANGUAGES.cpp.template,
  }));
  const [stdins, setStdins] = useState<Record<LanguageId, string>>(() => ({
    python: LANGUAGES.python.sampleStdin,
    c: LANGUAGES.c.sampleStdin,
    cpp: LANGUAGES.cpp.sampleStdin,
  }));

  const [chunks, setChunks] = useState<OutputChunk[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [running, setRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [meta, setMeta] = useState<RunMeta | null>(null);
  const [phase, setPhase] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [tab, setTab] = useState<PanelTab>('output');
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [toast, setToast] = useState<string | null>(null);

  const soundRef = useRef<KeySoundPlayer | null>(null);
  const runnerRef = useRef<BrowserPythonRunner | null>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);
  const runRef = useRef<() => void>(() => {});
  const stderrRef = useRef('');
  const pendingRef = useRef<OutputChunk[]>([]);
  const rafRef = useRef<number | null>(null);
  const chunkIdRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const autoStoppedRef = useRef(false);

  const config = LANGUAGES[language];
  const engine = resolveEngine(enginePref, language);

  // ----------------------------------------------------------- hydration ---

  useEffect(() => {
    setSettings(loadSettings());

    // A shared link always wins over locally saved work.
    const fragment = window.location.hash.replace(/^#/, '');
    const shared = fragment ? decodeShare(fragment) : null;

    if (shared) {
      setLanguage(shared.language);
      setSources((prev) => ({ ...prev, [shared.language]: shared.code }));
      setStdins((prev) => ({ ...prev, [shared.language]: shared.stdin }));
      setToast('Loaded shared snippet');
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } else {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as {
            language?: unknown;
            sources?: Record<string, string>;
            stdins?: Record<string, string>;
            enginePref?: unknown;
          };
          if (isLanguageId(saved.language)) setLanguage(saved.language);
          if (saved.enginePref === 'auto' || saved.enginePref === 'browser' || saved.enginePref === 'server') {
            setEnginePref(saved.enginePref);
          }
          if (saved.sources) {
            setSources((prev) => {
              const next = { ...prev };
              for (const id of LANGUAGE_ORDER) {
                const value = saved.sources?.[id];
                if (typeof value === 'string') next[id] = value;
              }
              return next;
            });
          }
          if (saved.stdins) {
            setStdins((prev) => {
              const next = { ...prev };
              for (const id of LANGUAGE_ORDER) {
                const value = saved.stdins?.[id];
                if (typeof value === 'string') next[id] = value;
              }
              return next;
            });
          }
        }
      } catch {
        /* corrupt state - fall back to the templates */
      }
    }

    setHydrated(true);
  }, []);

  /** Applies the chosen theme and font to the whole page, then persists both. */
  useEffect(() => {
    if (!hydrated) return;
    applyTheme(settings);
    persistSettings(settings);
  }, [settings, hydrated]);

  const updateSettings = useCallback((patch: Partial<PlaygroundSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  // ---------------------------------------------------------- key sounds ---

  /** The AudioContext is only built on the first keystroke, never at import. */
  const sound = useCallback(() => {
    if (!soundRef.current) soundRef.current = new KeySoundPlayer();
    return soundRef.current;
  }, []);

  useEffect(() => {
    const player = sound();
    player.profileId = settings.soundProfile;
    player.volume = settings.soundVolume;
    player.enabled = settings.soundEnabled;
  }, [sound, settings.soundProfile, settings.soundVolume, settings.soundEnabled]);

  /**
   * Listens in the capture phase so the sound fires even though Monaco stops
   * propagation on the keys it handles, and only while focus is in a place
   * where you are actually writing code.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Auto-repeat means the key is still held down; real keyboards are
      // silent for those, and it stops a held Backspace machine-gunning.
      if (event.repeat) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;
      const typingInCode =
        target.classList?.contains('stdin-area') || Boolean(target.closest?.('.monaco-editor'));
      if (!typingInCode) return;

      sound().play(event.key);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [sound]);

  const previewSound = useCallback(
    (profileId: string) => {
      sound().preview(profileId);
    },
    [sound],
  );

  useEffect(() => {
    if (!hydrated) return;
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ language, sources, stdins, enginePref }));
      } catch {
        /* quota or private mode - saving is best effort */
      }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [hydrated, language, sources, stdins, enginePref]);

  // -------------------------------------------------------------- output ---

  const flushOutput = useCallback(() => {
    rafRef.current = null;
    const batch = pendingRef.current;
    if (!batch.length) return;
    pendingRef.current = [];
    setChunks((prev) => mergeChunks(prev, batch));
  }, []);

  const appendOutput = useCallback(
    (stream: OutputStream, text: string) => {
      if (!text) return;
      if (stream === 'stderr') stderrRef.current += text;
      pendingRef.current.push({ id: chunkIdRef.current++, stream, text });
      if (rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(flushOutput);
      }
    },
    [flushOutput],
  );

  const clearOutput = useCallback(() => {
    pendingRef.current = [];
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setChunks([]);
  }, []);

  // --------------------------------------------------------------- timer ---

  const startTimer = useCallback(() => {
    const startedAt = performance.now();
    setElapsed(0);
    timerRef.current = window.setInterval(() => setElapsed(performance.now() - startedAt), 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ------------------------------------------------------------- runtime ---

  const ensureRunner = useCallback(() => {
    if (!runnerRef.current) runnerRef.current = new BrowserPythonRunner();
    return runnerRef.current;
  }, []);

  useEffect(() => {
    return () => {
      runnerRef.current?.dispose();
      // Browsers cap how many AudioContexts a page may hold open.
      soundRef.current?.dispose();
      abortRef.current?.abort();
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      if (autoStopRef.current !== null) window.clearTimeout(autoStopRef.current);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Warm the Python runtime up while the user is still typing.
  useEffect(() => {
    if (!hydrated || running) return;
    if (resolveEngine(enginePref, language) !== 'browser') return;
    const handle = window.setTimeout(() => ensureRunner().preload(), 1200);
    return () => window.clearTimeout(handle);
  }, [hydrated, running, enginePref, language, ensureRunner]);

  const finishRun = useCallback(
    (result: RunMeta) => {
      setMeta(result);
      if (result.compileFailed) {
        appendOutput('failure', `\n✗ Compilation failed — the program never ran.\n`);
        return;
      }
      if (result.killedBy) {
        appendOutput('failure', `\n✗ ${result.killedBy} (after ${formatDuration(result.timeMs)})\n`);
        return;
      }
      if (result.exitCode === 0) {
        appendOutput('success', `\n✓ Finished in ${formatDuration(result.timeMs)} (exit code 0)\n`);
        return;
      }
      appendOutput(
        'failure',
        `\n✗ Exited with code ${result.exitCode ?? '?'} after ${formatDuration(result.timeMs)}\n`,
      );
    },
    [appendOutput],
  );

  const runInBrowser = useCallback(
    async (lang: LanguageId, code: string, stdin: string) => {
      const runner = ensureRunner();
      runner.onOutput = appendOutput;
      runner.onStatus = (status) => setPhase(status === 'ready' || status === 'running' ? '' : status);

      appendOutput('system', `▸ ${LANGUAGES[lang].toolchainHint} · ${LANGUAGES[lang].filename}\n\n`);

      autoStoppedRef.current = false;
      autoStopRef.current = window.setTimeout(() => {
        autoStoppedRef.current = true;
        runnerRef.current?.stop();
      }, BROWSER_RUN_TIMEOUT_MS);

      try {
        const result = await runner.run(code, stdin);
        setDiagnostics(parseDiagnostics(stderrRef.current, lang, LANGUAGES[lang].filename));
        finishRun({
          engine: 'browser',
          toolchain: result.toolchain,
          exitCode: result.exitCode,
          timeMs: result.timeMs,
        });
      } finally {
        if (autoStopRef.current !== null) {
          window.clearTimeout(autoStopRef.current);
          autoStopRef.current = null;
        }
      }
    },
    [appendOutput, ensureRunner, finishRun],
  );

  const runOnServer = useCallback(
    async (lang: LanguageId, code: string, stdin: string) => {
      const controller = new AbortController();
      abortRef.current = controller;

      const cfg = LANGUAGES[lang];
      setPhase(cfg.browserCapable ? 'Running on the server…' : 'Compiling…');
      appendOutput('system', `▸ ${cfg.toolchainHint} · ${cfg.filename}\n\n`);

      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ language: lang, code, stdin }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => null)) as
        | (ServerRunResult & { error?: string })
        | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? `The run service returned HTTP ${response.status}.`);
      }

      setPhase('');

      if (payload.compileOutput) appendOutput('compile', endWithNewline(payload.compileOutput));
      if (payload.stdout) appendOutput('stdout', payload.stdout);
      if (payload.stderr) appendOutput('stderr', payload.stderr);

      const diagnosticSource = payload.compileOutput || (lang === 'python' ? payload.stderr : '');
      setDiagnostics(parseDiagnostics(diagnosticSource, lang, cfg.filename));

      finishRun({
        engine: 'server',
        toolchain: payload.toolchain,
        exitCode: payload.exitCode,
        timeMs: payload.timeMs,
        killedBy: payload.killedBy,
        compileFailed: payload.compileFailed,
      });
    },
    [appendOutput, finishRun],
  );

  const handleRun = useCallback(async () => {
    if (runningRef.current) return;

    const lang = language;
    const code = sources[lang];
    if (!code.trim()) {
      setToast('There is no code to run.');
      return;
    }

    runningRef.current = true;
    setRunning(true);
    setHasRun(true);
    setMeta(null);
    setDiagnostics([]);
    setPhase('');
    setTab('output');
    stderrRef.current = '';
    clearOutput();
    startTimer();

    try {
      if (resolveEngine(enginePref, lang) === 'browser') {
        await runInBrowser(lang, code, stdins[lang]);
      } else {
        await runOnServer(lang, code, stdins[lang]);
      }
    } catch (error) {
      const aborted =
        error instanceof RunCancelledError ||
        (error instanceof DOMException && error.name === 'AbortError');

      if (aborted) {
        appendOutput(
          'failure',
          autoStoppedRef.current
            ? `\n✗ Stopped automatically after ${BROWSER_RUN_TIMEOUT_MS / 1000}s — looks like an infinite loop.\n`
            : '\n✗ Stopped.\n',
        );
      } else {
        const message = error instanceof Error ? error.message : String(error);
        appendOutput('failure', `\n✗ ${message}\n`);
      }
    } finally {
      abortRef.current = null;
      stopTimer();
      runningRef.current = false;
      setRunning(false);
      setPhase('');
    }
  }, [
    appendOutput,
    clearOutput,
    enginePref,
    language,
    runInBrowser,
    runOnServer,
    sources,
    startTimer,
    stdins,
    stopTimer,
  ]);

  useEffect(() => {
    runRef.current = handleRun;
  }, [handleRun]);

  const handleStop = useCallback(() => {
    if (!runningRef.current) return;
    abortRef.current?.abort();
    runnerRef.current?.stop();
  }, []);

  // Ctrl+Enter also works when focus is outside the editor.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        runRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(handle);
  }, [toast]);

  // ------------------------------------------------------------- actions ---

  const handleShare = useCallback(async () => {
    const encoded = encodeShare({ language, code: sources[language], stdin: stdins[language] });
    const url = `${window.location.origin}${window.location.pathname}#${encoded}`;

    if (url.length > 8000) {
      setToast('This snippet is too large to share as a link.');
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setToast('Share link copied to clipboard');
    } catch {
      window.location.hash = encoded;
      setToast('Share link is now in the address bar');
    }
  }, [language, sources, stdins]);

  const handleReset = useCallback(() => {
    setSources((prev) => ({ ...prev, [language]: LANGUAGES[language].template }));
    setStdins((prev) => ({ ...prev, [language]: LANGUAGES[language].sampleStdin }));
    setDiagnostics([]);
    setToast('Reset to the starter template');
  }, [language]);

  const handleDiagnosticClick = useCallback((diagnostic: Diagnostic) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.revealLineInCenter(diagnostic.line);
    editor.setPosition({ lineNumber: diagnostic.line, column: diagnostic.column ?? 1 });
    editor.focus();
  }, []);

  const handleEditorReady = useCallback(
    (editor: MonacoEditor.IStandaloneCodeEditor, _monaco: Monaco) => {
      editorRef.current = editor;
    },
    [],
  );

  // ---------------------------------------------------------------- view ---

  const statusTone = meta ? (meta.exitCode === 0 && !meta.killedBy && !meta.compileFailed ? 'ok' : 'bad') : null;

  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="brand brand-link" title="Back to the home page">
          <span className="brand-mark">
            <SparkIcon size={16} />
          </span>
          <span>
            <div className="brand-name">AI Playground</div>
            <div className="brand-sub">online compiler</div>
          </span>
        </Link>

        <div className="topbar-center">
          <div className="seg" role="tablist" aria-label="Language">
            {LANGUAGE_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={language === id}
                className={language === id ? 'is-active' : ''}
                onClick={() => setLanguage(id)}
              >
                {LANGUAGES[id].label}
              </button>
            ))}
          </div>

          <select
            className="select"
            // C/C++ have no in-browser engine, so the control shows a fixed
            // value rather than whatever Python was last set to.
            value={config.browserCapable ? enginePref : 'server-only'}
            onChange={(event) => setEnginePref(event.target.value as EnginePref)}
            disabled={!config.browserCapable}
            title={
              config.browserCapable
                ? 'Where Python runs. In-browser is instant and needs no network.'
                : 'C and C++ always compile on the server.'
            }
            aria-label="Execution engine"
          >
            {config.browserCapable ? (
              <>
                <option value="auto">Engine: in-browser</option>
                <option value="server">Engine: server</option>
              </>
            ) : (
              <option value="server-only">Engine: server</option>
            )}
          </select>
        </div>

        <div className="topbar-right">
          <button
            type="button"
            className="icon-btn"
            onClick={handleShare}
            title="Copy a shareable link"
            aria-label="Copy a shareable link"
          >
            <ShareIcon />
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={handleReset}
            title="Reset to the starter template"
            aria-label="Reset to the starter template"
          >
            <ResetIcon />
          </button>

          <SoundMenu settings={settings} onChange={updateSettings} onPreview={previewSound} />

          <SettingsMenu settings={settings} onChange={updateSettings} />

          {running ? (
            <button type="button" className="btn btn-stop" onClick={handleStop}>
              <StopIcon />
              Stop
            </button>
          ) : (
            <button type="button" className="btn btn-run" onClick={handleRun}>
              <PlayIcon />
              Run
              <span className="kbd btn-label-full">^↵</span>
            </button>
          )}
        </div>
      </header>

      <SplitPane
        storageKey="playground:split"
        defaultPercent={54}
        first={
          <>
            <div className="pane-head">
              <span className="pane-file">
                <FileIcon />
                {config.filename}
              </span>
              <div className="pane-spacer" />
              <span className="pane-file">{config.label}</span>
            </div>
            <div className="pane-body">
              <CodeEditor
                value={sources[language]}
                language={config.monaco}
                path={config.filename}
                themeId={settings.themeId}
                fontId={settings.fontId}
                fontSize={settings.fontSize}
                ligatures={settings.ligatures}
                autoSuggest={settings.autoSuggest}
                diagnostics={diagnostics}
                onChange={(value) => setSources((prev) => ({ ...prev, [language]: value }))}
                onCursorChange={(line, column) => setCursor({ line, column })}
                onRun={() => runRef.current()}
                onReady={handleEditorReady}
              />
            </div>
          </>
        }
        second={
          <OutputPanel
            tab={tab}
            onTabChange={setTab}
            chunks={chunks}
            running={running}
            hasRun={hasRun}
            stdin={stdins[language]}
            onStdinChange={(value) => setStdins((prev) => ({ ...prev, [language]: value }))}
            diagnostics={diagnostics}
            onDiagnosticClick={handleDiagnosticClick}
            onClear={clearOutput}
          />
        }
      />

      <footer className="statusbar">
        <span className="status-item">
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <span className="status-item">{config.label}</span>
        <span className="status-item">{meta?.toolchain ?? config.toolchainHint}</span>
        <span className="status-item">{engine === 'browser' ? 'in-browser' : 'server'}</span>

        <span className="status-push" />

        {running ? (
          <span className="status-item">
            <SpinnerIcon size={12} className="spin" />
            {phase || 'Running'} · {formatDuration(elapsed)}
          </span>
        ) : meta ? (
          <span className={`status-item is-${statusTone}`}>
            <span className="dot" />
            {meta.compileFailed
              ? 'compile error'
              : meta.killedBy
                ? meta.killedBy
                : `exit ${meta.exitCode ?? '?'}`}{' '}
            · {formatDuration(meta.timeMs)}
          </span>
        ) : (
          <span className="status-item">
            <span className="dot" />
            ready
          </span>
        )}
      </footer>

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
