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
    // Everything moves except the snake, which sits on its ledge like a turret (M5.1).
    if (e.movement === 'snake') expect(e.speed).toBe(0);
    else expect(e.speed).toBeGreaterThan(0);
  });

  it('the snake: its strike and spit sheets exist, and its mouth is inside the frame', () => {
    const e = ENEMIES['spitting-snake'];
    expect(e.movement).toBe('snake');
    const snake = e.snake;
    expect(snake).toBeDefined();
    if (!snake) return;
    const strike = ASSETS.find((a) => a.key === snake.strikeSheet);
    expect(strike?.kind).toBe('sheet');
    if (strike?.kind === 'sheet') {
      // Same frame as the idle sheet, so the body box fits both.
      expect({ width: strike.frameWidth, height: strike.frameHeight }).toEqual(e.frame);
      // The strike lands as it spits: the sheet runs for exactly the windup.
      expect((strike.frames / strike.frameRate) * 1000).toBe(snake.windupMs);
    }
    expect(ASSETS.find((a) => a.key === snake.spitSheet)?.kind).toBe('sheet');
    const [mx, my] = snake.mouth;
    expect(mx).toBeLessThan(e.frame.width);
    expect(my).toBeLessThan(e.frame.height);
    // The coil is centred, so it stays put when the snake turns.
    expect(e.body.offsetX * 2 + e.body.width).toBe(e.frame.width);
  });
});
