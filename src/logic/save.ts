/**
 * Saved data (ARCHITECTURE.md ADR-C08): one versioned localStorage key. Reading is defensive:
 * anything missing, corrupt or from another version falls back to the defaults.
 */
import { MAX_VOLUME } from './volume';

export const SAVE_KEY = 'contro.save.v1';

export interface SaveData {
  version: 1;
  bestScore: number;
  /**
   * The furthest level number reached (M3.5), from 1. Saves made before it existed have no
   * such field and read as 1, so they keep their best score.
   */
  furthestLevel: number;
  /**
   * Music and effects volume, 0 (OFF) to 3 (HIGH) (M6.2). Saves from before (M3.6's sound on
   * or off) read as HIGH, or OFF if the sound was off.
   */
  musicLevel: number;
  sfxLevel: number;
}

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  bestScore: 0,
  furthestLevel: 1,
  musicLevel: MAX_VOLUME,
  sfxLevel: MAX_VOLUME,
};

/** A volume level 0–MAX_VOLUME, or `fallback` for anything else. */
function volumeLevel(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_VOLUME
    ? value
    : fallback;
}

/** A whole number at least `min`, or `fallback` for anything else. */
function wholeAtLeast(value: unknown, min: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min
    ? Math.floor(value)
    : fallback;
}

export function parseSave(raw: string | null): SaveData {
  if (raw === null) return DEFAULT_SAVE;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_SAVE;
  }
  if (typeof data !== 'object' || data === null) return DEFAULT_SAVE;
  const d = data as Record<string, unknown>;
  if (d['version'] !== 1) return DEFAULT_SAVE;
  // An older save's sound switch: off means both volumes off.
  const legacy = d['soundOn'] === false ? 0 : MAX_VOLUME;
  return {
    version: 1,
    bestScore: wholeAtLeast(d['bestScore'], 0, 0),
    furthestLevel: wholeAtLeast(d['furthestLevel'], 1, 1),
    musicLevel: volumeLevel(d['musicLevel'], legacy),
    sfxLevel: volumeLevel(d['sfxLevel'], legacy),
  };
}

export function serializeSave(data: SaveData): string {
  return JSON.stringify(data);
}

/** The save after reaching level `stage`: the furthest level never goes down. */
export function reachLevel(data: SaveData, stage: number): SaveData {
  return stage > data.furthestLevel ? { ...data, furthestLevel: Math.floor(stage) } : data;
}

/**
 * The level the title's LEVEL row shows after pressing left (-1) or right (+1), wrapping
 * between 1 and the furthest level reached (M3.5).
 */
export function pickLevel(current: number, furthest: number, step: -1 | 1): number {
  const count = Math.max(1, Math.floor(furthest));
  return ((((current - 1 + step) % count) + count) % count) + 1;
}
