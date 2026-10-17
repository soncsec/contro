import { describe, expect, it } from 'vitest';
import { ASSETS } from '../../src/assets/manifest';
import { ENEMIES, ENEMY_TYPES } from '../../src/data/enemies';

describe('enemy data', () => {
  it('has stats for every enemy type', () => {
    expect(Object.keys(ENEMIES).sort()).toEqual([...ENEMY_TYPES].sort());
  });

  it.each(ENEMY_TYPES)('%s: sheet and effect exist, frame matches, body fits', (type) => {
    const e = ENEMIES[type];
    const sheet = ASSETS.find((a) => a.key === e.walkSheet);
    expect(sheet?.kind).toBe('sheet');
    if (sheet?.kind === 'sheet') {
      expect({ width: sheet.frameWidth, height: sheet.frameHeight }).toEqual(e.frame);
    }
    expect(ASSETS.find((a) => a.key === e.deathEffect)?.kind).toBe('sheet');
    expect(e.body.offsetX + e.body.width).toBeLessThanOrEqual(e.frame.width);
    expect(e.body.offsetY + e.body.height).toBeLessThanOrEqual(e.frame.height);
    expect(e.hp).toBeGreaterThan(0);
    expect(e.speed).toBeGreaterThan(0);
  });
});
