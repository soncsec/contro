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
  },
};
