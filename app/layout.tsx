import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Playground - Online Compiler for Python, C and C++',
  description:
    'Write, run and debug Python, C and C++ in the browser with live output, inline compiler errors and shareable links.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0b0d12' },
    { media: '(prefers-color-scheme: light)', color: '#e9edf3' },
  ],
  width: 'device-width',
  initialScale: 1,
};

/**
 * Applies the stored theme before first paint. Without this the page renders
 * dark for a frame and then snaps to light, which looks broken.
 */
const THEME_BOOTSTRAP = `
(function () {
  var root = document.documentElement;
  try {
    var raw = localStorage.getItem('playground:bootstrap');
    var saved = raw ? JSON.parse(raw) : null;
    var appearance = saved && (saved.appearance === 'light' || saved.appearance === 'dark')
      ? saved.appearance
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

    root.setAttribute('data-theme', appearance);
    root.style.colorScheme = appearance;

    // The exact palette is applied on hydration; painting the three dominant
    // colours now is what stops a themed reload flashing the default scheme.
    if (saved) {
      if (saved.bg) root.style.setProperty('--bg', saved.bg);
      if (saved.surface) root.style.setProperty('--surface', saved.surface);
      if (saved.text) root.style.setProperty('--text', saved.text);
    }
  } catch (e) {
    root.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
