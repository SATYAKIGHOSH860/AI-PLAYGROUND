'use client';

import { useEffect, useMemo, useRef } from 'react';
import Editor, { loader, type Monaco, type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import type { Diagnostic } from '@/lib/types';
import { THEMES, monacoThemeData, monacoThemeId } from '@/lib/themes';
import { ensureFontLoaded, getFont } from '@/lib/fonts';
import { registerCompletions } from '@/lib/completions';
import EditorSkeleton from './EditorSkeleton';

/**
 * Monaco is loaded from a CDN rather than bundled. It keeps the Next build
 * small and avoids the webpack worker plumbing that monaco-editor otherwise
 * needs. The version is pinned so a CDN update can never change behaviour.
 */
const MONACO_VERSION = '0.52.2';

loader.config({
  paths: { vs: `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs` },
});

function defineThemes(monaco: Monaco) {
  for (const theme of THEMES) {
    monaco.editor.defineTheme(monacoThemeId(theme.id), monacoThemeData(theme));
  }
}

interface CodeEditorProps {
  value: string;
  /** Monaco language id. */
  language: string;
  /** Unique per language so each keeps its own undo history and view state. */
  path: string;
  themeId: string;
  fontId: string;
  fontSize: number;
  ligatures: boolean;
  autoSuggest: boolean;
  diagnostics: Diagnostic[];
  onChange: (value: string) => void;
  onCursorChange: (line: number, column: number) => void;
  onRun: () => void;
  onReady: (editor: MonacoEditor.IStandaloneCodeEditor, monaco: Monaco) => void;
}

export default function CodeEditor({
  value,
  language,
  path,
  themeId,
  fontId,
  fontSize,
  ligatures,
  autoSuggest,
  diagnostics,
  onChange,
  onCursorChange,
  onRun,
  onReady,
}: CodeEditorProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // Keeping the callbacks in refs means the Ctrl+Enter command registered once
  // at mount always calls the freshest handler.
  const onRunRef = useRef(onRun);
  const onCursorRef = useRef(onCursorChange);
  useEffect(() => {
    onRunRef.current = onRun;
    onCursorRef.current = onCursorChange;
  });

  const font = getFont(fontId);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current());
    editor.onDidChangeCursorPosition((event) => {
      onCursorRef.current(event.position.lineNumber, event.position.column);
    });

    onReady(editor, monaco);
  };

  /**
   * Monaco caches glyph widths at mount. If a web font arrives afterwards the
   * caret drifts out of line with the text, so the editor has to be told to
   * measure again once the font is actually usable.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureFontLoaded(font);
      if (cancelled) return;
      monacoRef.current?.editor.remeasureFonts();
    })();
    return () => {
      cancelled = true;
    };
  }, [font]);

  // Paint compiler / interpreter errors straight onto the offending lines.
  useEffect(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const model = editor.getModel();
    if (!model) return;

    const severityOf = (severity: Diagnostic['severity']) => {
      if (severity === 'error') return monaco.MarkerSeverity.Error;
      if (severity === 'warning') return monaco.MarkerSeverity.Warning;
      return monaco.MarkerSeverity.Info;
    };

    const markers = diagnostics.map((d) => {
      const lineNumber = Math.min(Math.max(d.line, 1), model.getLineCount());
      const maxColumn = model.getLineMaxColumn(lineNumber);
      const startColumn = d.column ? Math.min(Math.max(d.column, 1), maxColumn) : 1;

      // Underline just the offending token when the compiler gave a column.
      let endColumn = maxColumn;
      if (d.column) {
        const word = model.getWordAtPosition({ lineNumber, column: startColumn });
        if (word) endColumn = word.endColumn;
      }

      return {
        startLineNumber: lineNumber,
        endLineNumber: lineNumber,
        startColumn,
        endColumn: Math.max(endColumn, startColumn + 1),
        message: d.message,
        severity: severityOf(d.severity),
        source: 'run',
      };
    });

    monaco.editor.setModelMarkers(model, 'playground', markers);
  }, [diagnostics]);

  const options = useMemo<MonacoEditor.IStandaloneEditorConstructionOptions>(
    () => ({
      fontFamily: font.stack,
      fontSize,
      // Only honour ligatures when the face actually has them.
      fontLigatures: ligatures && font.ligatures,
      lineHeight: 1.65,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      renderLineHighlight: 'all',
      lineNumbersMinChars: 3,
      glyphMargin: false,
      padding: { top: 14, bottom: 18 },
      automaticLayout: true,
      tabSize: 4,
      insertSpaces: true,
      detectIndentation: true,
      bracketPairColorization: { enabled: true },
      guides: { indentation: true, bracketPairs: false },
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
        useShadows: false,
        alwaysConsumeMouseWheel: false,
      },
      overviewRulerBorder: false,
      stickyScroll: { enabled: false },
      roundedSelection: false,
      fixedOverflowWidgets: true,

      // --- auto-suggest -------------------------------------------------
      // Switching this off silences the popup that appears as you type;
      // Ctrl+Space still opens it on demand, which is the behaviour people
      // expect from "turn autocomplete off".
      quickSuggestions: autoSuggest ? { other: true, comments: false, strings: false } : false,
      quickSuggestionsDelay: 60,
      suggestOnTriggerCharacters: autoSuggest,
      wordBasedSuggestions: autoSuggest ? 'currentDocument' : 'off',
      acceptSuggestionOnEnter: autoSuggest ? 'on' : 'off',
      tabCompletion: autoSuggest ? 'on' : 'off',
      parameterHints: { enabled: autoSuggest },
      suggestSelection: 'first',
      snippetSuggestions: 'top',
      suggest: {
        showWords: autoSuggest,
        showSnippets: true,
        insertMode: 'replace',
        filterGraceful: true,
      },
    }),
    [font, fontSize, ligatures, autoSuggest],
  );

  return (
    <Editor
      value={value}
      language={language}
      path={path}
      theme={monacoThemeId(themeId)}
      beforeMount={(monaco) => {
        defineThemes(monaco);
        registerCompletions(monaco);
      }}
      onMount={handleMount}
      onChange={(next) => onChange(next ?? '')}
      loading={<EditorSkeleton />}
      options={options}
    />
  );
}
