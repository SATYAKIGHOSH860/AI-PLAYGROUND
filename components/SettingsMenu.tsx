'use client';

import { useEffect, useRef, useState } from 'react';
import { FONTS, FONT_GROUPS, FONT_SIZES, getFont } from '@/lib/fonts';
import { THEMES, THEME_GROUPS, getTheme } from '@/lib/themes';
import type { PlaygroundSettings } from '@/lib/settings';
import { CheckIcon, SlidersIcon } from './Icons';

interface SettingsMenuProps {
  settings: PlaygroundSettings;
  onChange: (patch: Partial<PlaygroundSettings>) => void;
}

export default function SettingsMenu({ settings, onChange }: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const activeFont = getFont(settings.fontId);
  const activeTheme = getTheme(settings.themeId);

  return (
    <div className="settings-wrap" ref={wrapperRef}>
      <button
        type="button"
        className={`icon-btn${open ? ' is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Appearance and editor settings"
        aria-expanded={open}
        title="Theme, font and auto-suggest"
      >
        <SlidersIcon />
      </button>

      {open ? (
        <div className="settings-panel" ref={panelRef} role="dialog" aria-label="Editor settings">
          {/* ---------------------------------------------------- theme --- */}
          <section className="settings-section">
            <header className="settings-head">
              <h3>Theme</h3>
              <span>{activeTheme.label}</span>
            </header>

            {THEME_GROUPS.map((group) => (
              <div key={group} className="settings-group">
                <p className="settings-group-label">{group}</p>
                <div className="theme-grid">
                  {THEMES.filter((theme) => theme.group === group).map((theme) => {
                    const selected = theme.id === settings.themeId;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        className={`theme-card${selected ? ' is-selected' : ''}`}
                        onClick={() => onChange({ themeId: theme.id })}
                        aria-pressed={selected}
                        title={`${theme.label} (${theme.appearance})`}
                      >
                        <span
                          className="theme-swatch"
                          style={{
                            background: theme.palette.surface,
                            borderColor: theme.palette.border,
                          }}
                        >
                          <i style={{ background: theme.syntax.keyword }} />
                          <i style={{ background: theme.syntax.string }} />
                          <i style={{ background: theme.palette.accent }} />
                        </span>
                        <span className="theme-name">{theme.label}</span>
                        {selected ? <CheckIcon size={13} className="theme-check" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>

          {/* ----------------------------------------------------- font --- */}
          <section className="settings-section">
            <header className="settings-head">
              <h3>Code font</h3>
              <span>{activeFont.label}</span>
            </header>

            <select
              className="settings-select"
              value={settings.fontId}
              onChange={(event) => onChange({ fontId: event.target.value })}
              aria-label="Code font"
            >
              {FONT_GROUPS.map((group) => (
                <optgroup key={group} label={group}>
                  {FONTS.filter((font) => font.group === group).map((font) => (
                    <option key={font.id} value={font.id}>
                      {font.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <p className="settings-note">{activeFont.note}</p>

            <div
              className="font-preview"
              style={{
                fontFamily: activeFont.stack,
                fontSize: `${settings.fontSize}px`,
                // Mirror the editor exactly, so the preview never promises
                // ligatures the editor will not draw.
                fontVariantLigatures: settings.ligatures && activeFont.ligatures ? 'normal' : 'none',
              }}
            >
              <span className="fp-kw">for</span> i <span className="fp-op">in</span>{' '}
              <span className="fp-fn">range</span>(<span className="fp-num">10</span>):
              <br />
              &nbsp;&nbsp;<span className="fp-fn">print</span>(<span className="fp-str">&quot;i != 0 -&gt; ok&quot;</span>)
            </div>

            <div className="settings-row">
              <label htmlFor="font-size">Size</label>
              <select
                id="font-size"
                className="settings-select is-compact"
                value={settings.fontSize}
                onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} px
                  </option>
                ))}
              </select>
            </div>

            <Toggle
              id="ligatures"
              label="Ligatures"
              hint={
                activeFont.ligatures
                  ? 'Draw -> and != as single glyphs.'
                  : `${activeFont.label} has no ligatures.`
              }
              checked={settings.ligatures && activeFont.ligatures}
              disabled={!activeFont.ligatures}
              onChange={(checked) => onChange({ ligatures: checked })}
            />
          </section>

          {/* ------------------------------------------------- editing --- */}
          <section className="settings-section">
            <header className="settings-head">
              <h3>Editing</h3>
            </header>

            <Toggle
              id="auto-suggest"
              label="Auto-suggest while typing"
              hint="Keywords, standard library and snippets. Ctrl+Space works either way."
              checked={settings.autoSuggest}
              onChange={(checked) => onChange({ autoSuggest: checked })}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}

interface ToggleProps {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ id, label, hint, checked, disabled = false, onChange }: ToggleProps) {
  return (
    <div className={`toggle-row${disabled ? ' is-disabled' : ''}`}>
      <label className="toggle-text" htmlFor={id}>
        <span className="toggle-label">{label}</span>
        <span className="toggle-hint">{hint}</span>
      </label>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`switch${checked ? ' is-on' : ''}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-knob" />
      </button>
    </div>
  );
}
