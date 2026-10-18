import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/assets/manifest';
import { GRAVITY_Y, MOVEMENT } from '../../src/config/tuning';
import { BOSS_TYPES } from '../../src/data/bosses';
import { ENEMY_TYPES } from '../../src/data/enemies';
import { readLevelLayout } from '../../src/logic/levelMap';
import { jumpReach, routeProblems, SAFETY } from '../../src/logic/route';

const reach = jumpReach({ ...MOVEMENT, gravity: GRAVITY_Y });
const solid = (x: number, y: number, width: number) => ({ type: 'solid', x, y, width, height: 16 });

describe('jumpReach', () => {
  it('derives the widest pit and highest step from the movement numbers', () => {
    // 300 px/s up at 900 px/s²: 0.667 s in the air at 90 px/s = 60 px; 50 + 35 px high.
    expect(reach.maxGap).toBeCloseTo(60 * SAFETY);
    expect(reach.maxStep).toBeCloseTo((50 + 251 ** 2 / 1800) * SAFETY);
  });

  it('without a double jump only the first jump counts', () => {
    const r = jumpReach({ ...MOVEMENT, airJumps: 0, gravity: GRAVITY_Y });
    expect(r.maxStep).toBeCloseTo(50 * SAFETY);
  });
});

describe('routeProblems', () => {
  it('accepts small pits and steps, in any collider order, ignoring walkways', () => {
    const map = [
      solid(100, 136, 50),
      solid(0, 136, 64),
      { ...solid(64, 0, 500), type: 'platform' },
    ];
    expect(routeProblems([...map, solid(150, 72, 40)], reach)).toEqual([]);
  });

  it('reports a pit too wide and a step too high', () => {
    expect(routeProblems([solid(0, 136, 64), solid(130, 136, 64)], reach)).toEqual([
      'pit at x 64 is 66 px wide (max 51)',
    ]);
    expect(routeProblems([solid(0, 136, 64), solid(64, 56, 64)], reach)).toEqual([
      'step up at x 64 is 80 px high (max 72)',
    ]);
  });
});

describe('every map can be crossed along the ground', () => {
  it.each(LEVELS)('$key', (level) => {
    const raw = JSON.parse(
      new TextDecoder().decode(readFileSync(`${process.cwd()}/public/${level.path}`)),
    ) as unknown;
    expect(routeProblems(readLevelLayout(raw, ENEMY_TYPES, BOSS_TYPES).colliders, reach)).toEqual(
      [],
    );
  });
});
