import { describe, expect, it } from 'vitest';
import { ASSETS } from '../../src/assets/manifest';
import { BOSSES, BOSS_TYPES } from '../../src/data/bosses';
import { GAME_WIDTH, PLAYER_BODY, PLAYER_CROUCH_BODY } from '../../src/config/tuning';

describe('boss data', () => {
  it('has stats for every boss type', () => {
    expect(Object.keys(BOSSES).sort()).toEqual([...BOSS_TYPES].sort());
  });

  it.each(BOSS_TYPES)('%s: art exists and every number makes sense', (type) => {
    const b = BOSSES[type];
    const sheet = ASSETS.find((a) => a.key === b.sheet);
    expect(sheet?.kind).toBe('sheet');
    if (sheet?.kind === 'sheet') {
      expect({ width: sheet.frameWidth, height: sheet.frameHeight }).toEqual(b.frame);
    }
    expect(ASSETS.find((a) => a.key === b.explosions.effect)?.kind).toBe('sheet');
    expect(b.body.offsetX + b.body.width).toBeLessThanOrEqual(b.frame.width);
    expect(b.body.offsetY + b.body.height).toBeLessThanOrEqual(b.frame.height);
    for (const [x, y] of [b.muzzle, b.hatch]) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(b.frame.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(b.frame.height);
    }
    // It drives inside the arena (one screen wide) and leaves the marine room on the left.
    expect(b.drive.min - b.body.width / 2).toBeGreaterThanOrEqual(GAME_WIDTH / 3);
    expect(b.drive.max + b.body.width / 2).toBeLessThanOrEqual(GAME_WIDTH);
    expect(b.drive.min).toBeLessThan(b.drive.max);
    const t = b.tuning;
    expect(t.hp).toBeGreaterThan(0);
    expect(t.phases[0]?.fromHpShare).toBe(1);
    // Phases in order of falling health, each with at least one attack.
    t.phases.forEach((p, i) => {
      expect(p.attacks.length).toBeGreaterThan(0);
      if (i > 0) expect(p.fromHpShare).toBeLessThan(t.phases[i - 1]?.fromHpShare ?? 1);
      for (const a of p.attacks) expect(a.cooldownMs).toBeGreaterThan(0);
    });
  });

  it('the tank fires at head height: a crouch ducks under it, standing is hit', () => {
    const b = BOSSES.tank;
    // Feet on the floor at the bottom of the frame; the shot's core is 6 px tall.
    const shotTop = b.muzzle[1] - b.frame.height + 0.5 - 3; // relative to the floor (negative = up)
    const shotBottom = shotTop + 6;
    const standingTop = -PLAYER_BODY.height;
    const crouchingTop = -PLAYER_CROUCH_BODY.height;
    expect(shotBottom).toBeGreaterThan(standingTop);
    expect(shotBottom).toBeLessThan(crouchingTop);
  });
});
