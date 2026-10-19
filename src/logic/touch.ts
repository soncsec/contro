/**
 * Phone touch controls (M3.11): the on-screen stick and buttons, as plain rules with unit
 * tests. The page elements live in src/systems/TouchControls.ts; they report presses as these
 * virtual key codes, which feed the same action layer as the keyboard (ADR-C07).
 */
import type { Bindings } from './input';
import type { WeaponTuning } from './weapon';

export const TOUCH_BINDINGS: Bindings = {
  left: ['TouchLeft'],
  right: ['TouchRight'],
  up: ['TouchUp'],
  down: ['TouchDown'],
  jump: ['TouchJump'],
  fire: ['TouchFire'],
  pause: ['TouchPause'],
};

export type StickDirection = 'left' | 'right' | 'up' | 'down';

/** cos 67.5°: past this share of the push, a direction counts, so the stick has 8 equal slices. */
const SLICE = Math.cos((67.5 * Math.PI) / 180);

/**
 * Which directions the stick is pushed, from the thumb's offset from its centre (screen
 * pixels, y down). Inside the dead zone (a share of the radius) it is not pushed at all.
 * Eight 45° slices: straight right is only right; up-right is both up and right.
 */
export function stickDirections(
  dx: number,
  dy: number,
  radius: number,
  deadzone: number,
): StickDirection[] {
  const length = Math.hypot(dx, dy);
  if (radius <= 0 || length < radius * deadzone) return [];
  const directions: StickDirection[] = [];
  if (dx > length * SLICE) directions.push('right');
  if (dx < -length * SLICE) directions.push('left');
  if (dy < -length * SLICE) directions.push('up');
  if (dy > length * SLICE) directions.push('down');
  return directions;
}

/** Where to draw the stick's knob: the thumb's offset, kept inside the stick's ring. */
export function knobOffset(dx: number, dy: number, maxDistance: number): { x: number; y: number } {
  const length = Math.hypot(dx, dy);
  if (length <= maxDistance || length === 0) return { x: dx, y: dy };
  const k = maxDistance / length;
  return { x: dx * k, y: dy * k };
}

/**
 * The weapon rules for this frame. Holding the on-screen FIRE button auto-fires every
 * `intervalMs` (M3.4, owner approved 2026-10-18): tapping a glass button fast is tiring.
 * Otherwise the weapon's own rules apply (the rifle fires once per press, issue #21).
 */
export function weaponForFrame<T extends WeaponTuning>(
  base: T,
  touchAutoFire: boolean,
  intervalMs: number,
): T {
  return touchAutoFire ? { ...base, autoFire: true, autoIntervalMs: intervalMs } : base;
}
