import { describe, expect, it } from 'vitest';
import {
  arenaLocked,
  damageBoss,
  initialBoss,
  lobVelocity,
  phaseFor,
  startBoss,
  stepBoss,
  type BossState,
  type BossTuning,
  shellLanded,
} from '../../src/logic/boss';

const T: BossTuning = {
  hp: 10,
  introSpeed: 40,
  phases: [
    {
      fromHpShare: 1,
      driveSpeed: 20,
      attacks: [{ kind: 'cannon', cooldownMs: 1000, firstDelayMs: 500 }],
    },
    {
      fromHpShare: 0.5,
      driveSpeed: 30,
      attacks: [
        { kind: 'cannon', cooldownMs: 600, firstDelayMs: 300 },
        { kind: 'mortar', cooldownMs: 2000, firstDelayMs: 800 },
      ],
    },
  ],
  dyingMs: 1000,
};
const RANGE = { min: 100, max: 200 };

/** A boss that has rolled in and is fighting. */
function fighting(): BossState {
  const s = startBoss(initialBoss(T));
  return stepBoss(s, RANGE.max, RANGE, 16, T).state;
}

describe('boss start and intro', () => {
  it('waits, still, until the arena is entered', () => {
    const s = initialBoss(T);
    expect(s).toMatchObject({ mode: 'waiting', hp: 10, phase: 0 });
    expect(stepBoss(s, 300, RANGE, 16, T)).toMatchObject({ vx: 0, attacks: [] });
  });

  it('rolls in from the right, then starts fighting at its drive range', () => {
    const s = startBoss(initialBoss(T));
    expect(s.mode).toBe('intro');
    expect(startBoss(s)).toBe(s); // starting twice changes nothing
    expect(stepBoss(s, 260, RANGE, 16, T)).toMatchObject({ vx: -40, attacks: [] });
    const arrived = stepBoss(s, 200, RANGE, 16, T);
    expect(arrived.state).toMatchObject({ mode: 'fight', timers: { cannon: 500 } });
  });

  it('cannot be hurt while rolling in', () => {
    const s = startBoss(initialBoss(T));
    expect(damageBoss(s, 1, T)).toMatchObject({ hit: false, state: { hp: 10 } });
  });
});

describe('boss fight', () => {
  it('drives between the ends of its range, turning at each', () => {
    let s = fighting();
    const left = stepBoss(s, 150, RANGE, 16, T);
    expect(left.vx).toBe(-20);
    s = stepBoss(s, 100, RANGE, 16, T).state;
    expect(s.direction).toBe(1);
    expect(stepBoss(s, 150, RANGE, 16, T).vx).toBe(20);
    s = stepBoss(s, 200, RANGE, 16, T).state;
    expect(s.direction).toBe(-1);
  });

  it('attacks when a timer runs out, then waits its cooldown', () => {
    let s = fighting();
    let step = stepBoss(s, 150, RANGE, 499, T);
    expect(step.attacks).toEqual([]);
    step = stepBoss(step.state, 150, RANGE, 1, T);
    expect(step.attacks).toEqual(['cannon']);
    expect(step.state.timers.cannon).toBe(1000);
    s = step.state;
    expect(stepBoss(s, 150, RANGE, 999, T).attacks).toEqual([]);
  });

  it('a long frame carries the overshoot into the next cooldown', () => {
    const step = stepBoss(fighting(), 150, RANGE, 700, T);
    expect(step.attacks).toEqual(['cannon']);
    expect(step.state.timers.cannon).toBe(800);
  });

  it('takes hits, and below half health moves to phase 2 with its own attacks', () => {
    let s = fighting();
    for (let i = 0; i < 4; i++) s = damageBoss(s, 1, T).state;
    expect(s.hp).toBe(6);
    expect(stepBoss(s, 150, RANGE, 16, T).state.phase).toBe(0);
    s = damageBoss(s, 1, T).state; // 5 of 10: half
    const step = stepBoss(s, 150, RANGE, 16, T);
    expect(step.state.phase).toBe(1);
    expect(step.vx).toBe(-30);
    expect(step.state.timers).toEqual({ cannon: 284, mortar: 784 });
    // Both attacks come round in phase 2.
    let st = step.state;
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const r = stepBoss(st, 150, RANGE, 16, T);
      r.attacks.forEach((a) => seen.add(a));
      st = r.state;
    }
    expect([...seen].sort()).toEqual(['cannon', 'mortar']);
  });

  it('phaseFor picks the last phase the health has reached', () => {
    expect([10, 6, 5, 1, 0].map((hp) => phaseFor(hp, T))).toEqual([0, 0, 1, 1, 1]);
  });

  it('ignores hits of no damage', () => {
    expect(damageBoss(fighting(), 0, T).hit).toBe(false);
  });
});

describe('boss defeat', () => {
  it('blows up when destroyed, stops attacking, then finishes once', () => {
    let s = fighting();
    const r = damageBoss(s, 99, T);
    expect(r).toMatchObject({ hit: true, destroyed: true, state: { mode: 'dying', hp: 0 } });
    s = r.state;
    expect(damageBoss(s, 1, T).hit).toBe(false); // no more hits once dying
    let step = stepBoss(s, 150, RANGE, 600, T);
    expect(step).toMatchObject({ vx: 0, attacks: [], finished: false });
    step = stepBoss(step.state, 150, RANGE, 400, T);
    expect(step.finished).toBe(true);
    expect(step.state.mode).toBe('dead');
    expect(stepBoss(step.state, 150, RANGE, 16, T).finished).toBe(false);
  });
});

describe('lobVelocity', () => {
  it('lands the shell on the target after the flight time', () => {
    const from = { x: 300, y: 80 };
    const to = { x: 120, y: 136 };
    const g = 900;
    const v = lobVelocity(from, to, 1100, g);
    const s = 1.1;
    expect(from.x + v.vx * s).toBeCloseTo(to.x);
    expect(from.y + v.vy * s + 0.5 * g * s * s).toBeCloseTo(to.y);
    expect(v.vy).toBeLessThan(0); // it goes up first
  });
});

describe('arenaLocked', () => {
  it('locks once the marine reaches the middle of the arena', () => {
    const arena = { x: 1000, width: 320 };
    expect(arenaLocked(1159, arena)).toBe(false);
    expect(arenaLocked(1160, arena)).toBe(true);
  });
});

describe('shellLanded (M3.12: shells burst at their mark, not on terrain)', () => {
  it('is false while the shell is still rising or above its landing height', () => {
    expect(shellLanded(100, -50, 140)).toBe(false);
    expect(shellLanded(120, 80, 140)).toBe(false);
  });

  it('is true once it is falling at or below its landing height', () => {
    expect(shellLanded(140, 80, 140)).toBe(true);
    expect(shellLanded(143, 120, 140)).toBe(true);
  });

  it('does not burst a shell that passes its landing height on the way up', () => {
    expect(shellLanded(150, -200, 140)).toBe(false);
  });
});
