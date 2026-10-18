import { DEFAULT_SAVE, SAVE_KEY, parseSave, serializeSave, type SaveData } from '../logic/save';

/**
 * Reads and writes the saved data in localStorage (ADR-C08). Storage can be missing or
 * blocked (private windows, browser settings), so every access is guarded and the game
 * carries on with defaults.
 */
export const SaveStore = {
  load(): SaveData {
    try {
      return parseSave(window.localStorage.getItem(SAVE_KEY));
    } catch {
      return DEFAULT_SAVE;
    }
  },

  save(data: SaveData): void {
    try {
      window.localStorage.setItem(SAVE_KEY, serializeSave(data));
    } catch {
      // Storage unavailable: the best score just isn't kept.
    }
  },
};
