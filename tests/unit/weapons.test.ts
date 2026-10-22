import { describe, expect, it } from 'vitest';
import {
  PICKUPS,
  PICKUP_IMAGES,
  PICKUP_WEAPONS,
  RAPID,
  WEAPONS,
  WEAPON_TYPES,
} from '../../src/data/weapons';
import {
  fanVelocities,
  nextWeapon,
  podPosition,
  weaponAfterDeath,
  withRapid,
} from '../../src/logic/pickups';
import { stepWeapon, initialWeapon } from '../../src/logic/weapon';

describe('weapon data (M4.1)', () => {
  it('has the rifle and the two approved pickups', () => {
    expect(WEAPON_TYPES).toEqual(['rifle', 'machine-gun', 'spread']);
    expect(PICKUP_WEAPONS).toEqual(['machine-gun', 'spread']);
  });

  it('keeps the rifle one shot per press (issue #21), and the machine gun automatic', () => {
    expect(WEAPONS.rifle.autoFire).toBe(false);
    expect(WEAPONS['machine-gun'].autoFire).toBe(true);
  });

  it.each(WEAPON_TYPES)('%s has sane numbers and a one-letter label', (type) => {
    const w = WEAPONS[type];
    expect(w.letter).toMatch(/^[A-Z]$/);
    expect(w.bullets).toBeGreaterThanOrEqual(1);
    expect(w.tapMinMs).toBeGreaterThan(0);
    expect(w.autoIntervalMs).toBeGreaterThan(0);
    expect(w.damage).toBeGreaterThan(0);
  });

  it('gives every weapon its own letter', () => {
    const letters = WEAPON_TYPES.map((t) => WEAPONS[t].letter);
    expect(new Set(letters).size).toBe(letters.length);
  });
});

describe('fanVelocities (M4.1)', () => {
  it('leaves a single bullet on the aim', () => {
    expect(fanVelocities({ vx: 300, vy: 0 }, 1, 15)).toEqual([{ vx: 300, vy: 0 }]);
  });

  it('fans three bullets 15° apart around a forward shot, all at the same speed', () => {
    const [up, mid, down] = fanVelocities({ vx: 300, vy: 0 }, 3, 15);
    expect(mid?.vx).toBeCloseTo(300, 6);
    expect(mid?.vy).toBeCloseTo(0, 6);
    expect(up?.vy).toBeCloseTo(-300 * Math.sin(Math.PI / 12), 6);
    expect(down?.vy).toBeCloseTo(300 * Math.sin(Math.PI / 12), 6);
    for (const v of [up, mid, down]) expect(Math.hypot(v?.vx ?? 0, v?.vy ?? 0)).toBeCloseTo(300, 6);
  });

  it('fans around a diagonal aim too', () => {
    const d = 300 * Math.SQRT1_2;
    const fan = fanVelocities({ vx: d, vy: -d }, 3, 15);
    expect(fan[1]?.vx).toBeCloseTo(d, 6);
    expect(fan[1]?.vy).toBeCloseTo(-d, 6);
  });
});

describe('pods (M4.1)', () => {
  const t = { speed: 60, amplitude: 12, periodMs: 2000 };

  it('flies across at its speed, waving about its line', () => {
    expect(podPosition({ x: 0, y: 40 }, 1, 0, t)).toEqual({ x: 0, y: 40 });
    const quarter = podPosition({ x: 0, y: 40 }, 1, 500, t);
    expect(quarter.x).toBeCloseTo(30, 6);
    expect(quarter.y).toBeCloseTo(52, 6);
    expect(podPosition({ x: 300, y: 40 }, -1, 1000, t).x).toBeCloseTo(240, 6);
  });
});

describe('losing a life (M4.1)', () => {
  it('goes back to the rifle', () => {
    expect(weaponAfterDeath()).toBe('rifle');
  });
});

describe('nextWeapon (the GUNNY cheat)', () => {
  it('steps through every weapon and wraps', () => {
    expect(nextWeapon('rifle', WEAPON_TYPES)).toBe('machine-gun');
    expect(nextWeapon('machine-gun', WEAPON_TYPES)).toBe('spread');
    expect(nextWeapon('spread', WEAPON_TYPES)).toBe('rifle');
  });
});

describe('R, rapid fire (M7.1)', () => {
  it('is a blimp pickup with its own image, letter and colour', () => {
    expect(PICKUPS).toContain('rapid');
    expect(PICKUP_IMAGES.rapid).toBe('pickup-rapid');
    expect(RAPID.letter).toBe('R');
    const weaponColours = WEAPON_TYPES.map((t) => WEAPONS[t].color);
    expect(weaponColours).not.toContain(RAPID.color);
  });

  it('makes the rifle and the spread fire while held, at their own rate', () => {
    for (const type of ['rifle', 'spread'] as const) {
      const rules = withRapid(WEAPONS[type], true);
      expect(rules.autoFire).toBe(true);
      expect(rules.autoIntervalMs).toBe(WEAPONS[type].autoIntervalMs);
      expect(rules.tapMinMs).toBe(WEAPONS[type].tapMinMs);
    }
  });

  it('adds nothing to the machine gun, and nothing without R', () => {
    expect(withRapid(WEAPONS['machine-gun'], true)).toBe(WEAPONS['machine-gun']);
    expect(withRapid(WEAPONS.rifle, false)).toBe(WEAPONS.rifle);
    expect(WEAPONS.rifle.autoFire).toBe(false); // the data itself is unchanged
  });

  it('with R, holding fire with the rifle fires again every autoIntervalMs', () => {
    const rules = withRapid(WEAPONS.rifle, true);
    let state = stepWeapon(initialWeapon(), true, true, 16, rules).state;
    let shots = 1;
    for (let t = 16; t < 1000; t += 16) {
      const step = stepWeapon(state, true, false, 16, rules);
      state = step.state;
      if (step.fired) shots++;
    }
    expect(shots).toBe(Math.floor(1000 / WEAPONS.rifle.autoIntervalMs) + 1);
    // Without R, the same hold fires only the first shot.
    let plain = stepWeapon(initialWeapon(), true, true, 16, WEAPONS.rifle).state;
    let more = 0;
    for (let t = 16; t < 1000; t += 16) {
      const step = stepWeapon(plain, true, false, 16, WEAPONS.rifle);
      plain = step.state;
      if (step.fired) more++;
    }
    expect(more).toBe(0);
  });
});
