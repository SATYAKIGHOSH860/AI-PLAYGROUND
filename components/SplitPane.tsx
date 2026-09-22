'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SplitPaneProps {
  first: React.ReactNode;
  second: React.ReactNode;
  storageKey: string;
  defaultPercent?: number;
  minPercent?: number;
  maxPercent?: number;
}

/**
 * Two resizable panes. Splits horizontally on desktop and vertically on narrow
 * screens, matching the CSS breakpoint in globals.css.
 */
export default function SplitPane({
  first,
  second,
  storageKey,
  defaultPercent = 54,
  minPercent = 22,
  maxPercent = 80,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [percent, setPercent] = useState(defaultPercent);
  const [dragging, setDragging] = useState(false);
  const [vertical, setVertical] = useState(false);

  useEffect(() => {
    try {
      const stored = Number.parseFloat(localStorage.getItem(storageKey) ?? '');
      if (Number.isFinite(stored)) {
        setPercent(Math.min(maxPercent, Math.max(minPercent, stored)));
      }
    } catch {
      /* storage unavailable - keep the default */
    }
  }, [storageKey, minPercent, maxPercent]);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 860px)');
    const sync = () => setVertical(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const clamp = useCallback(
    (value: number) => Math.min(maxPercent, Math.max(minPercent, value)),
    [minPercent, maxPercent],
  );

  const commit = useCallback(
    (value: number) => {
      setPercent(value);
      try {
        localStorage.setItem(storageKey, String(Math.round(value * 10) / 10));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = vertical ? 'row-resize' : 'col-resize';
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = vertical
      ? (event.clientY - rect.top) / rect.height
      : (event.clientX - rect.left) / rect.width;
    setPercent(clamp(ratio * 100));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    commit(percent);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const back = vertical ? 'ArrowUp' : 'ArrowLeft';
    const forward = vertical ? 'ArrowDown' : 'ArrowRight';
    if (event.key !== back && event.key !== forward) return;
    event.preventDefault();
    commit(clamp(percent + (event.key === forward ? 2 : -2)));
  };

  return (
    <div className="workspace" ref={containerRef}>
      <div className="pane" style={{ flex: `0 0 ${percent}%` }}>
        {first}
      </div>

      <div
        className={`split-handle${dragging ? ' is-dragging' : ''}`}
        role="separator"
        tabIndex={0}
        aria-label="Resize panels"
        aria-orientation={vertical ? 'horizontal' : 'vertical'}
        aria-valuenow={Math.round(percent)}
        aria-valuemin={minPercent}
        aria-valuemax={maxPercent}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
      />

      <div className="pane" style={{ flex: '1 1 0' }}>
        {second}
      </div>
    </div>
  );
}
