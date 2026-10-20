import { describe, expect, it } from 'vitest';
import { aim, initialSnake, stepSnake, type SnakeState } from '../../src/logic/snake';

const t = { sightRange: 200, windupMs: 400, restMs: 1600, shotSpeed: 100 };
const mouth = { x: 400, y: 100 };

/** Steps 100 ms frames, collecting the spits. */
function run(state: SnakeState, frames: number, player: { x: number; y: number } | null) {
  let s = state;
  const spits: { vx: number; vy: number }[] = [];
  for (let i = 0; i < frames; i++) {
    const r = stepSnake(s, mouth, player, 100, t);
    s = r.state;
    if (r.spit) spits.push(r.spit);
  }
  return { state: s, spits };
}

describe('stepSnake (M5.1)', () => {
  it('stays still and quiet until the marine is in sight', () => {
    expect(run(initialSnake(), 50, null).spits).toEqual([]);
    expect(run(initialSnake(), 50, { x: 700, y: 100 }).spits).toEqual([]); // 300 px away
  });

  it('on seeing him it rears back for the warning, then spits once', () => {
    const seen = stepSnake(initialSnake(), mouth, { x: 300, y: 100 }, 16, t);
    expect(seen.state).toMatchObject({ mode: 'windup', direction: -1 });
    expect(seen.spit).toBeNull();
    expect(run(seen.state, 3, { x: 300, y: 100 }).spits).toHaveLength(0); // 300 ms: still rearing
    const spat = run(seen.state, 4, { x: 300, y: 100 });
    expect(spat.spits).toHaveLength(1);
    expect(spat.state.mode).toBe('rest');
  });

  it('spits at him: leftwards and level when he is level to its left', () => {
    const spat = run(stepSnake(initialSnake(), mouth, { x: 300, y: 100 }, 16, t).state, 4, {
      x: 300,
      y: 100,
    });
    expect(spat.spits[0]).toEqual({ vx: -100, vy: 0 });
  });

  it('spits down at him when he is below its ledge', () => {
    const below = { x: 500, y: 200 };
    const spat = run(stepSnake(initialSnake(), mouth, below, 16, t).state, 4, below);
    expect(spat.spits[0]?.vx).toBeGreaterThan(0);
    expect(spat.spits[0]?.vy).toBeGreaterThan(0);
    expect(Math.hypot(spat.spits[0]?.vx ?? 0, spat.spits[0]?.vy ?? 0)).toBeCloseTo(100, 5);
  });

  it('rests between spits: one every windup + rest while he stays in sight', () => {
    // 4 s at 100 ms frames: the first spit at about 0.4 s, then one every 2 s (rest + windup).
    expect(run(initialSnake(), 40, { x: 300, y: 100 }).spits).toHaveLength(2);
  });

  it('turns to face him', () => {
    expect(stepSnake(initialSnake(), mouth, { x: 500, y: 100 }, 16, t).state.direction).toBe(1);
    expect(stepSnake(initialSnake(), mouth, { x: 300, y: 100 }, 16, t).state.direction).toBe(-1);
  });

  it('calms down when he leaves its sight, and keeps resting if he does so mid-rest', () => {
    const rearing = stepSnake(initialSnake(), mouth, { x: 300, y: 100 }, 16, t).state;
    expect(stepSnake(rearing, mouth, null, 16, t).state.mode).toBe('idle');
    const resting: SnakeState = { mode: 'rest', ms: 0, direction: -1 };
    expect(stepSnake(resting, mouth, null, 100, t).state).toMatchObject({ mode: 'rest', ms: 100 });
    expect(stepSnake({ ...resting, ms: 1550 }, mouth, null, 100, t).state.mode).toBe('idle');
  });

  it('ignores a negative frame time', () => {
    const rearing = stepSnake(initialSnake(), mouth, { x: 300, y: 100 }, 16, t).state;
    expect(stepSnake(rearing, mouth, { x: 300, y: 100 }, -50, t).state.ms).toBe(0);
  });
});

describe('aim', () => {
  it('points at the target at the given speed', () => {
    const v = aim({ x: 0, y: 0 }, { x: 30, y: 40 }, 50);
    expect(v.vx).toBeCloseTo(30, 5);
    expect(v.vy).toBeCloseTo(40, 5);
  });

  it('goes straight ahead if the target is on the same spot', () => {
    expect(aim({ x: 5, y: 5 }, { x: 5, y: 5 }, 50)).toEqual({ vx: 50, vy: 0 });
  });
});
