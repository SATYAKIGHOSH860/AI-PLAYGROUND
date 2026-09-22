'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { applySavedAppearance, persistSettings } from '@/lib/applyTheme';
import { defaultSettings, type PlaygroundSettings } from '@/lib/settings';
import { KeySoundPlayer } from '@/lib/keySounds';
import { generateWords } from '@/lib/typingWords';
import SoundMenu from './SoundMenu';
import { ArrowRightIcon, ResetIcon, SparkIcon } from './Icons';

/**
 * A typing speed test.
 *
 * Two mechanics carry the whole thing:
 *
 *   - Accuracy is counted per keystroke as it happens, not from the finished
 *     text. Backspacing over a mistake fixes the words but must not erase the
 *     fact that you mistyped, or accuracy becomes meaningless.
 *   - WPM uses the standard definition of a word as five characters, measured
 *     on correctly typed characters only, so speed cannot be gamed by mashing.
 */

type Mode = 'time' | 'words';
type Status = 'idle' | 'running' | 'done';

const TIME_OPTIONS = [15, 30, 60, 120];
const WORD_OPTIONS = [10, 25, 50, 100];

/** Words held in reserve in time mode, topped up as the caret approaches. */
const BUFFER_WORDS = 60;
const BUFFER_REFILL_AT = 20;

const BEST_KEY = 'playground:type-best';

interface Keystrokes {
  total: number;
  correct: number;
}

export default function TypeTest() {
  const [mode, setMode] = useState<Mode>('time');
  const [amount, setAmount] = useState(30);
  const [punctuation, setPunctuation] = useState(false);
  const [numbers, setNumbers] = useState(false);

  const [words, setWords] = useState<string[]>([]);
  const [typedWords, setTypedWords] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [wordIndex, setWordIndex] = useState(0);

  const [status, setStatus] = useState<Status>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [finalElapsed, setFinalElapsed] = useState(0);
  const [focused, setFocused] = useState(true);
  const [best, setBest] = useState<number | null>(null);
  const [settings, setSettings] = useState<PlaygroundSettings>(() => defaultSettings(false));

  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const caretY = useRef(0);
  const soundRef = useRef<KeySoundPlayer | null>(null);
  const settingsRef = useRef(settings);
  const keys = useRef<Keystrokes>({ total: 0, correct: 0 });
  const startedAt = useRef(0);
  const ticker = useRef<number | null>(null);
  const statusRef = useRef<Status>('idle');

  const setStatusNow = useCallback((next: Status) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const stopTicker = useCallback(() => {
    if (ticker.current !== null) {
      window.clearInterval(ticker.current);
      ticker.current = null;
    }
  }, []);

  const restart = useCallback(() => {
    stopTicker();
    keys.current = { total: 0, correct: 0 };
    startedAt.current = 0;
    const count = mode === 'words' ? amount : BUFFER_WORDS;
    setWords(generateWords(count, { punctuation, numbers }));
    setTypedWords([]);
    setCurrent('');
    setWordIndex(0);
    setElapsed(0);
    setFinalElapsed(0);
    setStatusNow('idle');
    inputRef.current?.focus();
  }, [amount, mode, numbers, punctuation, setStatusNow, stopTicker]);

  // Regenerate whenever the test shape changes.
  useEffect(() => {
    restart();
  }, [restart]);

  useEffect(() => {
    // Same saved settings the compiler uses, so the sound you picked there is
    // the sound you get here.
    const saved = applySavedAppearance();
    settingsRef.current = saved;
    setSettings(saved);

    try {
      const stored = Number(localStorage.getItem(BEST_KEY));
      if (Number.isFinite(stored) && stored > 0) setBest(stored);
    } catch {
      /* storage blocked - the best just will not persist */
    }
  }, []);

  useEffect(() => stopTicker, [stopTicker]);

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

  useEffect(() => {
    return () => {
      // Browsers cap how many AudioContexts a page may hold open.
      soundRef.current?.dispose();
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<PlaygroundSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    // Shared with the compiler, so a change here follows you there.
    persistSettings(next);
  }, []);

  const previewSound = useCallback(
    (profileId: string) => {
      sound().preview(profileId);
    },
    [sound],
  );

  const finish = useCallback(
    (at: number) => {
      stopTicker();
      setFinalElapsed(at);
      setStatusNow('done');
    },
    [setStatusNow, stopTicker],
  );

  const begin = useCallback(() => {
    startedAt.current = performance.now();
    setStatusNow('running');

    ticker.current = window.setInterval(() => {
      const ms = performance.now() - startedAt.current;
      setElapsed(ms);
      // The clock is the authority in time mode, so it ends the test itself.
      if (mode === 'time' && ms >= amount * 1000) finish(amount * 1000);
    }, 100);
  }, [amount, finish, mode, setStatusNow]);

  const commitWord = useCallback(
    (typedText: string, viaSpace: boolean) => {
      const target = words[wordIndex] ?? '';

      // The space is a keystroke too, and it is only correct if the word was.
      // The last word of a words test finishes without one, so nothing is
      // counted for a key that was never pressed.
      if (viaSpace) {
        keys.current.total += 1;
        if (typedText === target) keys.current.correct += 1;
      }

      const nextTyped = typedWords.slice();
      nextTyped[wordIndex] = typedText;
      const nextIndex = wordIndex + 1;

      setTypedWords(nextTyped);
      setWordIndex(nextIndex);
      setCurrent('');

      if (mode === 'words' && nextIndex >= words.length) {
        finish(Math.max(1, performance.now() - startedAt.current));
        return;
      }

      if (mode === 'time' && nextIndex > words.length - BUFFER_REFILL_AT) {
        setWords((previous) => [...previous, ...generateWords(BUFFER_WORDS, { punctuation, numbers })]);
      }
    },
    [finish, mode, numbers, punctuation, typedWords, wordIndex, words],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Auto-repeat means the key is still held down; real keyboards are silent
    // for those, and it stops a held Backspace machine-gunning.
    if (!event.repeat) sound().play(event.key);

    if (event.key === 'Tab' || event.key === 'Escape') {
      event.preventDefault();
      restart();
      return;
    }

    if (statusRef.current === 'done') return;

    if (event.key === ' ') {
      event.preventDefault();
      // A leading space should not skip a word.
      if (current.length === 0) return;
      if (statusRef.current === 'idle') begin();
      commitWord(current, true);
      return;
    }

    if (event.key === 'Backspace' && current.length === 0 && wordIndex > 0) {
      event.preventDefault();
      const previousTyped = typedWords[wordIndex - 1] ?? '';
      // Only worth going back if that word was actually wrong.
      if (previousTyped === words[wordIndex - 1]) return;
      setWordIndex(wordIndex - 1);
      setCurrent(previousTyped);
      setTypedWords((all) => all.slice(0, wordIndex - 1));
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (statusRef.current === 'done') return;
    const next = event.target.value;

    if (next.length > current.length) {
      if (statusRef.current === 'idle') begin();
      const target = words[wordIndex] ?? '';
      const added = next.slice(current.length);
      for (let i = 0; i < added.length; i++) {
        keys.current.total += 1;
        if (added[i] === target[current.length + i]) keys.current.correct += 1;
      }
    }
    // Deletions are deliberately not counted: a correction should fix the text
    // without rewriting history.

    setCurrent(next);

    // Finishing the final word ends a words test on the spot, so nobody is
    // left waiting to press a space that has nothing after it.
    if (mode === 'words' && wordIndex === words.length - 1 && next === words[wordIndex]) {
      commitWord(next, false);
    }
  };

  // Keep the active word on the middle line as the text scrolls past.
  useLayoutEffect(() => {
    const active = activeRef.current;
    const track = trackRef.current;
    if (!active || !track) return;
    const line = active.offsetHeight || 1;
    const offset = Math.max(0, active.offsetTop - line);
    track.style.transform = `translateY(-${offset}px)`;
  }, [wordIndex, words, mode, amount, punctuation, numbers]);

  /**
   * Glides the caret to the next character instead of teleporting it, the way
   * the editor's cursor does. It sits outside the text flow so moving it can
   * never nudge a letter sideways.
   */
  useLayoutEffect(() => {
    const word = activeRef.current;
    const caret = caretRef.current;
    const track = trackRef.current;
    if (!word || !caret || !track) return;

    const chars = word.querySelectorAll<HTMLElement>('.tt-char');
    const trackBox = track.getBoundingClientRect();

    let box: DOMRect;
    let afterLast = false;
    if (chars.length === 0) {
      box = word.getBoundingClientRect();
    } else if (current.length < chars.length) {
      box = chars[current.length].getBoundingClientRect();
    } else {
      box = chars[chars.length - 1].getBoundingClientRect();
      afterLast = true;
    }

    const x = box.left - trackBox.left + (afterLast ? box.width : 0);
    const y = box.top - trackBox.top;

    // Sliding diagonally across a line break fights the scroll animation, so
    // vertical moves jump and only horizontal ones glide.
    const jumped = Math.abs(y - caretY.current) > box.height * 0.6;
    caret.style.height = `${box.height}px`;
    if (jumped) caret.style.transition = 'none';
    caret.style.transform = `translate(${x}px, ${y}px)`;
    if (jumped) {
      void caret.offsetHeight;
      caret.style.transition = '';
    }
    caretY.current = y;

    // Solid while typing, blinking again once you pause.
    caret.style.animation = 'none';
    void caret.offsetHeight;
    caret.style.animation = '';
  }, [current, wordIndex, words]);

  const stats = useMemo(() => {
    let correct = 0;
    let incorrect = 0;
    let extra = 0;
    let missed = 0;

    for (let i = 0; i < wordIndex; i++) {
      const target = words[i] ?? '';
      const typed = typedWords[i] ?? '';
      const shared = Math.min(target.length, typed.length);
      for (let j = 0; j < shared; j++) {
        if (typed[j] === target[j]) correct += 1;
        else incorrect += 1;
      }
      if (typed.length > target.length) extra += typed.length - target.length;
      else missed += target.length - typed.length;
      // A correctly finished word earns its separating space.
      if (typed === target) correct += 1;
    }

    const target = words[wordIndex] ?? '';
    for (let j = 0; j < current.length; j++) {
      if (j >= target.length) extra += 1;
      else if (current[j] === target[j]) correct += 1;
      else incorrect += 1;
    }

    const ms = status === 'done' ? finalElapsed : elapsed;
    const minutes = ms / 60000;
    const wpm = minutes > 0 ? correct / 5 / minutes : 0;
    const raw = minutes > 0 ? (correct + incorrect + extra) / 5 / minutes : 0;
    const accuracy = keys.current.total > 0 ? (keys.current.correct / keys.current.total) * 100 : 100;

    return { correct, incorrect, extra, missed, wpm, raw, accuracy, ms };
  }, [current, elapsed, finalElapsed, status, typedWords, wordIndex, words]);

  // Record the best once the run is over.
  useEffect(() => {
    if (status !== 'done') return;
    const wpm = Math.round(stats.wpm);
    if (!Number.isFinite(wpm) || wpm <= 0) return;
    setBest((previous) => {
      if (previous !== null && previous >= wpm) return previous;
      try {
        localStorage.setItem(BEST_KEY, String(wpm));
      } catch {
        /* ignore */
      }
      return wpm;
    });
  }, [status, stats.wpm]);

  const remaining =
    mode === 'time'
      ? Math.max(0, Math.ceil(amount - (status === 'done' ? finalElapsed : elapsed) / 1000))
      : amount - wordIndex;

  return (
    <div className="home tt">
      <div className="home-glow" aria-hidden />

      <header className="home-bar">
        <Link href="/" className="brand brand-link" title="Back to the home page">
          <span className="brand-mark">
            <SparkIcon size={16} />
          </span>
          <span>
            <div className="brand-name">AI Playground</div>
            <div className="brand-sub">type test</div>
          </span>
        </Link>

        <nav className="home-nav" aria-label="Sections">
          <SoundMenu settings={settings} onChange={updateSettings} onPreview={previewSound} />
          <Link href="/compiler" className="home-nav-link">
            Online Compiler
            <ArrowRightIcon size={15} />
          </Link>
        </nav>
      </header>

      <main className="tt-main">
        {/* ------------------------------------------------------ config --- */}
        <div className={`tt-config${status === 'running' ? ' is-hidden' : ''}`}>
          <div className="tt-group">
            <button
              type="button"
              className={`tt-opt${!punctuation ? '' : ' is-on'}`}
              onClick={() => setPunctuation((v) => !v)}
              aria-pressed={punctuation}
            >
              punctuation
            </button>
            <button
              type="button"
              className={`tt-opt${!numbers ? '' : ' is-on'}`}
              onClick={() => setNumbers((v) => !v)}
              aria-pressed={numbers}
            >
              numbers
            </button>
          </div>

          <span className="tt-divider" aria-hidden />

          <div className="tt-group">
            {(['time', 'words'] as Mode[]).map((option) => (
              <button
                key={option}
                type="button"
                className={`tt-opt${mode === option ? ' is-on' : ''}`}
                onClick={() => {
                  setMode(option);
                  setAmount(option === 'time' ? 30 : 25);
                }}
                aria-pressed={mode === option}
              >
                {option}
              </button>
            ))}
          </div>

          <span className="tt-divider" aria-hidden />

          <div className="tt-group">
            {(mode === 'time' ? TIME_OPTIONS : WORD_OPTIONS).map((option) => (
              <button
                key={option}
                type="button"
                className={`tt-opt${amount === option ? ' is-on' : ''}`}
                onClick={() => setAmount(option)}
                aria-pressed={amount === option}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------------- test --- */}
        {status === 'done' ? (
          <div className="tt-results" role="status">
            <div className="tt-headline">
              <div className="tt-metric is-hero">
                <span className="tt-metric-label">wpm</span>
                <span className="tt-metric-value">{Math.round(stats.wpm)}</span>
              </div>
              <div className="tt-metric is-hero">
                <span className="tt-metric-label">accuracy</span>
                <span className="tt-metric-value">{Math.round(stats.accuracy)}%</span>
              </div>
            </div>

            <div className="tt-detail">
              <div className="tt-metric">
                <span className="tt-metric-label">raw</span>
                <span className="tt-metric-value">{Math.round(stats.raw)}</span>
              </div>
              <div className="tt-metric">
                <span className="tt-metric-label">characters</span>
                <span className="tt-metric-value">
                  {stats.correct}/{stats.incorrect}/{stats.extra}/{stats.missed}
                </span>
              </div>
              <div className="tt-metric">
                <span className="tt-metric-label">time</span>
                <span className="tt-metric-value">{(stats.ms / 1000).toFixed(1)}s</span>
              </div>
              <div className="tt-metric">
                <span className="tt-metric-label">test</span>
                <span className="tt-metric-value">
                  {mode} {amount}
                </span>
              </div>
            </div>

            <button type="button" className="tt-restart" onClick={restart}>
              <ResetIcon size={15} />
              Next test
            </button>
            <p className="tt-hint">
              correct / incorrect / extra / missed · press <kbd className="home-kbd">Tab</kbd> to restart
            </p>
          </div>
        ) : (
          <>
            <div className="tt-live" aria-hidden>
              <span className="tt-counter">{remaining}</span>
              {status === 'running' ? <span className="tt-wpm">{Math.round(stats.wpm)} wpm</span> : null}
            </div>

            <div
              className={`tt-surface${focused ? '' : ' is-blurred'}`}
              onPointerDown={(event) => {
                // Without this the browser moves focus to the surface after
                // the handler runs - and a plain div is not focusable, so
                // focus lands on body and every keystroke is lost.
                event.preventDefault();
                inputRef.current?.focus();
              }}
            >
              <div className="tt-words" ref={trackRef}>
                <span className="tt-caret" ref={caretRef} aria-hidden />
                {words.map((word, index) => {
                  const typed =
                    index < wordIndex ? (typedWords[index] ?? '') : index === wordIndex ? current : '';
                  const isActive = index === wordIndex;
                  const wrong = index < wordIndex && typed !== word;
                  const length = Math.max(word.length, typed.length);
                  const chars: React.ReactNode[] = [];

                  for (let j = 0; j < length; j++) {
                    const expected = word[j];
                    const actual = typed[j];
                    const state =
                      actual === undefined
                        ? 'is-pending'
                        : expected === undefined
                          ? 'is-extra'
                          : actual === expected
                            ? 'is-ok'
                            : 'is-bad';
                    chars.push(
                      <span className={`tt-char ${state}`} key={j}>
                        {expected ?? actual}
                      </span>,
                    );
                  }
                  return (
                    <span
                      key={index}
                      ref={isActive ? activeRef : undefined}
                      className={`tt-word${wrong ? ' is-wrong' : ''}`}
                    >
                      {chars}
                    </span>
                  );
                })}
              </div>

              {!focused ? <div className="tt-focus-note">Click here to start typing</div> : null}
            </div>

            <button type="button" className="tt-restart is-quiet" onClick={restart}>
              <ResetIcon size={15} />
              Restart
            </button>

            <p className="tt-hint">
              Best: {best === null ? '—' : `${best} wpm`} · press <kbd className="home-kbd">Tab</kbd> to restart
            </p>
          </>
        )}

        <input
          ref={inputRef}
          className="tt-input"
          value={current}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Typing test input"
        />
      </main>
    </div>
  );
}
