import { describe, expect, it } from 'vitest';
import {
  depthScale,
  fireShots,
  hitCore,
  initialMarine,
  initialRoom,
  project,
  shotX,
  stepMarine,
  stepRoom,
  stepShot,
  stepWalker,
  type BaseInput,
  type BaseRoom,
} from '../../src/logic/base';
import { createRng } from '../../src/logic/rng';

const P = { centerX: 160, nearFloorY: 176, farFloorY: 104, farScale: 0.3 };
const M = { speed: 90, minX: 24, maxX: 296, jumpSpeed: 240, gravity: 900, halfWidth: 10 };
const S = { depthSpeed: 1.5, height: 26, crouchHeight: 14, halfWidth: 3, spreadDrift: 60 };
const W = { depthSpeed: 0.3, steerSpeed: 20, halfWidth: 14, height: 30 };
const NONE: BaseInput = { left: false, right: false, down: false, jump: false };
const ROOM: BaseRoom = {
  core: { hp: 10, halfWidth: 40 },
  walkers: { firstMs: 1000, everyMs: 1500, count: 3, lanes: [100, 160, 220], hp: 1 },
};

describe('projection', () => {
  it('is full size at the near edge and farScale at the far wall', () => {
    expect(depthScale(0, P)).toBe(1);
    expect(depthScale(1, P)).toBeCloseTo(0.3, 10);
    expect(depthScale(0.5, P)).toBeLessThan(0.65); // perspective: halfway in looks smaller
  });

  it('puts the floor at the screen bottom near and at farFloorY at the far wall', () => {
    expect(project(160, 0, 0, P).y).toBeCloseTo(176, 10);
    expect(project(160, 1, 0, P).y).toBeCloseTo(104, 10);
  });

  it('draws the room narrowing towards the far wall, around the centre line', () => {
    expect(project(0, 0, 0, P).x).toBeCloseTo(0, 10);
    expect(project(320, 1, 0, P).x).toBeCloseTo(160 + 160 * 0.3, 10);
    expect(project(0, 1, 0, P).x).toBeCloseTo(160 - 160 * 0.3, 10);
  });

  it('raises things by their height, shrunk with depth', () => {
    expect(project(160, 0, 20, P).y).toBeCloseTo(156, 10);
    expect(project(160, 1, 20, P).y).toBeCloseTo(104 - 6, 10);
  });
});

describe('stepMarine', () => {
  it('runs left and right along the near edge, within the room', () => {
    const m = initialMarine(160);
    expect(stepMarine(m, { ...NONE, right: true }, 1000, M).x).toBe(250);
    expect(stepMarine(m, { ...NONE, left: true }, 10_000, M).x).toBe(24);
    expect(stepMarine(m, { ...NONE, right: true }, 10_000, M).x).toBe(296);
  });

  it('jumps from the floor and lands again', () => {
    let m = stepMarine(initialMarine(160), { ...NONE, jump: true }, 16, M);
    expect(m.h).toBeGreaterThan(0);
    let top = 0;
    for (let i = 0; i < 60; i++) {
      m = stepMarine(m, NONE, 16, M);
      top = Math.max(top, m.h);
    }
    expect(top).toBeGreaterThan(25); // 240² / 1800 = 32 px
    expect(m.h).toBe(0);
    expect(m.vh).toBe(0);
  });

  it("can't jump again in the air", () => {
    const up = stepMarine(initialMarine(160), { ...NONE, jump: true }, 16, M);
    const again = stepMarine(up, { ...NONE, jump: true }, 16, M);
    expect(again.vh).toBeLessThan(up.vh);
  });

  it('crouches on the floor while down is held, and stays put', () => {
    const m = stepMarine(initialMarine(160), { ...NONE, down: true, right: true }, 500, M);
    expect(m.crouching).toBe(true);
    expect(m.x).toBe(160);
  });
});

describe('shots', () => {
  it('fly from him into the room at his shoulder, lower when crouched', () => {
    const [shot] = fireShots(initialMarine(120), 1, S);
    expect(shot).toEqual({ x0: 120, drift: 0, z: 0, h: 26 });
    expect(fireShots({ ...initialMarine(120), crouching: true }, 1, S)[0]?.h).toBe(14);
  });

  it('the spread fans out three of them', () => {
    const shots = fireShots(initialMarine(160), 3, S);
    expect(shots.map((s) => s.drift)).toEqual([-60, 0, 60]);
    expect(shots.map((s) => shotX(s, 1))).toEqual([100, 160, 220]);
  });

  it('hit the nearest target they pass through, and reach the far wall', () => {
    const [shot] = fireShots(initialMarine(160), 1, S);
    if (!shot) throw new Error('no shot');
    const targets = [
      { x: 160, z: 0.6, halfWidth: 14 },
      { x: 160, z: 0.3, halfWidth: 14 },
      { x: 250, z: 0.2, halfWidth: 14 }, // off to the side
    ];
    const r = stepShot(shot, 300, targets, S); // z 0 -> 0.45
    expect(r.hit).toBe(1);
    expect(r.atWall).toBe(false);
    expect(stepShot({ ...shot, z: 0.9 }, 100, [], S).atWall).toBe(true);
  });

  it("miss a target they didn't reach yet or already passed", () => {
    const [shot] = fireShots(initialMarine(160), 1, S);
    if (!shot) throw new Error('no shot');
    expect(stepShot(shot, 100, [{ x: 160, z: 0.5, halfWidth: 14 }], S).hit).toBe(-1);
    expect(stepShot({ ...shot, z: 0.6 }, 100, [{ x: 160, z: 0.5, halfWidth: 14 }], S).hit).toBe(-1);
  });
});

describe('stepWalker', () => {
  it('runs out of the far end towards him, steering at him', () => {
    const r = stepWalker({ x: 100, z: 1, hp: 1 }, initialMarine(160), 10, 1000, W);
    expect(r.walker.z).toBeCloseTo(0.7, 10);
    expect(r.walker.x).toBe(120);
    expect(r.contact).toBe(false);
    expect(r.gone).toBe(false);
  });

  it('touches him when it reaches the near edge where he stands', () => {
    const r = stepWalker({ x: 160, z: 0.01, hp: 1 }, initialMarine(160), 10, 100, W);
    expect(r.contact).toBe(true);
    expect(r.gone).toBe(true);
  });

  it('misses him if he is elsewhere or jumping over it', () => {
    const far = stepWalker({ x: 60, z: 0.01, hp: 1 }, initialMarine(260), 10, 100, W);
    expect(far.contact).toBe(false);
    const jumping = { ...initialMarine(160), h: 40 };
    expect(stepWalker({ x: 160, z: 0.01, hp: 1 }, jumping, 10, 100, W).contact).toBe(false);
  });
});

describe('the room', () => {
  it('sends its walkers out on schedule, from its lanes, and no more than its count', () => {
    let r = initialRoom(ROOM);
    const rng = createRng(7);
    const sent: number[] = [];
    for (let t = 0; t < 10_000; t += 100) {
      const step = stepRoom(r, ROOM, 100, rng);
      r = step.room;
      if (step.spawn) {
        sent.push(t);
        expect(ROOM.walkers.lanes).toContain(step.spawn.x);
        expect(step.spawn.z).toBe(1);
      }
    }
    expect(sent).toEqual([900, 2400, 3900]);
  });

  it('the same seed sends the same lanes', () => {
    const lanes = (seed: number) => {
      let r = initialRoom(ROOM);
      const rng = createRng(seed);
      const out: number[] = [];
      for (let i = 0; i < 100; i++) {
        const s = stepRoom(r, ROOM, 100, rng);
        r = s.room;
        if (s.spawn) out.push(s.spawn.x);
      }
      return out;
    };
    expect(lanes(3)).toEqual(lanes(3));
  });

  it('destroying the core clears the room, and then no more walkers come', () => {
    let r = initialRoom(ROOM);
    r = hitCore(r, 4);
    expect(r).toMatchObject({ coreHp: 6, clearedMs: null });
    r = hitCore(r, 99);
    expect(r).toMatchObject({ coreHp: 0, clearedMs: 0 });
    expect(hitCore(r, 1)).toBe(r);
    const later = stepRoom(r, ROOM, 5000, createRng(1));
    expect(later.spawn).toBeNull();
    expect(later.room.clearedMs).toBe(5000);
  });

  it('ignores negative time', () => {
    const r = initialRoom(ROOM);
    expect(stepRoom(r, ROOM, -50, createRng(1)).room.nextMs).toBe(1000);
    expect(stepMarine(initialMarine(100), { ...NONE, right: true }, -50, M).x).toBe(100);
  });
});
