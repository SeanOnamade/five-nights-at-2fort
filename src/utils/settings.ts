/**
 * Persistent user settings (localStorage-backed).
 *
 * Migrates the legacy standalone `audioLogsEnabled` key into the settings blob.
 * Volumes are 0..1 multipliers applied on top of each sound's authored level.
 */

const SETTINGS_KEY = 'fn2f_settings';
const LEGACY_AUDIO_LOGS_KEY = 'audioLogsEnabled';

export interface GameSettings {
  musicVolume: number;
  musicMuted: boolean;
  sfxVolume: number;
  audioLogs: boolean;
}

const DEFAULTS: GameSettings = {
  musicVolume: 1,
  musicMuted: false,
  sfxVolume: 1,
  audioLogs: true,
};

type SettingsListener = (settings: GameSettings) => void;

let cached: GameSettings | null = null;
const listeners = new Set<SettingsListener>();

function clamp01(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

export function getSettings(): GameSettings {
  if (cached) return cached;
  let loaded: Partial<GameSettings> = {};
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) loaded = JSON.parse(raw) as Partial<GameSettings>;
  } catch {
    // corrupt settings -> defaults
  }

  // Migrate legacy audio logs toggle if the new blob doesn't have it yet
  let audioLogs = typeof loaded.audioLogs === 'boolean' ? loaded.audioLogs : undefined;
  if (audioLogs === undefined) {
    const legacy = localStorage.getItem(LEGACY_AUDIO_LOGS_KEY);
    audioLogs = legacy === null || legacy === 'true';
  }

  cached = {
    musicVolume: clamp01(loaded.musicVolume, DEFAULTS.musicVolume),
    musicMuted: typeof loaded.musicMuted === 'boolean' ? loaded.musicMuted : DEFAULTS.musicMuted,
    sfxVolume: clamp01(loaded.sfxVolume, DEFAULTS.sfxVolume),
    audioLogs,
  };
  return cached;
}

export function updateSettings(patch: Partial<GameSettings>): GameSettings {
  const next = { ...getSettings(), ...patch };
  next.musicVolume = clamp01(next.musicVolume, DEFAULTS.musicVolume);
  next.sfxVolume = clamp01(next.sfxVolume, DEFAULTS.sfxVolume);
  cached = next;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    // Keep legacy key in sync — RecordingUI still reads it
    localStorage.setItem(LEGACY_AUDIO_LOGS_KEY, next.audioLogs ? 'true' : 'false');
  } catch {
    // storage full/blocked — settings still apply for this session
  }
  listeners.forEach((fn) => fn(next));
  return next;
}

/** Subscribe to settings changes. Returns an unsubscribe function. */
export function onSettingsChange(fn: SettingsListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Effective music volume — 0 while muted. All music playback reads this. */
export function getMusicVolume(): number {
  const s = getSettings();
  return s.musicMuted ? 0 : s.musicVolume;
}

export function getSfxVolume(): number {
  return getSettings().sfxVolume;
}
