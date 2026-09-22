import { DEFAULT_FONT_ID, FONTS } from './fonts';
import { DEFAULT_SOUND_PROFILE, SOUND_PROFILES } from './keySounds';
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, THEMES } from './themes';

export interface PlaygroundSettings {
  themeId: string;
  fontId: string;
  fontSize: number;
  /** Render -> and != as single glyphs, where the font supports it. */
  ligatures: boolean;
  /** Pop the completion list up automatically while typing. */
  autoSuggest: boolean;
  /** Which typing sound to synthesise. */
  soundProfile: string;
  /** Master switch for typing sounds. */
  soundEnabled: boolean;
  soundVolume: number;
}

export const SETTINGS_KEY = 'playground:appearance:v1';
/** Mirrored separately so the pre-paint script can avoid a flash of dark. */
export const BOOTSTRAP_KEY = 'playground:bootstrap';

export function defaultSettings(prefersLight: boolean): PlaygroundSettings {
  return {
    themeId: prefersLight ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME,
    fontId: DEFAULT_FONT_ID,
    fontSize: 14,
    // Off by default: a learner needs to see that they typed != , not a glyph.
    ligatures: false,
    autoSuggest: true,
    soundProfile: DEFAULT_SOUND_PROFILE,
    // Off by default. Audio that starts without being asked for is hostile,
    // and browsers block it before a gesture anyway.
    soundEnabled: false,
    soundVolume: 0.6,
  };
}

/** Validates anything read back from storage - it may be stale or hand-edited. */
export function normaliseSettings(raw: unknown, prefersLight: boolean): PlaygroundSettings {
  const base = defaultSettings(prefersLight);
  if (!raw || typeof raw !== 'object') return base;

  const value = raw as Partial<PlaygroundSettings>;
  const size = Number(value.fontSize);
  const volume = Number(value.soundVolume);

  return {
    themeId: THEMES.some((t) => t.id === value.themeId) ? (value.themeId as string) : base.themeId,
    fontId: FONTS.some((f) => f.id === value.fontId) ? (value.fontId as string) : base.fontId,
    fontSize: Number.isFinite(size) && size >= 11 && size <= 24 ? Math.round(size) : base.fontSize,
    ligatures: typeof value.ligatures === 'boolean' ? value.ligatures : base.ligatures,
    autoSuggest: typeof value.autoSuggest === 'boolean' ? value.autoSuggest : base.autoSuggest,
    soundProfile: SOUND_PROFILES.some((p) => p.id === value.soundProfile)
      ? (value.soundProfile as string)
      : base.soundProfile,
    soundEnabled: typeof value.soundEnabled === 'boolean' ? value.soundEnabled : base.soundEnabled,
    soundVolume: Number.isFinite(volume) && volume >= 0 && volume <= 1 ? volume : base.soundVolume,
  };
}
