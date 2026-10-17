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

  it('auto-fires every 160 ms while held', () => {
    // 60 frames of 16 ms = 960 ms held: shots at 0, then every 10 frames (160 ms).
    expect(play(initialWeapon(), Array(60).fill(true)).shots).toEqual([0, 10, 20, 30, 40, 50]);
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

  it('counts a quick release and re-press as a tap, not as holding', () => {
    // 6 frames held (96 ms since the shot), then a re-press within one frame.
    const held = play(initialWeapon(), Array(6).fill(true));
    expect(stepWeapon(held.state, true, false, FRAME, WEAPON).fired).toBe(false); // holding: needs 160 ms
    expect(stepWeapon(held.state, true, true, FRAME, WEAPON).fired).toBe(true); // tap: 90 ms is enough
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
