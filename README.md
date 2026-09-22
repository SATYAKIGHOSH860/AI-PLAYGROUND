# AI Playground

An online compiler for **Python, C and C++** — write code, run it, read the
errors. Monaco (the editor from VS Code) on the front, a two-engine execution
layer behind it.

```
/              landing page  ──►  "Tap to begin"
/compiler      the editor
/type-test     typing speed test
/f1-reaction   F1 start lights reaction test

Python  ──►  Pyodide (CPython 3.12 → WASM)  ──►  runs in your browser tab
C / C++ ──►  /api/run  ──►  gcc 13.2.0 on a compiler service
```

---

## What it does

| | |
|---|---|
| **Home page** | A landing page at `/` with **Tap to begin** in the middle, and **Type-Test**, **F1-Reaction** and **Online Compiler** sections in the top bar. Enter, Space, the button or the nav link all open the editor. |
| **Type-Test** | A typing speed test — words per minute, accuracy, raw speed, in time or word-count mode. |
| **F1-Reaction** | A reaction test on the real Formula 1 start procedure — five pairs of lights, a random hold, then go. Measured to within a couple of milliseconds. |
| **Editor** | Monaco — the real VS Code editor. Syntax highlighting, bracket matching, multi-cursor, per-language undo history. |
| **Python** | Runs **entirely in the browser** via Pyodide. No network round trip, no rate limit, no queue. Output streams line by line as `print()` happens. |
| **C / C++** | Compiled by gcc 13.2.0 with `-std=c17` / `-std=c++17`, `-O2 -Wall -Wextra`. |
| **stdin** | The Input tab is piped to the program's standard input. |
| **Errors** | Compiler errors and Python tracebacks become red squiggles on the exact line, plus a clickable Problems list. |
| **Exit status** | Real exit codes. Signals are named — `SIGSEGV - segmentation fault`, not `exit 139`. |
| **Stop** | Kills a runaway loop instantly for Python (the worker is terminated). |
| **Share** | One click copies a link with the code encoded in the URL fragment. Nothing is stored server-side. |
| **Persistence** | Code, input, language and every appearance setting are kept per browser in `localStorage`. |
| **Themes** | 10 themes grouped **Professional / Smooth / Funky**. One click restyles the whole app, not just the editor. |
| **Fonts** | 10 code fonts with live preview, adjustable size and an optional ligature switch. |
| **Auto-suggest** | Curated keyword, standard-library and snippet completions — toggled on or off with one tap. |
| **Typing sounds** | 5 synthesised keyboard sounds (Clicky, Typewriter, Soft, Thock, Retro). Tap the speaker to mute or unmute. |

Keyboard: **Ctrl+Enter** (**Cmd+Enter** on macOS) runs, from anywhere on the page.
**Ctrl+Space** opens suggestions on demand, even with auto-suggest switched off.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

No configuration and no API keys are needed. `.env` is entirely optional.

```bash
npm run build && npm start   # production build
npm run smoke                # verify the execution API end to end
npm run typecheck            # tsc --noEmit
```

---

## Deploying to Vercel

The project is a stock Next.js App Router app, so it deploys with no special
configuration.

```bash
npm i -g vercel
vercel          # preview
vercel --prod   # production
```

Or push to GitHub and import the repo at [vercel.com/new](https://vercel.com/new)
— Vercel detects Next.js and needs no build settings from you. No environment
variables are required.

After deploying, confirm the compiler path works:

```bash
BASE_URL=https://your-app.vercel.app npm run smoke
```

### A note on Streamlit

Streamlit is not a good host for this app and it is not supported here. Streamlit
renders a Python-driven page and reruns your script on every interaction; this
project is a client-side editor that needs to keep Monaco and a Pyodide worker
alive across interactions. Embedding it in `components.html` would cost you the
keyboard shortcuts, the URL sharing and the smooth resizing — the things that
make it feel like a real compiler. Vercel (or any Node host, or Netlify) is the
right target.

---

## Type-Test

A typing speed test at `/type-test`. Words appear three lines at a time and
scroll as you pass the middle line; every character is coloured as you type it —
correct, wrong, or an extra you tacked onto the end of a word. Space moves on,
and backspace walks back into a previous word only if you got it wrong.

Modes: **time** (15/30/60/120s) or **words** (10/25/50/100), with optional
punctuation and numbers. Restart with the button, <kbd>Tab</kbd> or
<kbd>Esc</kbd>.

The same five **typing sounds** as the editor are available from the speaker in
the top bar — every keystroke including backspace, silent on auto-repeat. The
choice is stored in the same settings the compiler reads, so a sound picked in
either place follows you to the other.

Two measurement rules carry the whole thing
([`components/TypeTest.tsx`](components/TypeTest.tsx)):

- **Accuracy is counted per keystroke, as it happens** — not from the finished
  text. Backspacing over a mistake fixes the words, but it must not erase the
  fact that you mistyped, or accuracy would just measure whether you bothered
  to correct yourself.
- **WPM uses the standard definition of a word as five characters**, measured
  on correctly typed characters only, so speed cannot be gamed by mashing.
  Raw counts everything typed; the gap between the two is your error rate.

The caret is **not part of the text flow**. It is absolutely positioned and
moved with a transform, so it glides between characters the way the editor's
cursor does and can never nudge a letter sideways as it passes. Horizontal
moves glide; line breaks jump, because sliding diagonally fights the scroll
animation running at the same time.

Every page that shows monospace text calls `applySavedAppearance()`, which both
paints the theme and **downloads the chosen code font**. Applying the theme
alone would set `--font-mono` to a family that was never fetched, and the page
would quietly fall back to the system stack and look nothing like the editor.

The word list in [`lib/typingWords.ts`](lib/typingWords.ts) is deliberately the
most common English words. Rare words make people stop and read, and reading
time is not typing speed.

---

## F1-Reaction

A reaction test at `/f1-reaction`, built on the actual FIA start procedure:
**five pairs of red lights** illuminate one pair per second, then after a
**random hold of 0.2s to 3s** they all go out at once. That is the signal.
Going before they go out is a **jump start**, exactly as it is on the grid.

The whole point is the measurement, so two things matter more than anything on
screen ([`components/F1Reaction.tsx`](components/F1Reaction.tsx)):

- **The clock starts when the lights-out frame is painted**, not when the timer
  fired. Those differ by up to a frame, and a frame is 16ms of a ~200ms score.
  The state change is committed with `flushSync` so the very next frame is the
  one that paints it, and that frame's `requestAnimationFrame` timestamp is
  taken as the moment the signal became visible.
- **The clock stops when the input happened**, not when React got round to it,
  which is why `event.timeStamp` is preferred over reading the clock inside
  the handler.

Measured drift against known delays: **0.6ms, 0.9ms and 2.0ms** for 150ms,
320ms and 500ms reactions.

Two details that are easy to get wrong:

- **The lights have no CSS transition.** A fade would blur the very moment the
  stopwatch starts from.
- **Nothing else on screen moves during a run.** The message keeps a fixed
  height and the timer stays at `00.000`, so the lights are the only thing
  there is to react to.

Anything under **0.100s** is rejected as anticipation rather than scored. Nobody
sees a light and presses a button that fast — below that the input was already
in flight — and without the floor a single lucky mash would write an impossible
time into your saved best and it would never come back.

---

## Look and feel

Everything lives behind the sliders button in the top bar.

### Themes

One definition in [`lib/themes.ts`](lib/themes.ts) drives both the app chrome
(CSS custom properties) and the Monaco theme, so the editor can never drift out
of step with the UI around it — including the autocomplete popup and hover
cards, which are themed too.

| Group | Themes |
|---|---|
| **Professional** | Midnight, Daylight, GitHub Dark, Solarized Light |
| **Smooth** | Nord, Gruvbox, Rosé Pine Dawn |
| **Funky** | Dracula, Synthwave, Monokai |

Your choice is written to `localStorage` and the three dominant colours are
replayed by a tiny pre-paint script in [`app/layout.tsx`](app/layout.tsx), so a
reload never flashes the wrong scheme.

### Fonts

Ten faces across the same groups — JetBrains Mono, IBM Plex Mono, Source Code
Pro and Roboto Mono for work; Fira Code and Inconsolata for something softer;
Space Mono, Victor Mono and Courier Prime when you want character; plus your
system monospace, which needs no download.

Web fonts are fetched from Google Fonts **only when selected**, so the default
load stays light. The panel previews each face at your chosen size before you
commit. Size runs 12–20px, and ligatures are a separate switch that greys out
for fonts that do not have any.

> Monaco caches glyph widths at mount, so a font arriving later leaves the caret
> drifting away from the text. [`components/CodeEditor.tsx`](components/CodeEditor.tsx)
> waits for the face to be usable and then calls `remeasureFonts()`, which is
> what keeps the cursor glued to the characters.

### Auto-suggest

Monaco on its own only offers *word-based* suggestions — it echoes words already
in your buffer, which is close to useless while writing something new.
[`lib/completions.ts`](lib/completions.ts) adds real completions per language:

- **Python** — keywords, 35 builtins, and snippets (`main`, `def`, `class`, `for`, `fori`, `try`, `with`, `readints`)
- **C** — keywords, `<stdio.h>`/`<stdlib.h>`/`<string.h>` functions, and snippets (`main`, `for`, `printf`, `scanf`, `struct`)
- **C++** — keywords, 30 `std::` names, and snippets (`main`, `fastio`, `foreach`, `cout`, `vector`, `readvec`, `class`)

C and C++ share one Monaco tokenizer, so the provider picks its list from the
file name. Turning the toggle **off** silences the popup that appears as you
type; **Ctrl+Space** still opens it on demand, which is what people expect from
"turn autocomplete off".

### Typing sounds

The speaker button in the top bar mutes and unmutes; the chevron beside it picks
the sound.

| Sound | Character |
|---|---|
| **Clicky** | Modern mechanical board. Crisp and bright. |
| **Typewriter** | Old mechanical. Metallic strike, and a bell on Enter. |
| **Soft** | Laptop membrane. Quiet and muted. |
| **Thock** | Deep and creamy. Easy on long sessions. |
| **Retro** | Old PC beep. Square wave, 8-bit energy. |

Every sound is **synthesised at runtime** with the Web Audio API
([`lib/keySounds.ts`](lib/keySounds.ts)) — there are no audio files to
download, so the very first keypress is already in time. A keystroke is a
filtered noise burst plus a decaying tone, which is what a key press is
acoustically: Clicky is a 2.6 kHz bandpass with a bright 5.2 kHz tick, Thock is
a 520 Hz lowpass over a 78 Hz sine, Retro is a plain square-wave blip.

Three details are what keep it from grating:

- **Every voice is jittered** in pitch and gain, so repeated keys never sound
  like one sample being retriggered.
- **Space, Enter and Backspace have their own character** — bigger keys sit
  lower and hit harder, and Typewriter rings its carriage bell on Enter.
- **Auto-repeat is silent** and voices are rate-limited, so holding Backspace or
  pasting a block does not turn into a machine gun.

Sound plays only while you are typing in the editor or the Input tab, never when
you are using the UI. It is **off by default** — audio that starts without being
asked for is hostile, and browsers block it before a user gesture anyway.
Choosing a sound from the menu unmutes and previews it, since picking one is a
clear signal that you want to hear it.

---

## How execution works

### Python — in the browser

Pyodide is CPython compiled to WebAssembly. It is loaded inside a **Web Worker**
([`public/pyodide-worker.js`](public/pyodide-worker.js)) so a `while True:` loop
freezes the worker and not your tab — which is also what makes **Stop**
instantaneous: the worker is terminated outright.

Your code is written to `main.py` in Pyodide's virtual filesystem and executed
through `runpy`, so `__name__ == "__main__"` behaves normally and tracebacks
quote real `main.py` line numbers. The harness then trims its own frames off the
traceback, so you see your call stack and nothing else:

```
Traceback (most recent call last):
  File "main.py", line 7, in <module>
    outer()
  File "main.py", line 5, in outer
    inner()
  File "main.py", line 2, in inner
    raise ValueError("boom")
ValueError: boom
```

The first run downloads roughly 10 MB of runtime (cached afterwards); the
playground pre-warms it in the background while you type. Runs after that start
in milliseconds.

You can force Python onto the server with the **Engine** dropdown — useful for
comparing behaviour, since Pyodide has no threads and no sockets.

### C and C++ — on the server

`POST /api/run` normalises several backends behind one response shape
([`lib/providers.ts`](lib/providers.ts)):

| Provider | When it is used |
|---|---|
| **Piston** | Only when `PISTON_URL` is set. Self-hosted, no third-party limits — best for production. |
| **Wandbox** | Default. Keyless, synchronous, gcc 13.2.0. |
| **Paiza** | Fallback if Wandbox is slow or down. Runs **clang**, not gcc. |

The status bar always names the toolchain that actually served you, because the
fallback is not a drop-in: clang words its diagnostics differently from gcc
(`use of undeclared identifier 'x'` versus `'x' was not declared in this
scope`). If an error message suddenly changes shape, the status bar tells you
why.

Each provider gets its own 25s ceiling inside a 45s overall budget, so one slow
service is abandoned early and the next one still gets a chance.

### Abuse protection

`/api/run` is an open code-execution proxy, so [`lib/rateLimit.ts`](lib/rateLimit.ts)
puts two guards in front of it. They protect different things:

| Guard | Default | Protects |
|---|---|---|
| Runs per minute, per IP | 15 | The shared public compilers. A script hammering them gets **your deployment** blocked, which breaks C/C++ for every visitor — not just the abuser. |
| Simultaneous runs, per IP | 2 | Your hosting bill. Each run holds a serverless function open for a couple of seconds, so fifty tabs pressing Run at once costs far more than fifty runs spread out. |

Both are configurable, and `0` turns either off. A person never notices them:
15 runs a minute is one every four seconds, and a student fixing errors presses
Run three to five times a minute.

Two deliberate details:

- **Throttling happens after validation.** Rejecting a malformed request costs
  nothing, so a buggy client never burns a real user's allowance.
- **Nothing is committed until both guards pass**, so a request refused for
  concurrency does not also spend a per-minute token on a run that never
  happened.

Refusals return `429` with `Retry-After` and `RateLimit-*` headers, and a
message the editor shows verbatim:
`Too many runs from this connection (limit 15 per minute). Try again in 56s.`

State is held in module memory, which on a serverless host means *per warm
instance* — so the limit is approximate rather than exact. That is the trade
that keeps it free: no database, no signup, no cost. It catches the realistic
abuse case, and you can swap in a shared store if you ever need an exact global
limit.

**Browser Python is never affected** — it does not touch the server at all.

> The public Piston API became whitelist-only in February 2026, which is why it
> is no longer the default. If you self-host Piston you get the best experience:
>
> ```bash
> docker run -d -p 2000:2000 --privileged ghcr.io/engineer-man/piston
> # .env
> PISTON_URL=http://localhost:2000/api/v2
> ```

---

## Configuration

Every variable is optional — see [`.env.example`](.env.example).

| Variable | Default | Purpose |
|---|---|---|
| `PISTON_URL` | *(unset)* | Self-hosted Piston. Becomes the first provider when set. |
| `EXECUTION_PROVIDERS` | `piston,wandbox,paiza` | Provider order. |
| `RUN_TIMEOUT_MS` | `45000` | Total budget for one request. |
| `PROVIDER_TIMEOUT_MS` | `25000` | Ceiling for a single provider attempt. |
| `RATE_LIMIT_PER_MINUTE` | `15` | Runs per minute per IP. `0` disables. |
| `RATE_LIMIT_CONCURRENT` | `2` | Simultaneous runs per IP. `0` disables. |

`GET /api/health` reports which providers a deployment resolved.

---

## Project layout

```
app/
  page.tsx              landing page
  compiler/page.tsx     the editor
  type-test/page.tsx    the typing test
  f1-reaction/page.tsx  the reaction test
  api/run/route.ts      validation, throttling, timeout budget, error mapping
  api/health/route.ts   which providers and limits are active
  layout.tsx            theme bootstrap (applied before first paint)
  globals.css           design tokens, dark + light
components/
  Landing.tsx           home page: hero, nav, entrance animation
  F1Reaction.tsx        start lights, frame-accurate timing
  TypeTest.tsx          typing test: live correctness, wpm, accuracy
  Playground.tsx        app shell, run orchestration, output batching
  CodeEditor.tsx        Monaco wrapper, themes, fonts, inline markers
  SettingsMenu.tsx      theme / font / auto-suggest panel
  SoundMenu.tsx         typing-sound picker and mute button
  OutputPanel.tsx       Output / Input / Problems tabs
  SplitPane.tsx         draggable split, horizontal and vertical
lib/
  providers.ts          Piston / Wandbox / Paiza behind one shape
  rateLimit.ts          per-IP run window and concurrency cap
  diagnostics.ts        gcc + Python traceback → editor markers
  browserRunner.ts      Pyodide worker lifecycle
  applyTheme.ts         one palette shared by the landing page and the editor
  themes.ts             10 themes → CSS variables + Monaco theme data
  fonts.ts              10 code fonts, loaded on demand
  completions.ts        curated Python / C / C++ suggestions
  keySounds.ts          Web Audio typing-sound synthesis
  typingWords.ts        common-word source for the typing test
  settings.ts           appearance settings and validation
  languages.ts          per-language config and starter templates
public/
  pyodide-worker.js     the Python runtime worker
scripts/
  smoke-test.mjs        end-to-end check of the execution API
```

Monaco is loaded from a CDN rather than bundled, which is why the first load is
only ~97 kB of JavaScript.

---

## Things worth knowing

- **`printf` output can vanish on a crash.** C stdout is block-buffered when it
  is piped, so an unflushed buffer is lost if the program segfaults. Add
  `fflush(stdout)` — or write to `stderr`, which is unbuffered. This is real C
  behaviour, identical to any online judge, not something the playground drops.
- **Python in the browser has no threads, sockets or subprocesses**, and
  `asyncio.run()` will not work because the browser already owns the event loop.
  Switch the Engine to *server* if you need them.
- **Programs are killed after a few seconds** of CPU on the server side, and
  in-browser Python auto-stops after 30s so a runaway loop cannot hang forever.
- **One file per program.** No multi-file projects, no third-party packages.
- Console output is trimmed to the last 200,000 characters so a runaway loop
  cannot take the tab down with it.
- The free public compiler services are shared and occasionally slow. Set
  `PISTON_URL` for consistent latency.

---

## Verification

Built and exercised against a real browser (Edge/Chromium) and the live
compiler backends:

- 21/21 Type-Test sound checks - silent while muted, real Web Audio voices on
  every keystroke including backspace, one voice per key rather than a flood,
  a single AudioContext, silent on keys pressed outside the typing area, the
  setting shared both ways with the compiler, and 60fps sustained with sound on
- 50/50 Type-Test checks - live per-character correctness, wpm verified
  against its own character count and clock, accuracy that survives a
  correction, both modes ending by themselves, backspace across words,
  punctuation and numbers, three-line scrolling, focus handling and theming
- 47/47 F1-Reaction checks - five pairs of lights one second apart, the hold
  inside the FIA window and randomised between runs, reaction measured within
  45ms of a known delay (actual drift 0.6-2.0ms), jump start, sub-human times
  rejected, best time kept and persisted, keyboard, theming and layout
- 18/18 landing-page checks — "Tap to begin" is centred, the top-bar section
  and the button both open the editor, Enter starts it, the brand returns home,
  the theme carries across both pages, old `/#…` share links are forwarded with
  their code intact, and nothing overflows at 400px
- 8/8 execution-API checks — all three languages, compile errors, signals, exit
  codes, input validation (`npm run smoke`)
- 28/28 browser checks — Monaco, in-browser Python, stdin, tracebacks, inline
  markers, C and C++ compilation, theme, persistence, no console errors
- 19/19 interaction checks — Stop on an infinite loop, re-running after a stop,
  engine switching, share round trip, reset
- 31/31 appearance checks — every theme group, theme applied to app *and*
  editor, web fonts actually downloading, Monaco re-measuring after a font
  swap, font size, ligature switch, auto-suggest on/off, Ctrl+Space fallback,
  and all of it surviving a reload
- 23/23 typing-sound checks — silent while muted, real Web Audio voices on
  keystrokes (verified by instrumenting `AudioContext`, not by trusting the UI),
  one voice per key rather than a flood, a single AudioContext for the page,
  sound in the editor and Input tab but never on UI keys, mute/unmute, volume,
  and persistence
- 8/8 sound-synthesis checks — all five profiles render measurably different
  audio graphs, Retro is a square beep, Thock is the deepest, Typewriter rings
  a bell on Enter
- 18/18 rate-limit checks — the window and the concurrency cap both bite,
  invalid requests cost no allowance, a concurrency refusal spends no token,
  clients are isolated from each other, slots are released after every run,
  and refusals carry `Retry-After` and `RateLimit-*` headers
- 6/6 throttled-user checks — the refusal renders as a readable message in the
  console rather than a crash, and browser Python keeps working while the
  server side is throttling
- Python harness verified against CPython 3.12 for traceback trimming, exit
  codes, stdin and unicode
