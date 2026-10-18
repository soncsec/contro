/**
 * Saved data (ARCHITECTURE.md ADR-C08): one versioned localStorage key. Reading is defensive:
 * anything missing, corrupt or from another version falls back to the defaults.
 */
export const SAVE_KEY = 'contro.save.v1';

export interface SaveData {
  version: 1;
  bestScore: number;
}

export const DEFAULT_SAVE: SaveData = { version: 1, bestScore: 0 };

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
  const best = d['bestScore'];
  const bestScore =
    typeof best === 'number' && Number.isFinite(best) && best >= 0 ? Math.floor(best) : 0;
  return { version: 1, bestScore };
}

export function serializeSave(data: SaveData): string {
  return JSON.stringify(data);
}
