/**
 * FlowOS mobile - src/lib/sound.ts
 * Zero-dependency "your turn" alert cue.
 *   - web:    a short two-tone beep synthesized with the Web Audio API (no asset,
 *             no library, completely free).
 *   - native: a vibration pattern via React Native's built-in Vibration API.
 * Best-effort: any failure (e.g. autoplay policy before a user gesture) is swallowed
 * so it never breaks the notification flow. A real native sound file can be dropped
 * in later behind this same `playTurnAlert()` call without touching callers.
 */
import { Platform, Vibration } from 'react-native';

// Minimal Web Audio shapes (the DOM lib isn't included in the RN tsconfig).
interface WebOscillator {
  type: string;
  frequency: { value: number };
  connect: (node: unknown) => unknown;
  start: (when: number) => void;
  stop: (when: number) => void;
}
interface WebGain {
  gain: {
    setValueAtTime: (value: number, when: number) => void;
    exponentialRampToValueAtTime: (value: number, when: number) => void;
  };
  connect: (node: unknown) => unknown;
}
interface WebAudioCtx {
  currentTime: number;
  destination: unknown;
  createOscillator: () => WebOscillator;
  createGain: () => WebGain;
  close?: () => void;
}
type WebAudioCtor = new () => WebAudioCtx;

function playWebBeep(): void {
  const g = globalThis as { AudioContext?: WebAudioCtor; webkitAudioContext?: WebAudioCtor };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) return;

  const ctx = new Ctor();
  const start = ctx.currentTime;
  // Two rising tones — a friendly "ding-dong".
  const tones: Array<[number, number]> = [
    [880, 0], // A5
    [1175, 0.18], // D6
  ];
  for (const [freq, offset] of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = start + offset;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }
  // Release the audio context shortly after the sound finishes.
  setTimeout(() => ctx.close?.(), 700);
}

/** Play the "it's your turn" alert cue (sound on web, vibration on native). */
export function playTurnAlert(): void {
  try {
    if (Platform.OS === 'web') {
      playWebBeep();
    } else {
      Vibration.vibrate([0, 400, 150, 400]);
    }
  } catch {
    // Best-effort only.
  }
}
