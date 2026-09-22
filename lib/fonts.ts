/**
 * Code font registry.
 *
 * Web fonts are fetched only when a font is actually selected, so the default
 * load stays light. Monaco caches character widths, so anything that changes
 * the font must wait for it to finish loading and then call remeasureFonts()
 * or the caret ends up drifting away from the glyphs.
 */

export type FontGroup = 'Professional' | 'Smooth' | 'Funky' | 'System';

export interface FontOption {
  id: string;
  label: string;
  group: FontGroup;
  /** CSS family name, used for document.fonts.load(). Null for system stacks. */
  family: string | null;
  /** Full CSS font-family stack handed to Monaco and the console. */
  stack: string;
  /** Google Fonts family spec, omitted for fonts that need no download. */
  google?: string;
  /** Whether the face actually has programming ligatures. */
  ligatures: boolean;
  note: string;
}

const SYSTEM_FALLBACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export const FONTS: FontOption[] = [
  {
    id: 'system',
    label: 'System Mono',
    group: 'System',
    family: null,
    stack: `ui-monospace, SFMono-Regular, "Cascadia Code", "Segoe UI Mono", Menlo, Consolas, monospace`,
    ligatures: true,
    note: 'Whatever your OS ships. No download.',
  },
  {
    id: 'jetbrains',
    label: 'JetBrains Mono',
    group: 'Professional',
    family: 'JetBrains Mono',
    stack: `"JetBrains Mono", ${SYSTEM_FALLBACK}`,
    google: 'JetBrains+Mono:wght@400;500;700',
    ligatures: true,
    note: 'Tall x-height, built for long sessions.',
  },
  {
    id: 'ibm-plex',
    label: 'IBM Plex Mono',
    group: 'Professional',
    family: 'IBM Plex Mono',
    stack: `"IBM Plex Mono", ${SYSTEM_FALLBACK}`,
    google: 'IBM+Plex+Mono:wght@400;500;700',
    ligatures: false,
    note: 'Crisp and corporate, very legible.',
  },
  {
    id: 'source-code-pro',
    label: 'Source Code Pro',
    group: 'Professional',
    family: 'Source Code Pro',
    stack: `"Source Code Pro", ${SYSTEM_FALLBACK}`,
    google: 'Source+Code+Pro:wght@400;500;700',
    ligatures: false,
    note: 'Adobe classic. Neutral and safe.',
  },
  {
    id: 'roboto-mono',
    label: 'Roboto Mono',
    group: 'Professional',
    family: 'Roboto Mono',
    stack: `"Roboto Mono", ${SYSTEM_FALLBACK}`,
    google: 'Roboto+Mono:wght@400;500;700',
    ligatures: false,
    note: 'Even colour, nothing distracting.',
  },
  {
    id: 'fira-code',
    label: 'Fira Code',
    group: 'Smooth',
    family: 'Fira Code',
    stack: `"Fira Code", ${SYSTEM_FALLBACK}`,
    google: 'Fira+Code:wght@400;500;700',
    ligatures: true,
    note: 'The original ligature font. Rounded.',
  },
  {
    id: 'inconsolata',
    label: 'Inconsolata',
    group: 'Smooth',
    family: 'Inconsolata',
    stack: `"Inconsolata", ${SYSTEM_FALLBACK}`,
    google: 'Inconsolata:wght@400;500;700',
    ligatures: false,
    note: 'Narrow and humanist. Fits more code.',
  },
  {
    id: 'space-mono',
    label: 'Space Mono',
    group: 'Funky',
    family: 'Space Mono',
    stack: `"Space Mono", ${SYSTEM_FALLBACK}`,
    google: 'Space+Mono:wght@400;700',
    ligatures: false,
    note: 'Retro-futurist, quirky curves.',
  },
  {
    id: 'victor-mono',
    label: 'Victor Mono',
    group: 'Funky',
    family: 'Victor Mono',
    stack: `"Victor Mono", ${SYSTEM_FALLBACK}`,
    google: 'Victor+Mono:ital,wght@0,400;0,500;0,700;1,400;1,500',
    ligatures: true,
    note: 'Cursive italic comments. Distinctive.',
  },
  {
    id: 'courier-prime',
    label: 'Courier Prime',
    group: 'Funky',
    family: 'Courier Prime',
    stack: `"Courier Prime", ${SYSTEM_FALLBACK}`,
    google: 'Courier+Prime:ital,wght@0,400;0,700;1,400',
    ligatures: false,
    note: 'Typewriter. Screenplay energy.',
  },
];

export const FONT_GROUPS: FontGroup[] = ['Professional', 'Smooth', 'Funky', 'System'];

export const DEFAULT_FONT_ID = 'jetbrains';

export const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20];

export function getFont(id: string): FontOption {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

const requested = new Set<string>();

/**
 * Injects the stylesheet if needed and resolves once the glyphs are usable.
 * Resolves rather than rejects on failure - a blocked CDN should silently fall
 * back to the system stack, not break the editor.
 */
export async function ensureFontLoaded(font: FontOption): Promise<void> {
  if (!font.google || !font.family) return;

  if (!requested.has(font.id)) {
    requested.add(font.id);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
    link.dataset.fontId = font.id;

    const stylesheetReady = new Promise<void>((resolve) => {
      link.onload = () => resolve();
      link.onerror = () => resolve();
      // Never let a hanging CDN hold the editor hostage.
      setTimeout(resolve, 5000);
    });

    document.head.appendChild(link);
    await stylesheetReady;
  }

  try {
    const family = JSON.stringify(font.family);
    await Promise.all([
      document.fonts.load(`400 14px ${family}`),
      document.fonts.load(`700 14px ${family}`),
    ]);
    await document.fonts.ready;
  } catch {
    /* Font Loading API unavailable - the fallback stack still renders. */
  }
}
