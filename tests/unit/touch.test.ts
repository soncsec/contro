import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../../src/logic/input';
import { TOUCH_BINDINGS, knobOffset, stickDirections, weaponForFrame } from '../../src/logic/touch';

const R = 60; // stick radius in screen pixels
const DZ = 0.3;
const at = (degrees: number, distance = 50) => {
  const a = (degrees * Math.PI) / 180;
  // Screen y points down, so "up" is a negative dy.
  return stickDirections(Math.cos(a) * distance, -Math.sin(a) * distance, R, DZ);
};

describe('stickDirections', () => {
  it('is not pushed inside the dead zone', () => {
    expect(stickDirections(0, 0, R, DZ)).toEqual([]);
    expect(stickDirections(17, 0, R, DZ)).toEqual([]); // 17 < 60 × 0.3
    expect(stickDirections(18, 0, R, DZ)).toEqual(['right']);
  });

  it('has eight 45° slices', () => {
    expect(at(0)).toEqual(['right']);
    expect(at(45)).toEqual(['right', 'up']);
    expect(at(90)).toEqual(['up']);
    expect(at(135)).toEqual(['left', 'up']);
    expect(at(180)).toEqual(['left']);
    expect(at(225)).toEqual(['left', 'down']);
    expect(at(270)).toEqual(['down']);
    expect(at(315)).toEqual(['right', 'down']);
  });

  it('switches between straight and diagonal at 22.5° either side of each axis', () => {
    expect(at(22)).toEqual(['right']);
    expect(at(23)).toEqual(['right', 'up']);
    expect(at(67)).toEqual(['right', 'up']);
    expect(at(68)).toEqual(['up']);
  });

  it('keeps working past the ring, as a thumb slides off it', () => {
    expect(at(0, 200)).toEqual(['right']);
  });

  it('is never pushed with no size', () => {
    expect(stickDirections(30, 0, 0, DZ)).toEqual([]);
  });
});

describe('knobOffset', () => {
  it('follows the thumb inside the limit, and stops at it outside', () => {
    expect(knobOffset(10, -5, 33)).toEqual({ x: 10, y: -5 });
    expect(knobOffset(0, 0, 33)).toEqual({ x: 0, y: 0 });
    const k = knobOffset(66, 0, 33);
    expect(k.x).toBeCloseTo(33);
    expect(k.y).toBeCloseTo(0);
  });
});

describe('TOUCH_BINDINGS', () => {
  it('gives every action its own touch code', () => {
    const codes = ACTIONS.flatMap((a) => TOUCH_BINDINGS[a]);
    expect(codes).toHaveLength(ACTIONS.length);
    expect(new Set(codes).size).toBe(ACTIONS.length);
  });
});

describe('weaponForFrame (M3.4: holding the on-screen FIRE auto-fires)', () => {
  const rifle = { autoFire: false, autoIntervalMs: 160, tapMinMs: 90 };

  it('keeps the one-shot rifle for keys and gamepad', () => {
    expect(weaponForFrame(rifle, false, 120)).toBe(rifle);
  });

  it('auto-fires at the touch interval while the on-screen FIRE is held', () => {
    expect(weaponForFrame(rifle, true, 120)).toEqual({
      autoFire: true,
      autoIntervalMs: 120,
      tapMinMs: 90,
    });
  });
});

describe('weaponForFrame with an automatic weapon (M4.1)', () => {
  it('keeps the machine gun at its own rate on a touch screen', () => {
    const mg = { autoFire: true, autoIntervalMs: 100, tapMinMs: 90 };
    expect(weaponForFrame(mg, true, 160)).toBe(mg);
  });
});
