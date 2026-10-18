import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { initialFlyer, stepFlyer, towards, type FlyerState } from '../../src/logic/flyer';

const stats = ENEMIES['alien-flyer'].flyer;
if (!stats) throw new Error('alien-flyer has no flyer tuning');
const T = stats;
const FRAME = 16;
const anchor = { x: 700, y: 70 };
const far = { x: 100, y: 150 }; // out of dive and fire range

const hover = (over: Partial<FlyerState> = {}): FlyerState => ({
  ...initialFlyer(T),
  diveCooldownMs: 9999,
  fireCooldownMs: 9999,
  ...over,
});

describe('towards', () => {
  it('points at the target with the given speed', () => {
    expect(towards({ x: 0, y: 0 }, { x: 3, y: 4 }, 10)).toEqual({ vx: 6, vy: 8 });
    expect(towards({ x: 1, y: 1 }, { x: 1, y: 1 }, 10)).toEqual({ vx: 0, vy: 0 });
  });
});

describe('hovering', () => {
  it('drifts left first, then turns at the end of its range', () => {
    expect(stepFlyer(hover(), anchor, anchor, far, FRAME, T).vx).toBe(-25);
    const atLeft = stepFlyer(hover(), { x: 636, y: 70 }, anchor, far, FRAME, T);
    expect(atLeft.state.direction).toBe(1);
    expect(atLeft.vx).toBe(25);
    const atRight = stepFlyer(hover({ direction: 1 }), { x: 764, y: 70 }, anchor, far, FRAME, T);
    expect(atRight.vx).toBe(-25);
  });

  it('bobs around its spawn height', () => {
    // A quarter period in, the bob target is 6 px below the anchor: it moves down towards it.
    const r = stepFlyer(hover({ bobMs: 350 - FRAME }), anchor, anchor, far, FRAME, T);
    expect(r.vy).toBeGreaterThan(0);
    const up = stepFlyer(hover({ bobMs: 1050 - FRAME }), anchor, anchor, far, FRAME, T);
    expect(up.vy).toBeLessThan(0);
  });

  it('staggers the first shot and dive', () => {
    expect(initialFlyer(T, 500).fireCooldownMs).toBe(T.fireCooldownMs / 2 + 500);
  });
});

describe('shooting', () => {
  it('fires an aimed shot when the marine is in range and the cooldown is over', () => {
    const player = { x: 700 - 60, y: 70 + 80 }; // 100 px away, out of dive range
    const r = stepFlyer(hover({ fireCooldownMs: 0 }), anchor, anchor, player, FRAME, T);
    expect(r.shot?.vx).toBeCloseTo(-48, 5);
    expect(r.shot?.vy).toBeCloseTo(64, 5);
    expect(r.state.fireCooldownMs).toBe(T.fireCooldownMs);
  });

  it('waits for the cooldown, and ignores a marine out of range', () => {
    const player = { x: 640, y: 150 };
    expect(
      stepFlyer(hover({ fireCooldownMs: 100 }), anchor, anchor, player, FRAME, T).shot,
    ).toBeNull();
    expect(stepFlyer(hover({ fireCooldownMs: 0 }), anchor, anchor, far, FRAME, T).shot).toBeNull();
    expect(stepFlyer(hover({ fireCooldownMs: 0 }), anchor, anchor, null, FRAME, T).shot).toBeNull();
  });
});

describe('diving', () => {
  const below = { x: 720, y: 160 };

  it('stops to warn when the marine is below and close, aiming at where he stands', () => {
    const r = stepFlyer(hover({ diveCooldownMs: 0 }), anchor, anchor, below, FRAME, T);
    expect(r.state).toMatchObject({ mode: 'windup', target: below, direction: 1 });
    expect([r.vx, r.vy]).toEqual([0, 0]);
  });

  it('does not dive at a marine above it or too far to the side', () => {
    const above = stepFlyer(
      hover({ diveCooldownMs: 0 }),
      anchor,
      anchor,
      { x: 710, y: 40 },
      FRAME,
      T,
    );
    expect(above.state.mode).toBe('hover');
    const aside = stepFlyer(
      hover({ diveCooldownMs: 0 }),
      anchor,
      anchor,
      { x: 760, y: 160 },
      FRAME,
      T,
    );
    expect(aside.state.mode).toBe('hover');
  });

  it('holds still for the warning, then dives at the target', () => {
    const windup = { ...hover(), mode: 'windup' as const, target: below };
    const still = stepFlyer(windup, anchor, anchor, below, T.windupMs - 1, T);
    expect(still.state.mode).toBe('windup');
    const go = stepFlyer(still.state, anchor, anchor, below, 1, T);
    expect(go.state.mode).toBe('dive');
    const diving = stepFlyer(go.state, anchor, anchor, below, FRAME, T);
    expect(Math.hypot(diving.vx, diving.vy)).toBeCloseTo(150, 5);
    expect(diving.vx).toBeGreaterThan(0);
    expect(diving.vy).toBeGreaterThan(0);
  });

  it('rises back once it reaches the target height, then hovers again', () => {
    const diving = { ...hover(), mode: 'dive' as const, target: below };
    const r = stepFlyer(diving, { x: 719, y: 160 }, anchor, below, FRAME, T);
    expect(r.state.mode).toBe('rise');
    expect(r.vy).toBe(-70);
    const rising = stepFlyer(r.state, { x: 719, y: 100 }, anchor, below, FRAME, T);
    expect(rising.vy).toBe(-70);
    const back = stepFlyer(rising.state, { x: 719, y: 70 }, anchor, below, FRAME, T);
    expect(back.state).toMatchObject({ mode: 'hover', diveCooldownMs: T.diveCooldownMs });
  });

  it('gives up a dive that takes too long', () => {
    const diving = { ...hover(), mode: 'dive' as const, target: below, modeMs: T.maxDiveMs };
    expect(stepFlyer(diving, anchor, anchor, below, FRAME, T).state.mode).toBe('rise');
  });

  it('treats a negative step as no time passing', () => {
    expect(stepFlyer(hover(), anchor, anchor, far, -50, T).state.bobMs).toBe(0);
  });
});
