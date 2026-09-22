'use client';

import { useEffect, useRef, useState } from 'react';
import { SOUND_PROFILES, getSoundProfile } from '@/lib/keySounds';
import type { PlaygroundSettings } from '@/lib/settings';
import { CheckIcon, ChevronIcon, SoundOffIcon, SoundOnIcon } from './Icons';

interface SoundMenuProps {
  settings: PlaygroundSettings;
  onChange: (patch: Partial<PlaygroundSettings>) => void;
  /** Plays a short sample of a profile without changing the active one. */
  onPreview: (profileId: string) => void;
}

export default function SoundMenu({ settings, onChange, onPreview }: SoundMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  const active = getSoundProfile(settings.soundProfile);
  const on = settings.soundEnabled;

  const selectProfile = (profileId: string) => {
    // Picking a sound is a clear signal you want to hear it, so this also
    // unmutes rather than silently selecting something you cannot hear.
    onChange({ soundProfile: profileId, soundEnabled: true });
    onPreview(profileId);
  };

  return (
    <div className="sound-wrap" ref={wrapperRef}>
      <div className="sound-group">
        <button
          type="button"
          className={`sound-toggle${on ? ' is-on' : ''}`}
          onClick={() => onChange({ soundEnabled: !on })}
          aria-pressed={on}
          aria-label={on ? 'Mute typing sounds' : 'Unmute typing sounds'}
          title={on ? `Typing sound: ${active.label} — click to mute` : 'Typing sound: off — click to unmute'}
        >
          {on ? <SoundOnIcon /> : <SoundOffIcon />}
        </button>

        <button
          type="button"
          className={`sound-caret${open ? ' is-open' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Choose a typing sound"
          title="Choose a typing sound"
        >
          <ChevronIcon />
        </button>
      </div>

      {open ? (
        <div className="sound-panel" role="dialog" aria-label="Typing sound">
          <header className="settings-head">
            <h3>Typing sound</h3>
            <span>{on ? active.label : 'Muted'}</span>
          </header>

          <div className="sound-list">
            {SOUND_PROFILES.map((profile) => {
              const selected = profile.id === settings.soundProfile;
              return (
                <button
                  key={profile.id}
                  type="button"
                  className={`sound-option${selected ? ' is-selected' : ''}`}
                  onClick={() => selectProfile(profile.id)}
                  aria-pressed={selected}
                >
                  <span className="sound-option-text">
                    <span className="sound-option-name">{profile.label}</span>
                    <span className="sound-option-desc">{profile.description}</span>
                  </span>
                  {selected ? <CheckIcon size={13} className="sound-check" /> : null}
                </button>
              );
            })}
          </div>

          <div className="sound-volume">
            <label htmlFor="sound-volume">Volume</label>
            <input
              id="sound-volume"
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.soundVolume * 100)}
              onChange={(event) => onChange({ soundVolume: Number(event.target.value) / 100 })}
              aria-label="Typing sound volume"
            />
            <span className="sound-volume-value">{Math.round(settings.soundVolume * 100)}%</span>
          </div>

          <p className="settings-note">
            {on
              ? 'Plays while you type in the editor and the Input tab.'
              : 'Muted. Click the speaker, or pick a sound above.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
