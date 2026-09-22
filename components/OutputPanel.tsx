'use client';

import { useEffect, useRef } from 'react';
import type { Diagnostic, OutputChunk } from '@/lib/types';
import { ErrorIcon, InfoIcon, TerminalIcon, TrashIcon, WarnIcon } from './Icons';

export type PanelTab = 'output' | 'input' | 'problems';

interface OutputPanelProps {
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  chunks: OutputChunk[];
  running: boolean;
  hasRun: boolean;
  stdin: string;
  onStdinChange: (value: string) => void;
  diagnostics: Diagnostic[];
  onDiagnosticClick: (diagnostic: Diagnostic) => void;
  onClear: () => void;
}

export default function OutputPanel({
  tab,
  onTabChange,
  chunks,
  running,
  hasRun,
  stdin,
  onStdinChange,
  diagnostics,
  onDiagnosticClick,
  onClear,
}: OutputPanelProps) {
  const consoleRef = useRef<HTMLPreElement>(null);
  const stickToBottom = useRef(true);

  // Follow the tail like a terminal, but stop fighting the user the moment
  // they scroll up to read something.
  useEffect(() => {
    const node = consoleRef.current;
    if (!node || tab !== 'output' || !stickToBottom.current) return;
    node.scrollTop = node.scrollHeight;
  }, [chunks, tab, running]);

  const handleScroll = () => {
    const node = consoleRef.current;
    if (!node) return;
    stickToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 28;
  };

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warnCount = diagnostics.filter((d) => d.severity === 'warning').length;

  return (
    <>
      <div className="pane-head">
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'output'}
            className={`tab${tab === 'output' ? ' is-active' : ''}`}
            onClick={() => onTabChange('output')}
          >
            <TerminalIcon size={14} />
            Output
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === 'input'}
            className={`tab${tab === 'input' ? ' is-active' : ''}`}
            onClick={() => onTabChange('input')}
          >
            Input
            {stdin.trim() ? <span className="badge">stdin</span> : null}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === 'problems'}
            className={`tab${tab === 'problems' ? ' is-active' : ''}`}
            onClick={() => onTabChange('problems')}
          >
            Problems
            {errorCount > 0 ? <span className="badge is-error">{errorCount}</span> : null}
            {errorCount === 0 && warnCount > 0 ? (
              <span className="badge is-warn">{warnCount}</span>
            ) : null}
          </button>
        </div>

        <div className="pane-spacer" />

        {tab === 'output' && chunks.length > 0 ? (
          <button type="button" className="icon-btn" onClick={onClear} title="Clear output" aria-label="Clear output">
            <TrashIcon />
          </button>
        ) : null}
      </div>

      <div className="pane-body">
        {tab === 'output' ? (
          chunks.length === 0 && !running ? (
            <div className="empty-state">
              <TerminalIcon size={22} />
              <strong>{hasRun ? 'No output' : 'Nothing has run yet'}</strong>
              <span>
                {hasRun
                  ? 'The program finished without writing anything to stdout or stderr.'
                  : 'Press Run, or hit Ctrl+Enter in the editor. Anything in the Input tab is piped to stdin.'}
              </span>
            </div>
          ) : (
            <pre className="console" ref={consoleRef} onScroll={handleScroll} aria-live="polite">
              {chunks.map((chunk) => (
                <span key={chunk.id} className={`s-${chunk.stream}`}>
                  {chunk.text}
                </span>
              ))}
              {running ? <span className="cursor-blink" /> : null}
            </pre>
          )
        ) : null}

        {tab === 'input' ? (
          <div className="stdin-wrap">
            <div className="stdin-hint">
              Piped to the program&apos;s standard input. One value per line, exactly as you would type it.
            </div>
            <textarea
              className="stdin-area"
              value={stdin}
              onChange={(event) => onStdinChange(event.target.value)}
              placeholder={'12\n7 3 9'}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label="Standard input"
            />
          </div>
        ) : null}

        {tab === 'problems' ? (
          diagnostics.length === 0 ? (
            <div className="empty-state">
              <strong>No problems detected</strong>
              <span>
                Compiler errors, warnings and Python tracebacks show up here and as squiggles in the editor.
              </span>
            </div>
          ) : (
            <div className="problems">
              {diagnostics.map((diagnostic, index) => (
                <button
                  type="button"
                  className="problem"
                  key={`${diagnostic.line}-${diagnostic.severity}-${index}`}
                  onClick={() => onDiagnosticClick(diagnostic)}
                >
                  <span className={`problem-icon is-${diagnostic.severity}`}>
                    {diagnostic.severity === 'error' ? (
                      <ErrorIcon />
                    ) : diagnostic.severity === 'warning' ? (
                      <WarnIcon />
                    ) : (
                      <InfoIcon />
                    )}
                  </span>
                  <span className="problem-text">
                    {diagnostic.message}
                    <span className="problem-loc">
                      line {diagnostic.line}
                      {diagnostic.column ? `, column ${diagnostic.column}` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )
        ) : null}
      </div>
    </>
  );
}
