import { describe, expect, it } from 'vitest';
import {
  groundAt,
  initialSpawner,
  runnerGone,
  stepRunner,
  stepSpawner,
  type Spawner,
  type SpawnerState,
} from '../../src/logic/spawner';

const spawner: Spawner = {
  x: 600,
  y: 136,
  enemy: 'alien-runner',
  count: 3,
  everyMs: 900,
  from: 'right',
};
const margin = 24;

/** Runs a spawner frame by frame with the view at `left`, collecting what it spawns. */
const flat = (): number | null => 136;
function run(
  s: Spawner,
  left: number,
  frames: number,
  dt = 100,
  state = initialSpawner(),
  ground: (x: number) => number | null = flat,
) {
  const spawns = [];
  let st: SpawnerState = state;
  for (let i = 0; i < frames; i++) {
    const r = stepSpawner(st, s, { left, right: left + 320 }, dt, margin, ground);
    st = r.state;
    if (r.spawn) spawns.push(r.spawn);
  }
  return { state: st, spawns };
}

describe('stepSpawner (M3.14)', () => {
  it('waits until its point is in view', () => {
    expect(run(spawner, 0, 50).spawns).toEqual([]);
  });

  it('sends the first one at once, just outside the right edge, running left', () => {
    const { spawns } = run(spawner, 300, 1);
    expect(spawns).toEqual([{ x: 644, y: 136, enemy: 'alien-runner', direction: -1 }]);
  });

  it('sends the rest one interval apart, then stops at its count', () => {
    expect(run(spawner, 300, 9).spawns).toHaveLength(1); // 800 ms after the first: not yet
    expect(run(spawner, 300, 10).spawns).toHaveLength(2);
    expect(run(spawner, 300, 100).spawns).toHaveLength(3);
  });

  it('keeps going once started, even if the point scrolls out of view', () => {
    const started = run(spawner, 300, 1).state;
    expect(run(spawner, 2000, 30, 100, started).spawns).toHaveLength(2);
  });

  it('stands each one on the ground where it appears, and waits while that is a pit', () => {
    const ledge = (x: number) => (x > 640 ? 88 : 136);
    expect(run(spawner, 300, 1, 100, initialSpawner(), ledge).spawns[0]?.y).toBe(88);
    const pit = () => null;
    const waiting = run(spawner, 300, 20, 100, initialSpawner(), pit);
    expect(waiting.spawns).toEqual([]);
    expect(run(spawner, 300, 1, 100, waiting.state).spawns).toHaveLength(1);
  });

  it('sends enemies from the left edge running right', () => {
    const left = { ...spawner, from: 'left' as const };
    expect(run(left, 300, 1).spawns[0]).toMatchObject({ x: 276, direction: 1 });
  });
});

describe('runners (M3.14)', () => {
  it('keep running until a wall turns them around', () => {
    expect(stepRunner(-1, { left: false, right: false })).toBe(-1);
    expect(stepRunner(-1, { left: true, right: false })).toBe(1);
    expect(stepRunner(1, { left: false, right: true })).toBe(-1);
    expect(stepRunner(1, { left: true, right: false })).toBe(1);
  });

  it('are gone once far outside the view or down a pit', () => {
    const view = { left: 100, right: 420 };
    expect(runnerGone(200, 136, view, 160, 176)).toBe(false);
    expect(runnerGone(-61, 136, view, 160, 176)).toBe(true);
    expect(runnerGone(581, 136, view, 160, 176)).toBe(true);
    expect(runnerGone(200, 337, view, 160, 176)).toBe(true);
  });
});

describe('groundAt (M3.14)', () => {
  const colliders = [
    { type: 'solid', x: 0, y: 136, width: 100 },
    { type: 'solid', x: 60, y: 88, width: 40 },
    { type: 'platform', x: 120, y: 100, width: 50 },
    { type: 'solid', x: 200, y: 136, width: 100 },
  ];

  it('finds the highest solid floor under a point', () => {
    expect(groundAt(colliders, 10)).toBe(136);
    expect(groundAt(colliders, 70)).toBe(88);
  });

  it('ignores catwalks: over a pit there is no ground', () => {
    expect(groundAt(colliders, 150)).toBeNull();
    expect(groundAt(colliders, 400)).toBeNull();
  });
});
