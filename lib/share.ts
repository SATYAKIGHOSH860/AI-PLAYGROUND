import { isLanguageId } from './languages';
import type { LanguageId } from './types';

export interface SharedState {
  language: LanguageId;
  code: string;
  stdin: string;
}

/** Base64url so the payload survives a URL fragment without percent-encoding. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeShare(state: SharedState): string {
  const json = JSON.stringify({ l: state.language, c: state.code, i: state.stdin });
  return toBase64Url(new TextEncoder().encode(json));
}

export function decodeShare(fragment: string): SharedState | null {
  try {
    const json = new TextDecoder().decode(fromBase64Url(fragment));
    const raw = JSON.parse(json) as { l?: unknown; c?: unknown; i?: unknown };
    if (!isLanguageId(raw.l) || typeof raw.c !== 'string') return null;
    return {
      language: raw.l,
      code: raw.c,
      stdin: typeof raw.i === 'string' ? raw.i : '',
    };
  } catch {
    return null;
  }
}
