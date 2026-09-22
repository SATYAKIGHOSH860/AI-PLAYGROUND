'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { applySavedAppearance } from '@/lib/applyTheme';
import { ArrowRightIcon, SparkIcon } from './Icons';

const COMPILER_PATH = '/compiler';

export default function Landing() {
  const router = useRouter();

  useEffect(() => {
    // Paint the same palette the compiler is using, so stepping through to it
    // never changes colour underneath you.
    void applySavedAppearance();

    // The compiler used to live at "/", so older share links point here with
    // the snippet in the fragment. Forward them rather than dropping the code.
    const fragment = window.location.hash.replace(/^#/, '');
    if (fragment.length > 8) {
      router.replace(`${COMPILER_PATH}#${fragment}`);
      return;
    }

    router.prefetch(COMPILER_PATH);
  }, [router]);

  // Enter or Space anywhere starts it, the way a "press any key" screen does.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      // Let the focused link or button handle its own activation.
      if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA') return;
      event.preventDefault();
      router.push(COMPILER_PATH);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  return (
    <div className="home">
      <div className="home-glow" aria-hidden />

      <header className="home-bar">
        <div className="brand">
          <span className="brand-mark">
            <SparkIcon size={16} />
          </span>
          <span>
            <div className="brand-name">AI Playground</div>
            <div className="brand-sub">write · run · debug</div>
          </span>
        </div>

        <nav className="home-nav" aria-label="Sections">
          <Link href="/type-test" className="home-nav-link is-quiet">
            Type-Test
          </Link>
          <Link href="/f1-reaction" className="home-nav-link is-quiet">
            F1-Reaction
          </Link>
          <Link href={COMPILER_PATH} className="home-nav-link">
            Online Compiler
            <ArrowRightIcon size={15} />
          </Link>
        </nav>
      </header>

      <main className="home-main">
        <h1 className="home-title home-rise d1">Write it. Run it. See what broke.</h1>

        <p className="home-sub home-rise d2">
          Python, C and C++ in your browser. No sign-up, no install — Python runs on your own
          machine, C and C++ compile with gcc.
        </p>

        <Link href={COMPILER_PATH} className="home-cta home-rise d3">
          Tap to begin
          <ArrowRightIcon size={22} />
        </Link>

        <div className="home-langs home-rise d4" aria-hidden>
          <span className="home-lang">main.py</span>
          <span className="home-lang">main.c</span>
          <span className="home-lang">main.cpp</span>
        </div>

        <p className="home-note home-rise d5">
          Press <kbd className="home-kbd">Enter</kbd> to start
        </p>
      </main>
    </div>
  );
}
