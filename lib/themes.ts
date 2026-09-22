/**
 * Theme registry.
 *
 * One definition drives both the app chrome (CSS custom properties) and the
 * Monaco editor theme, so the editor can never drift out of step with the
 * surrounding UI the way two separate palettes would.
 */

export type ThemeGroup = 'Professional' | 'Smooth' | 'Funky';
export type Appearance = 'dark' | 'light';

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  borderStrong: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  accentHover: string;
  accentInk: string;
  info: string;
  warn: string;
  danger: string;
}

export interface Syntax {
  comment: string;
  keyword: string;
  string: string;
  number: string;
  type: string;
  func: string;
  operator: string;
  variable: string;
}

export interface ThemeDefinition {
  id: string;
  label: string;
  group: ThemeGroup;
  appearance: Appearance;
  palette: Palette;
  syntax: Syntax;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'midnight',
    label: 'Midnight',
    group: 'Professional',
    appearance: 'dark',
    palette: {
      bg: '#0b0d12',
      surface: '#12151d',
      surface2: '#171b25',
      surface3: '#1d222e',
      border: '#262c3a',
      borderStrong: '#353d50',
      text: '#e6eaf2',
      textDim: '#99a3b7',
      textFaint: '#6b7688',
      accent: '#3fd68b',
      accentHover: '#4ee59a',
      accentInk: '#052012',
      info: '#62a8ff',
      warn: '#ffb454',
      danger: '#ff7070',
    },
    syntax: {
      comment: '#6b7688',
      keyword: '#c678dd',
      string: '#98c379',
      number: '#d19a66',
      type: '#e5c07b',
      func: '#61afef',
      operator: '#56b6c2',
      variable: '#e6eaf2',
    },
  },
  {
    id: 'daylight',
    label: 'Daylight',
    group: 'Professional',
    appearance: 'light',
    palette: {
      bg: '#e9edf3',
      surface: '#ffffff',
      surface2: '#f5f7fa',
      surface3: '#e9edf3',
      border: '#d8dee8',
      borderStrong: '#bcc5d3',
      text: '#181e2a',
      textDim: '#566072',
      textFaint: '#8a94a4',
      accent: '#0f9d58',
      accentHover: '#0c8a4c',
      accentInk: '#ffffff',
      info: '#1f6feb',
      warn: '#9a6400',
      danger: '#d1242f',
    },
    syntax: {
      comment: '#8a94a4',
      keyword: '#a626a4',
      string: '#3f8f3f',
      number: '#b25000',
      type: '#9a6400',
      func: '#1f6feb',
      operator: '#0184bc',
      variable: '#181e2a',
    },
  },
  {
    id: 'github-dark',
    label: 'GitHub Dark',
    group: 'Professional',
    appearance: 'dark',
    palette: {
      bg: '#010409',
      surface: '#0d1117',
      surface2: '#161b22',
      surface3: '#21262d',
      border: '#30363d',
      borderStrong: '#484f58',
      text: '#e6edf3',
      textDim: '#8d96a0',
      textFaint: '#6e7681',
      accent: '#2ea043',
      accentHover: '#3fb950',
      accentInk: '#ffffff',
      info: '#58a6ff',
      warn: '#d29922',
      danger: '#f85149',
    },
    syntax: {
      comment: '#8b949e',
      keyword: '#ff7b72',
      string: '#a5d6ff',
      number: '#79c0ff',
      type: '#ffa657',
      func: '#d2a8ff',
      operator: '#ff7b72',
      variable: '#e6edf3',
    },
  },
  {
    id: 'solarized-light',
    label: 'Solarized Light',
    group: 'Professional',
    appearance: 'light',
    palette: {
      bg: '#eee8d5',
      surface: '#fdf6e3',
      surface2: '#f5efdc',
      surface3: '#eee8d5',
      border: '#ded8c5',
      borderStrong: '#c3bda9',
      text: '#586e75',
      textDim: '#657b83',
      textFaint: '#93a1a1',
      accent: '#859900',
      accentHover: '#6f8000',
      accentInk: '#fdf6e3',
      info: '#268bd2',
      warn: '#b58900',
      danger: '#dc322f',
    },
    syntax: {
      comment: '#93a1a1',
      keyword: '#859900',
      string: '#2aa198',
      number: '#d33682',
      type: '#b58900',
      func: '#268bd2',
      operator: '#6c71c4',
      variable: '#586e75',
    },
  },
  {
    id: 'nord',
    label: 'Nord',
    group: 'Smooth',
    appearance: 'dark',
    palette: {
      bg: '#242933',
      surface: '#2e3440',
      surface2: '#3b4252',
      surface3: '#434c5e',
      border: '#3f4859',
      borderStrong: '#4c566a',
      text: '#eceff4',
      textDim: '#d8dee9',
      textFaint: '#7b88a1',
      accent: '#a3be8c',
      accentHover: '#b5cd9f',
      accentInk: '#2e3440',
      info: '#88c0d0',
      warn: '#ebcb8b',
      danger: '#bf616a',
    },
    syntax: {
      comment: '#616e88',
      keyword: '#81a1c1',
      string: '#a3be8c',
      number: '#b48ead',
      type: '#8fbcbb',
      func: '#88c0d0',
      operator: '#81a1c1',
      variable: '#d8dee9',
    },
  },
  {
    id: 'gruvbox',
    label: 'Gruvbox',
    group: 'Smooth',
    appearance: 'dark',
    palette: {
      bg: '#1d2021',
      surface: '#282828',
      surface2: '#32302f',
      surface3: '#3c3836',
      border: '#3c3836',
      borderStrong: '#504945',
      text: '#ebdbb2',
      textDim: '#bdae93',
      textFaint: '#928374',
      accent: '#b8bb26',
      accentHover: '#c9cc38',
      accentInk: '#1d2021',
      info: '#83a598',
      warn: '#fabd2f',
      danger: '#fb4934',
    },
    syntax: {
      comment: '#928374',
      keyword: '#fb4934',
      string: '#b8bb26',
      number: '#d3869b',
      type: '#fabd2f',
      func: '#8ec07c',
      operator: '#fe8019',
      variable: '#ebdbb2',
    },
  },
  {
    id: 'rose-pine-dawn',
    label: 'Rosé Pine Dawn',
    group: 'Smooth',
    appearance: 'light',
    palette: {
      bg: '#f2e9e1',
      surface: '#fffaf3',
      surface2: '#faf4ed',
      surface3: '#f2e9e1',
      border: '#e5ded6',
      borderStrong: '#cecacd',
      text: '#575279',
      textDim: '#797593',
      textFaint: '#9893a5',
      accent: '#286983',
      accentHover: '#1f5268',
      accentInk: '#fffaf3',
      info: '#56949f',
      warn: '#ea9d34',
      danger: '#b4637a',
    },
    syntax: {
      comment: '#9893a5',
      keyword: '#286983',
      string: '#ea9d34',
      number: '#d7827e',
      type: '#56949f',
      func: '#907aa9',
      operator: '#b4637a',
      variable: '#575279',
    },
  },
  {
    id: 'dracula',
    label: 'Dracula',
    group: 'Funky',
    appearance: 'dark',
    palette: {
      bg: '#21222c',
      surface: '#282a36',
      surface2: '#343746',
      surface3: '#44475a',
      border: '#44475a',
      borderStrong: '#6272a4',
      text: '#f8f8f2',
      textDim: '#bcc2cd',
      textFaint: '#6272a4',
      accent: '#50fa7b',
      accentHover: '#69ffa0',
      accentInk: '#21222c',
      info: '#8be9fd',
      warn: '#ffb86c',
      danger: '#ff5555',
    },
    syntax: {
      comment: '#6272a4',
      keyword: '#ff79c6',
      string: '#f1fa8c',
      number: '#bd93f9',
      type: '#8be9fd',
      func: '#50fa7b',
      operator: '#ff79c6',
      variable: '#f8f8f2',
    },
  },
  {
    id: 'synthwave',
    label: 'Synthwave',
    group: 'Funky',
    appearance: 'dark',
    palette: {
      bg: '#1f1b2e',
      surface: '#262335',
      surface2: '#2f2a45',
      surface3: '#3b3356',
      border: '#423a63',
      borderStrong: '#574c80',
      text: '#f7f2ff',
      textDim: '#b9a7d8',
      textFaint: '#7d6a9e',
      accent: '#36f9f6',
      accentHover: '#6dfbf9',
      accentInk: '#17142a',
      info: '#ff7edb',
      warn: '#fede5d',
      danger: '#fe4450',
    },
    syntax: {
      comment: '#7d6a9e',
      keyword: '#fe4450',
      string: '#fede5d',
      number: '#f97e72',
      type: '#ff8b39',
      func: '#36f9f6',
      operator: '#ff7edb',
      variable: '#f7f2ff',
    },
  },
  {
    id: 'monokai',
    label: 'Monokai',
    group: 'Funky',
    appearance: 'dark',
    palette: {
      bg: '#1e1f1c',
      surface: '#272822',
      surface2: '#2f302a',
      surface3: '#3e3d32',
      border: '#3e3d32',
      borderStrong: '#75715e',
      text: '#f8f8f2',
      textDim: '#cfd0c2',
      textFaint: '#75715e',
      accent: '#a6e22e',
      accentHover: '#b8ed4a',
      accentInk: '#1e1f1c',
      info: '#66d9ef',
      warn: '#e6db74',
      danger: '#f92672',
    },
    syntax: {
      comment: '#75715e',
      keyword: '#f92672',
      string: '#e6db74',
      number: '#ae81ff',
      type: '#66d9ef',
      func: '#a6e22e',
      operator: '#f92672',
      variable: '#f8f8f2',
    },
  },
];

export const THEME_GROUPS: ThemeGroup[] = ['Professional', 'Smooth', 'Funky'];

export const DEFAULT_DARK_THEME = 'midnight';
export const DEFAULT_LIGHT_THEME = 'daylight';

export function getTheme(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Monaco theme id derived from the registry id. */
export function monacoThemeId(id: string): string {
  return `pg-${id}`;
}

const strip = (hex: string) => hex.replace('#', '');

/** CSS custom properties for the app chrome. */
export function themeCssVariables(theme: ThemeDefinition): Record<string, string> {
  const p = theme.palette;
  return {
    '--bg': p.bg,
    '--surface': p.surface,
    '--surface-2': p.surface2,
    '--surface-3': p.surface3,
    '--border': p.border,
    '--border-strong': p.borderStrong,
    '--text': p.text,
    '--text-dim': p.textDim,
    '--text-faint': p.textFaint,
    '--accent': p.accent,
    '--accent-hover': p.accentHover,
    '--accent-ink': p.accentInk,
    '--info': p.info,
    '--warn': p.warn,
    '--danger': p.danger,
    '--syntax-keyword': theme.syntax.keyword,
    '--syntax-string': theme.syntax.string,
    '--shadow':
      theme.appearance === 'dark'
        ? '0 10px 30px rgba(0, 0, 0, 0.5)'
        : '0 10px 26px rgba(20, 30, 50, 0.14)',
  };
}

/**
 * Monaco theme data. Widget colours are included so the autocomplete popup
 * and hover cards match the chosen theme instead of falling back to the
 * stock VS Code greys.
 */
export function monacoThemeData(theme: ThemeDefinition) {
  const p = theme.palette;
  const s = theme.syntax;

  return {
    base: (theme.appearance === 'light' ? 'vs' : 'vs-dark') as 'vs' | 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: strip(s.variable) },
      { token: 'comment', foreground: strip(s.comment), fontStyle: 'italic' },
      { token: 'keyword', foreground: strip(s.keyword) },
      { token: 'keyword.flow', foreground: strip(s.keyword) },
      { token: 'keyword.directive', foreground: strip(s.operator) },
      { token: 'string', foreground: strip(s.string) },
      { token: 'string.escape', foreground: strip(s.operator) },
      { token: 'number', foreground: strip(s.number) },
      { token: 'number.hex', foreground: strip(s.number) },
      { token: 'type', foreground: strip(s.type) },
      { token: 'type.identifier', foreground: strip(s.type) },
      { token: 'identifier', foreground: strip(s.variable) },
      { token: 'predefined', foreground: strip(s.func) },
      { token: 'function', foreground: strip(s.func) },
      { token: 'delimiter', foreground: strip(p.textDim) },
      { token: 'operator', foreground: strip(s.operator) },
      { token: 'tag', foreground: strip(s.keyword) },
      { token: 'attribute.name', foreground: strip(s.type) },
      { token: 'variable', foreground: strip(s.variable) },
    ],
    colors: {
      'editor.background': p.surface,
      'editor.foreground': p.text,
      'editorGutter.background': p.surface,
      'editorLineNumber.foreground': p.textFaint,
      'editorLineNumber.activeForeground': p.textDim,
      'editor.lineHighlightBackground': p.surface2,
      'editor.lineHighlightBorder': '#00000000',
      'editor.selectionBackground': `${p.info}38`,
      'editor.inactiveSelectionBackground': `${p.info}22`,
      'editor.selectionHighlightBackground': `${p.info}22`,
      'editor.wordHighlightBackground': `${p.info}1f`,
      'editorCursor.foreground': p.accent,
      'editorIndentGuide.background1': p.border,
      'editorIndentGuide.activeBackground1': p.borderStrong,
      'editorBracketMatch.background': '#00000000',
      'editorBracketMatch.border': p.textFaint,
      'editorWidget.background': p.surface2,
      'editorWidget.border': p.border,
      'editorWidget.foreground': p.text,
      'editorSuggestWidget.background': p.surface2,
      'editorSuggestWidget.border': p.border,
      'editorSuggestWidget.foreground': p.text,
      'editorSuggestWidget.selectedBackground': p.surface3,
      'editorSuggestWidget.selectedForeground': p.text,
      'editorSuggestWidget.highlightForeground': p.accent,
      'editorSuggestWidget.focusHighlightForeground': p.accent,
      'editorHoverWidget.background': p.surface2,
      'editorHoverWidget.border': p.border,
      'editorError.foreground': p.danger,
      'editorWarning.foreground': p.warn,
      'editorInfo.foreground': p.info,
      'editorOverviewRuler.border': '#00000000',
      'editorOverviewRuler.errorForeground': p.danger,
      'editorOverviewRuler.warningForeground': p.warn,
      'input.background': p.surface3,
      'input.foreground': p.text,
      'input.border': p.border,
      'list.hoverBackground': p.surface3,
      'list.focusBackground': p.surface3,
      'scrollbarSlider.background': `${p.borderStrong}80`,
      'scrollbarSlider.hoverBackground': `${p.borderStrong}bb`,
      'scrollbarSlider.activeBackground': p.borderStrong,
      'minimap.background': p.surface,
    },
  };
}
