import { ensureFontLoaded, getFont } from './fonts';
import { getTheme, themeCssVariables } from './themes';
import {
  BOOTSTRAP_KEY,
  SETTINGS_KEY,
  defaultSettings,
  normaliseSettings,
  type PlaygroundSettings,
} from './settings';

/**
 * Theme plumbing shared by the landing page and the playground.
 *
 * Both pages paint from the same saved settings, so walking from the home
 * page into the compiler never changes colour underneath you.
 */

/** Reads saved settings without touching React. Safe to call on any page. */
export function loadSettings(): PlaygroundSettings {
  const prefersLight =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return normaliseSettings(raw ? JSON.parse(raw) : null, prefersLight);
  } catch {
    return defaultSettings(prefersLight);
  }
}

/** Paints the theme onto <html> as CSS custom properties. */
export function applyTheme(settings: PlaygroundSettings): void {
  const theme = getTheme(settings.themeId);
  const font = getFont(settings.fontId);
  const root = document.documentElement;

  for (const [name, value] of Object.entries(themeCssVariables(theme))) {
    root.style.setProperty(name, value);
  }
  root.style.setProperty('--font-mono', font.stack);
  root.setAttribute('data-theme', theme.appearance);
  root.style.colorScheme = theme.appearance;
}

/**
 * Paints the saved theme and pulls in the chosen code font.
 *
 * Every page that shows monospace text needs both halves: applying the theme
 * alone sets --font-mono to a family that has not been downloaded, so the page
 * silently falls back to the system stack and looks nothing like the editor.
 */
export function applySavedAppearance(): PlaygroundSettings {
  const settings = loadSettings();
  applyTheme(settings);
  // Fire and forget: the fallback stack renders until the face arrives, and
  // callers want the settings back straight away to seed their own state.
  void ensureFontLoaded(getFont(settings.fontId));
  return settings;
}

/**
 * Saves settings, plus the three dominant colours the pre-paint script in
 * layout.tsx replays so a reload never flashes the wrong scheme.
 */
export function persistSettings(settings: PlaygroundSettings): void {
  const theme = getTheme(settings.themeId);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(
      BOOTSTRAP_KEY,
      JSON.stringify({
        appearance: theme.appearance,
        bg: theme.palette.bg,
        surface: theme.palette.surface,
        text: theme.palette.text,
      }),
    );
  } catch {
    /* storage blocked - settings just will not survive a reload */
  }
}
