/**
 * Typing sounds, synthesised with the Web Audio API.
 *
 * Nothing is downloaded: a keystroke is a short filtered noise burst plus a
 * decaying tone, which is exactly what a key press is acoustically. That keeps
 * the first keypress instant (no sample fetch, no decode) and costs no assets.
 *
 * Every voice is pitch- and gain-jittered, and space/enter/backspace get their
 * own character, because a fixed sample retriggered 400 times a minute is the
 * thing that makes fake keyboard audio unbearable.
 */

export type KeyVariant = 'normal' | 'space' | 'enter' | 'backspace';

export interface SoundProfile {
  id: string;
  label: string;
  description: string;
  render: (voice: Voice) => void;
}

interface Voice {
  ctx: AudioContext;
  dest: AudioNode;
  noise: AudioBuffer;
  /** Pitch multiplier for this key, already jittered. */
  pitch: number;
  /** Gain multiplier for this key. */
  gain: number;
  variant: KeyVariant;
}

const VARIANTS: Record<KeyVariant, { pitch: number; gain: number }> = {
  normal: { pitch: 1, gain: 1 },
  // Bigger keys sit lower and hit harder.
  space: { pitch: 0.82, gain: 1.15 },
  enter: { pitch: 0.74, gain: 1.2 },
  backspace: { pitch: 1.12, gain: 0.9 },
};

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 0.4);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

interface BurstOptions {
  filter: BiquadFilterType;
  frequency: number;
  q?: number;
  duration: number;
  gain: number;
  delay?: number;
}

/** A filtered slice of white noise - the "click" part of a key press. */
function burst(voice: Voice, options: BurstOptions): void {
  const { ctx, dest, noise } = voice;
  const start = ctx.currentTime + (options.delay ?? 0);
  const peak = Math.max(options.gain, 0.0005);

  const source = ctx.createBufferSource();
  source.buffer = noise;

  const filter = ctx.createBiquadFilter();
  filter.type = options.filter;
  filter.frequency.value = Math.min(Math.max(options.frequency, 20), 18_000);
  if (options.q !== undefined) filter.Q.value = options.q;

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(peak, start + 0.0015);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);

  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(dest);

  // A random window into the buffer stops consecutive keys sounding identical.
  const offset = Math.random() * Math.max(noise.duration - options.duration - 0.02, 0);
  source.start(start, offset, options.duration + 0.02);
  source.stop(start + options.duration + 0.02);
}

interface ToneOptions {
  type: OscillatorType;
  frequency: number;
  endFrequency?: number;
  duration: number;
  gain: number;
  delay?: number;
}

/** A decaying oscillator - the "body" or "thock" under the click. */
function tone(voice: Voice, options: ToneOptions): void {
  const { ctx, dest } = voice;
  const start = ctx.currentTime + (options.delay ?? 0);
  const peak = Math.max(options.gain, 0.0005);

  const osc = ctx.createOscillator();
  osc.type = options.type;
  osc.frequency.setValueAtTime(Math.max(options.frequency, 20), start);
  if (options.endFrequency) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(options.endFrequency, 20),
      start + options.duration,
    );
  }

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(peak, start + 0.003);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);

  osc.connect(envelope);
  envelope.connect(dest);
  osc.start(start);
  osc.stop(start + options.duration + 0.02);
}

export const SOUND_PROFILES: SoundProfile[] = [
  {
    id: 'clicky',
    label: 'Clicky',
    description: 'Modern mechanical board. Crisp and bright.',
    render: (v) => {
      burst(v, { filter: 'bandpass', frequency: 2600 * v.pitch, q: 1.1, duration: 0.028, gain: 0.5 * v.gain });
      burst(v, { filter: 'highpass', frequency: 5200 * v.pitch, duration: 0.012, gain: 0.2 * v.gain });
      tone(v, {
        type: 'triangle',
        frequency: 190 * v.pitch,
        endFrequency: 120 * v.pitch,
        duration: 0.05,
        gain: 0.16 * v.gain,
      });
    },
  },
  {
    id: 'typewriter',
    label: 'Typewriter',
    description: 'Old mechanical. Metallic strike, bell on Enter.',
    render: (v) => {
      burst(v, { filter: 'bandpass', frequency: 3200 * v.pitch, q: 0.8, duration: 0.034, gain: 0.52 * v.gain });
      tone(v, {
        type: 'square',
        frequency: 1500 * v.pitch,
        endFrequency: 900 * v.pitch,
        duration: 0.012,
        gain: 0.1 * v.gain,
      });
      tone(v, {
        type: 'sine',
        frequency: 132 * v.pitch,
        endFrequency: 80 * v.pitch,
        duration: 0.09,
        gain: 0.26 * v.gain,
      });
      // Carriage-return bell.
      if (v.variant === 'enter') {
        tone(v, { type: 'sine', frequency: 1760, duration: 0.38, gain: 0.1, delay: 0.02 });
        tone(v, { type: 'sine', frequency: 2640, duration: 0.26, gain: 0.04, delay: 0.02 });
      }
    },
  },
  {
    id: 'soft',
    label: 'Soft',
    description: 'Laptop membrane. Quiet and muted.',
    render: (v) => {
      burst(v, { filter: 'lowpass', frequency: 1100 * v.pitch, duration: 0.03, gain: 0.3 * v.gain });
      tone(v, {
        type: 'sine',
        frequency: 96 * v.pitch,
        endFrequency: 62 * v.pitch,
        duration: 0.05,
        gain: 0.2 * v.gain,
      });
    },
  },
  {
    id: 'thock',
    label: 'Thock',
    description: 'Deep and creamy. Easy on long sessions.',
    render: (v) => {
      burst(v, { filter: 'lowpass', frequency: 520 * v.pitch, q: 0.7, duration: 0.058, gain: 0.34 * v.gain });
      tone(v, {
        type: 'sine',
        frequency: 78 * v.pitch,
        endFrequency: 52 * v.pitch,
        duration: 0.11,
        gain: 0.38 * v.gain,
      });
      tone(v, { type: 'triangle', frequency: 160 * v.pitch, duration: 0.04, gain: 0.07 * v.gain });
    },
  },
  {
    id: 'retro',
    label: 'Retro',
    description: 'Old PC beep. Square wave, 8-bit energy.',
    render: (v) => {
      tone(v, {
        type: 'square',
        frequency: 880 * v.pitch,
        endFrequency: 760 * v.pitch,
        duration: 0.035,
        gain: 0.13 * v.gain,
      });
      burst(v, { filter: 'highpass', frequency: 4000, duration: 0.008, gain: 0.07 * v.gain });
      if (v.variant === 'enter') {
        tone(v, { type: 'square', frequency: 1320, duration: 0.06, gain: 0.1, delay: 0.045 });
      }
    },
  },
];

export const DEFAULT_SOUND_PROFILE = 'clicky';

export function getSoundProfile(id: string): SoundProfile {
  return SOUND_PROFILES.find((p) => p.id === id) ?? SOUND_PROFILES[0];
}

function variantOf(key: string): KeyVariant {
  if (key === ' ' || key === 'Spacebar') return 'space';
  if (key === 'Enter') return 'enter';
  if (key === 'Backspace' || key === 'Delete') return 'backspace';
  return 'normal';
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Dead']);

/**
 * Owns the AudioContext. Framework-free on purpose so a React re-render can
 * never tear down the audio graph mid-keystroke.
 */
export class KeySoundPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastPlayedAt = 0;

  profileId = DEFAULT_SOUND_PROFILE;
  volume = 0.6;
  enabled = false;

  private ensureContext(): boolean {
    if (typeof window === 'undefined') return false;

    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      try {
        this.ctx = new Ctor();
      } catch {
        return false;
      }
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.noise = createNoiseBuffer(this.ctx);
    }

    // Browsers start the context suspended until a gesture; a keystroke is one.
    if (this.ctx.state === 'suspended') void this.ctx.resume();

    // Headroom, so several overlapping keys cannot clip.
    if (this.master) this.master.gain.value = this.volume * 0.5;
    return true;
  }

  /** Plays one keystroke. Silently does nothing when disabled or unavailable. */
  play(key: string, options: { force?: boolean; profileId?: string } = {}): void {
    if (!this.enabled && !options.force) return;
    if (MODIFIER_KEYS.has(key)) return;

    // Holding a key or pasting must not spawn a swarm of voices.
    const now = performance.now();
    if (now - this.lastPlayedAt < 16) return;
    this.lastPlayedAt = now;

    if (!this.ensureContext() || !this.ctx || !this.master || !this.noise) return;

    const variant = variantOf(key);
    const shape = VARIANTS[variant];
    const jitter = 0.95 + Math.random() * 0.1;

    try {
      getSoundProfile(options.profileId ?? this.profileId).render({
        ctx: this.ctx,
        dest: this.master,
        noise: this.noise,
        pitch: shape.pitch * jitter,
        gain: shape.gain,
        variant,
      });
    } catch {
      /* A dead audio graph must never break typing. */
    }
  }

  /**
   * Plays a few keystrokes of a profile when it is picked from the menu.
   * Uses an explicit override so it never disturbs the active selection.
   */
  preview(profileId: string): void {
    ['a', 'e', ' ', 'k'].forEach((key, index) => {
      window.setTimeout(() => {
        this.lastPlayedAt = 0;
        this.play(key, { force: true, profileId });
      }, index * 95);
    });
  }

  dispose(): void {
    try {
      void this.ctx?.close();
    } catch {
      /* already closed */
    }
    this.ctx = null;
    this.master = null;
    this.noise = null;
  }
}
