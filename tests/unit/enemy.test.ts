import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { applyDamage, initialPatrol, stepPatrol, type PatrolState } from '../../src/logic/enemy';

const T = ENEMIES['alien-walker']; // speed 30, range 48, pause 400 ms
const FRAME = 16;
const free = { left: false, right: false };

describe('stepPatrol', () => {
  it('starts walking left', () => {
    const r = stepPatrol(initialPatrol(), 100, 100, free, FRAME, T);
    expect(r.vx).toBe(-30);
    expect(r.state.direction).toBe(-1);
  });

  it('keeps walking inside its range', () => {
    expect(stepPatrol(initialPatrol(), 60, 100, free, FRAME, T).vx).toBe(-30);
    const right: PatrolState = { direction: 1, pauseMs: 0 };
    expect(stepPatrol(right, 140, 100, free, FRAME, T).vx).toBe(30);
  });

  it('stops at the end of its range, waits, then walks back', () => {
    const atEnd = stepPatrol(initialPatrol(), 52, 100, free, FRAME, T); // 100 - 48
    expect(atEnd).toEqual({ state: { direction: -1, pauseMs: 400 }, vx: 0 });
    const waiting = stepPatrol(atEnd.state, 52, 100, free, 300, T);
    expect(waiting).toEqual({ state: { direction: -1, pauseMs: 100 }, vx: 0 });
    const turned = stepPatrol(waiting.state, 52, 100, free, 100, T);
    expect(turned).toEqual({ state: { direction: 1, pauseMs: 0 }, vx: 30 });
  });

  it('turns at the right end too', () => {
    const r = stepPatrol({ direction: 1, pauseMs: 0 }, 148, 100, free, FRAME, T);
    expect(r.state.pauseMs).toBe(400);
    const back = stepPatrol(r.state, 148, 100, free, 400, T);
    expect(back.state.direction).toBe(-1);
    expect(back.vx).toBe(-30);
  });

  it('turns early when a wall blocks the way', () => {
    expect(stepPatrol(initialPatrol(), 90, 100, { left: true, right: false }, FRAME, T).vx).toBe(0);
    const right: PatrolState = { direction: 1, pauseMs: 0 };
    expect(stepPatrol(right, 110, 100, { left: false, right: true }, FRAME, T).state.pauseMs).toBe(
      400,
    );
  });

  it('ignores a wall behind it', () => {
    expect(stepPatrol(initialPatrol(), 90, 100, { left: false, right: true }, FRAME, T).vx).toBe(
      -30,
    );
  });

  it('treats a negative step as no time passing', () => {
    const waiting: PatrolState = { direction: -1, pauseMs: 200 };
    expect(stepPatrol(waiting, 52, 100, free, -50, T).state.pauseMs).toBe(200);
  });
});

describe('applyDamage', () => {
  it('takes 3 rifle hits to destroy an alien walker', () => {
    let hp = T.hp;
    const results = [1, 1, 1].map((d) => {
      const r = applyDamage(hp, d);
      hp = r.hp;
      return r;
    });
    expect(results).toEqual([
      { hp: 2, dead: false },
      { hp: 1, dead: false },
      { hp: 0, dead: true },
    ]);
  });

  it('never goes below zero and ignores negative damage', () => {
    expect(applyDamage(1, 5)).toEqual({ hp: 0, dead: true });
    expect(applyDamage(2, -3)).toEqual({ hp: 2, dead: false });
  });
});
