import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOUNDS, SOUND_KEYS } from '../../src/assets/manifest';
import { STORY_LEVELS } from '../../src/data/campaign';

const PUBLIC_DIR = `${process.cwd()}/public`;
/** ADR-C06: every file under the repo's 5 MB limit; music loops kept small. */
const MAX_SFX_BYTES = 300_000;
const MAX_MUSIC_BYTES = 2_500_000;

describe('sound assets (M3.6)', () => {
  it.each(SOUNDS)('$key has its OGG and M4A files, within size', (sound) => {
    expect(sound.paths[0]).toMatch(/\.ogg$/);
    for (const path of sound.paths) {
      const bytes = readFileSync(`${PUBLIC_DIR}/${path}`).length; // throws if the file is missing
      expect(bytes, path).toBeGreaterThan(0);
      expect(bytes, path).toBeLessThanOrEqual(sound.music ? MAX_MUSIC_BYTES : MAX_SFX_BYTES);
    }
  });

  it('every level that names music names a known music loop', () => {
    for (const level of STORY_LEVELS) {
      if (level.music === undefined) continue;
      expect(SOUND_KEYS).toContain(level.music);
      expect(level.music.startsWith('music-')).toBe(true);
    }
  });
});
