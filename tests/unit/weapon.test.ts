import { describe, expect, it } from 'vitest';
import { WEAPON } from '../../src/config/tuning';
import {
  bulletOutOfView,
  initialWeapon,
  stepWeapon,
  type WeaponState,
} from '../../src/logic/weapon';

const FRAME = 16;

/**
 * Plays a pattern of fire held (true) or not (false), one entry per frame, with
 * presses derived the way the input layer reports them (down this frame, up last frame).
 */
function play(state: WeaponState, pattern: boolean[]): { state: WeaponState; shots: number[] } {
  const shots: number[] = [];
  let s = state;
  pattern.forEach((fire, i) => {
    const pressed = fire && !(pattern[i - 1] ?? false);
    const r = stepWeapon(s, fire, pressed, FRAME, WEAPON);
    if (r.fired) shots.push(i);
    s = r.state;
  });
  return { state: s, shots };
}

describe('stepWeapon', () => {
  it('fires at once on the first press', () => {
    expect(stepWeapon(initialWeapon(), true, true, FRAME, WEAPON).fired).toBe(true);
  });

  it('does not fire when fire is not pressed', () => {
    expect(play(initialWeapon(), Array(30).fill(false)).shots).toEqual([]);
  });

  it('fires once per press: holding fire does not keep firing', () => {
    // 2 s held (125 frames of 16 ms): one shot, on the press.
    expect(play(initialWeapon(), Array(125).fill(true)).shots).toEqual([0]);
  });

  it('a weapon with autoFire keeps firing every 160 ms while held (the planned machine gun)', () => {
    const machineGun = { ...WEAPON, autoFire: true };
    let s = initialWeapon();
    const shots: number[] = [];
    for (let i = 0; i < 60; i++) {
      const r = stepWeapon(s, true, i === 0, FRAME, machineGun);
      if (r.fired) shots.push(i);
      s = r.state;
    }
    expect(shots).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it('held auto-fire keeps its rate at a low frame rate (49 ms frames)', () => {
    const machineGun = { ...WEAPON, autoFire: true, autoIntervalMs: 100 };
    let s = initialWeapon();
    let shots = 0;
    // 2 s of 49 ms frames, fire held after the first press: one shot per 100 ms, about 20.
    for (let i = 0; i < 41; i++) {
      const r = stepWeapon(s, true, i === 0, 49, machineGun);
      if (r.fired) shots++;
      s = r.state;
    }
    expect(shots).toBeGreaterThanOrEqual(19);
    expect(shots).toBeLessThanOrEqual(21);
  });

  it('auto-fire never fires more than once a frame, even with very long frames', () => {
    const machineGun = { ...WEAPON, autoFire: true, autoIntervalMs: 100 };
    let s = initialWeapon();
    let shots = 0;
    for (let i = 0; i < 10; i++) {
      const r = stepWeapon(s, true, i === 0, 350, machineGun);
      if (r.fired) shots++;
      s = r.state;
    }
    expect(shots).toBe(10);
    // The carried-over time is at most one frame's worth.
    expect(s.sinceShotMs).toBeLessThanOrEqual(350);
  });

  it('starting to hold fire without a fresh press does not fire twice in a row', () => {
    const machineGun = { ...WEAPON, autoFire: true, autoIntervalMs: 100 };
    const first = stepWeapon(initialWeapon(), true, false, FRAME, machineGun);
    expect(first.fired).toBe(true);
    expect(stepWeapon(first.state, true, false, FRAME, machineGun).fired).toBe(false);
  });

  it('lets fast tapping fire every 90 ms or so', () => {
    // Press 1 frame, release 5 frames: a new press every 96 ms.
    const pattern = Array.from({ length: 60 }, (_, i) => i % 6 === 0);
    expect(play(initialWeapon(), pattern).shots).toEqual([0, 6, 12, 18, 24, 30, 36, 42, 48, 54]);
  });

  it('ignores taps faster than 90 ms', () => {
    // A new press every 64 ms: only every second press can fire.
    const pattern = Array.from({ length: 24 }, (_, i) => i % 4 === 0);
    expect(play(initialWeapon(), pattern).shots).toEqual([0, 8, 16]);
  });

  it('counts a tap that was released before the frame ran', () => {
    // Pressed and released between frames: not held now, but still a press.
    expect(stepWeapon(initialWeapon(), false, true, FRAME, WEAPON).fired).toBe(true);
  });

  it('counts a quick release and re-press as a new shot once 90 ms have passed', () => {
    // 6 frames held (96 ms since the shot), then a re-press within one frame.
    const held = play(initialWeapon(), Array(6).fill(true));
    expect(stepWeapon(held.state, true, false, FRAME, WEAPON).fired).toBe(false); // still holding
    expect(stepWeapon(held.state, true, true, FRAME, WEAPON).fired).toBe(true); // new press
  });

  it('treats a negative step as no time passing', () => {
    const first = stepWeapon(initialWeapon(), true, true, FRAME, WEAPON);
    expect(stepWeapon(first.state, true, false, -100, WEAPON).state.sinceShotMs).toBe(0);
  });
});

describe('bulletOutOfView', () => {
  const view = { x: 0, y: 0, width: 320, height: 176 };

  it('keeps bullets inside the view plus margin', () => {
    expect(bulletOutOfView(100, 100, view, 16)).toBe(false);
    expect(bulletOutOfView(336, 100, view, 16)).toBe(false);
    expect(bulletOutOfView(-16, -16, view, 16)).toBe(false);
    expect(bulletOutOfView(100, 192, view, 16)).toBe(false);
  });

  it('removes bullets past the margin on any side', () => {
    expect(bulletOutOfView(337, 100, view, 16)).toBe(true);
    expect(bulletOutOfView(-17, 100, view, 16)).toBe(true);
    expect(bulletOutOfView(100, -17, view, 16)).toBe(true);
    expect(bulletOutOfView(100, 193, view, 16)).toBe(true);
  });

  it('follows the camera', () => {
    const scrolled = { ...view, x: 480 };
    expect(bulletOutOfView(483, 100, scrolled, 16)).toBe(false);
    expect(bulletOutOfView(463, 100, scrolled, 16)).toBe(true);
  });
});
