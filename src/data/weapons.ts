import type { WeaponTuning } from '../logic/weapon';

/**
 * The marine's weapons (M4.1; owner decision 2026-10-19). The rifle is what he starts with;
 * flying pods drop the others as letter pickups, as in Contra. A pickup lasts until he loses a
 * life. tests/unit/weapons.test.ts checks these numbers.
 */
export const WEAPON_TYPES = ['rifle', 'machine-gun', 'spread'] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];
export type PickupWeapon = Exclude<WeaponType, 'rifle'>;
export const PICKUP_WEAPONS: readonly PickupWeapon[] = ['machine-gun', 'spread'];

export interface WeaponStats extends WeaponTuning {
  /** Shown on the pickup and in the HUD. */
  letter: string;
  /** Bullets per shot: more than one fans out `spreadDeg` apart, centred on the aim. */
  bullets: number;
  spreadDeg: number;
  /** Damage of each bullet. */
  damage: number;
  /** Most of this weapon's bullets on screen at once. */
  maxBullets: number;
  /** HUD colour of the letter (the rifle shows none). */
  color: string;
  /** Image key of the pickup (none for the rifle). */
  pickup: string | null;
}

export const WEAPONS: Readonly<Record<WeaponType, WeaponStats>> = {
  // One shot per press (issue #21); taps as fast as every 90 ms.
  rifle: {
    letter: 'R',
    autoFire: false,
    autoIntervalMs: 160,
    tapMinMs: 90,
    bullets: 1,
    spreadDeg: 0,
    damage: 1,
    maxBullets: 8,
    color: '#e6eef7',
    pickup: null,
  },
  // Keeps firing while fire is held (issue #21).
  'machine-gun': {
    letter: 'M',
    autoFire: true,
    autoIntervalMs: 100,
    tapMinMs: 90,
    bullets: 1,
    spreadDeg: 0,
    damage: 1,
    maxBullets: 12,
    color: '#22c77f',
    pickup: 'pickup-machine-gun',
  },
  // Three bullets in a fan, one shot per press, a little slower to repeat.
  spread: {
    letter: 'S',
    autoFire: false,
    autoIntervalMs: 200,
    tapMinMs: 180,
    bullets: 3,
    spreadDeg: 15,
    damage: 1,
    maxBullets: 15,
    color: '#e0452f',
    pickup: 'pickup-spread',
  },
};

/** The bullet pool is as big as the largest weapon needs. */
export const MAX_BULLETS = Math.max(...WEAPON_TYPES.map((t) => WEAPONS[t].maxBullets));

/**
 * The blimp that carries a pickup (M4.1, art drawn by Claude: tools/art/blimp.py). It flies
 * across the screen in a slow wave; shooting it down drops its letter.
 */
export const BLIMP = {
  sheet: 'blimp',
  /** Flying left: the art drawn mirrored, with its number the right way round. */
  sheetLeft: 'blimp-left',
  frame: { width: 84, height: 40 },
  /** The hull, inside the frame (the gondola and fins don't count). */
  body: { width: 62, height: 24, offsetX: 14, offsetY: 3 },
  hp: 3,
  points: 500,
  pod: { speed: 36, amplitude: 6, periodMs: 3000 },
  /** It appears this far outside the view, and is gone once this far outside on the other side. */
  margin: 48,
} as const;

/** A dropped letter pops up, then falls to the ground (M4.1). */
export const PICKUP = {
  size: 20,
  /** Its collision box (the letter, not its padding). */
  body: { width: 16, height: 16 },
  popVy: -180,
} as const;
