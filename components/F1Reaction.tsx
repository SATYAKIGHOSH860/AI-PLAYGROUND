'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { applySavedAppearance } from '@/lib/applyTheme';
import { ArrowRightIcon, SparkIcon } from './Icons';

/**
 * A reaction test built on the real Formula 1 start procedure:
 * five pairs of red lights illuminate one pair per second, then after a
 * random hold of 0.2s to 3s they all go out at once. That is the signal.
 *
 * The whole point is the measurement, so two things matter more than anything
 * on screen:
 *
 *   1. The clock must start when the lights-out frame is *painted*, not when
 *      the timer fired. Those differ by up to a frame, and a frame is 16ms of
 *      a ~200ms score.
 *   2. The stop time must be when the input happened, not when React got
 *      round to handling it, which is why event.timeStamp is preferred over
 *      reading the clock inside the handler.
 */

type Phase = 'idle' | 'lighting' | 'waiting' | 'go' | 'result' | 'jumpstart' | 'anticipated';

const LIGHT_COLUMNS = 5;
const LIGHT_INTERVAL_MS = 1000;
/** The FIA hold: a random 0.2s to 3s after the fifth pair lights up. */
const MIN_HOLD_MS = 200;
const MAX_HOLD_MS = 3000;

const BEST_KEY = 'playground:f1-best';

/**
 * The floor for a genuine visual reaction. Nobody sees a light and presses a
 * button in under 100ms - below that the input was already on its way, which
 * is anticipation, not reaction. Formula 1 draws the same line at 0.2s and
 * calls it a jump start. Without this a single lucky mash would write an
 * impossible time into your saved best and it would never come back.
 */
const MIN_HUMAN_MS = 100;

/** Seconds with three decimals, zero padded: 243ms -> "00.243". */
function formatTime(ms: number): string {
  return (Math.max(ms, 0) / 1000).toFixed(3).padStart(6, '0');
}

/**
 * Prefers the event's own timestamp, which browsers set close to when the
 * hardware event happened rather than when the listener ran. Legacy engines
 * reported epoch milliseconds here, so anything off the performance timeline
 * is discarded.
 */
function inputTime(event: { timeStamp?: number }): number {
  const now = performance.now();
  const stamp = event.timeStamp;
  if (typeof stamp === 'number' && stamp > 0 && Math.abs(stamp - now) < 1000) return stamp;
  return now;
}

export default function F1Reaction() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [lit, setLit] = useState(0);
  const [reaction, setReaction] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);

  const timers = useRef<number[]>([]);
  const goAt = useRef(0);
  // Phase is mirrored into a ref because a tap can land between a state
  // update and React committing it, and the input handler must never act on
  // a stale phase.
  const phaseRef = useRef<Phase>('idle');

  const setPhaseNow = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  useEffect(() => {
    void applySavedAppearance();
    try {
      const stored = Number(localStorage.getItem(BEST_KEY));
      // Also discards any impossible value saved before the floor existed.
      if (Number.isFinite(stored) && stored >= MIN_HUMAN_MS) setBest(stored);
    } catch {
      /* storage blocked - the best time just will not persist */
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    setReaction(null);
    setLit(0);
    setPhaseNow('lighting');

    for (let column = 1; column <= LIGHT_COLUMNS; column++) {
      timers.current.push(
        window.setTimeout(() => {
          setLit(column);
          if (column === LIGHT_COLUMNS) setPhaseNow('waiting');
        }, column * LIGHT_INTERVAL_MS),
      );
    }

    const hold = MIN_HOLD_MS + Math.random() * (MAX_HOLD_MS - MIN_HOLD_MS);

    timers.current.push(
      window.setTimeout(
        () => {
          // Commit synchronously so the very next frame is the one that paints
          // the lights out, then take that frame's timestamp as the moment the
          // signal became visible.
          flushSync(() => {
            setLit(0);
            setPhase('go');
          });
          phaseRef.current = 'go';

          // Fallback in case the frame callback has not run yet; a human
          // cannot beat it, but a stale value would produce nonsense.
          goAt.current = performance.now();
          requestAnimationFrame((frameTime) => {
            goAt.current = frameTime;
          });
        },
        LIGHT_COLUMNS * LIGHT_INTERVAL_MS + hold,
      ),
    );
  }, [clearTimers, setPhaseNow]);

  const handleInput = useCallback(
    (at: number) => {
      const current = phaseRef.current;

      // Going before the lights go out is a jump start, exactly as on the grid.
      if (current === 'lighting' || current === 'waiting') {
        clearTimers();
        setLit(0);
        setReaction(null);
        setPhaseNow('jumpstart');
        return;
      }

      if (current === 'go') {
        const elapsed = Math.max(0, at - goAt.current);

        // Faster than a human can see and respond: do not let it near the best.
        if (elapsed < MIN_HUMAN_MS) {
          setLit(0);
          setReaction(null);
          setPhaseNow('anticipated');
          return;
        }

        setReaction(elapsed);
        setPhaseNow('result');
        setBest((previous) => {
          if (previous !== null && previous <= elapsed) return previous;
          try {
            localStorage.setItem(BEST_KEY, String(elapsed));
          } catch {
            /* ignore */
          }
          return elapsed;
        });
        return;
      }

      start();
    },
    [clearTimers, setPhaseNow, start],
  );

  // Registered once, so it needs the freshest handler.
  const handleInputRef = useRef(handleInput);
  useEffect(() => {
    handleInputRef.current = handleInput;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      if (event.repeat) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      // Let a focused link or button activate itself instead.
      if (tag === 'A' || tag === 'BUTTON') return;
      event.preventDefault();
      handleInputRef.current(inputTime(event));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const running = phase === 'lighting' || phase === 'waiting' || phase === 'go';
  const display = phase === 'result' && reaction !== null ? formatTime(reaction) : '00.000';

  // During a run the only thing allowed to change is the lights - any other
  // movement would be a second cue to react to.
  const message = running
    ? ' '
    : phase === 'jumpstart'
      ? 'Jump start! You went before the lights went out. Tap to try again.'
      : phase === 'anticipated'
        ? 'Too quick to be real — under 0.100 is anticipation, not reaction. Tap to try again.'
        : phase === 'result'
          ? 'Tap to race again.'
          : "Tap/click when you're ready to race, then tap again when the lights go out.";

  return (
    <div className="f1">
      <div className="home-glow" aria-hidden />

      <header className="home-bar">
        <Link href="/" className="brand brand-link" title="Back to the home page">
          <span className="brand-mark">
            <SparkIcon size={16} />
          </span>
          <span>
            <div className="brand-name">AI Playground</div>
            <div className="brand-sub">f1 reaction</div>
          </span>
        </Link>

        <nav className="home-nav" aria-label="Sections">
          <Link href="/compiler" className="home-nav-link">
            Online Compiler
            <ArrowRightIcon size={15} />
          </Link>
        </nav>
      </header>

      <main
        className="f1-stage"
        data-phase={phase}
        role="button"
        tabIndex={0}
        aria-label="F1 start lights reaction test. Tap when the lights go out."
        onPointerDown={(event) => {
          event.preventDefault();
          handleInput(inputTime(event.nativeEvent));
        }}
      >
        <div className="f1-gantry" aria-hidden>
          {Array.from({ length: LIGHT_COLUMNS }, (_, index) => (
            <div className="f1-column" key={index}>
              <span className={`f1-light${index < lit ? ' is-on' : ''}`} />
              <span className={`f1-light${index < lit ? ' is-on' : ''}`} />
            </div>
          ))}
        </div>

        <div className="f1-readout">
          <div className="f1-time" aria-live="polite">
            {display}
          </div>
          <div className="f1-best">Your best: {best === null ? '00.000' : formatTime(best)}</div>
        </div>

        <p className="f1-message">{message}</p>
      </main>
    </div>
  );
}
