import type { BodyBox } from '../logic/body';
import type { BossTuning } from '../logic/boss';

/**
 * Bosses that level maps may place (ARCHITECTURE.md ADR-C03), with their phases and attacks.
 * tests/unit/bosses.test.ts checks every entry against the asset manifest and the rules.
 */
export const BOSS_TYPES = ['tank', 'mech'] as const;
export type BossType = (typeof BOSS_TYPES)[number];

export interface BossStats {
  /** Shown over its health bar. */
  name: string;
  /** Sprite sheet (asset key); its default animation plays while it drives. */
  sheet: string;
  frame: { width: number; height: number };
  /** Physics box inside the frame, as drawn (facing right). */
  body: BodyBox;
  /** True if the art faces left. The boss always faces the marine, on its left. */
  facesLeftInArt: boolean;
  /** Barrel tip and the mortar hatch, as [x, y] in the frame facing right. */
  muzzle: readonly [number, number];
  hatch: readonly [number, number];
  /** Where its body centre may drive, measured from the arena's left edge. */
  drive: { min: number; max: number };
  /** Where it waits before rolling in, past the arena's right edge. */
  startBeyond: number;
  tuning: BossTuning;
  /** The tank's cannon: a straight shot from the muzzle towards the marine's side. */
  cannon?: { shotSpeed: number };
  mortar?: {
    /** Time in the air; the landing spot is marked all that time. */
    flightMs: number;
    /** Lands up to this far either side of the marine (seeded RNG). */
    spread: number;
  };
  /** The mech's spread: `count` shots from the muzzle, aimed at the marine, fanned out. */
  spreadShot?: { shotSpeed: number; count: number; spreadDeg: number };
  /** A shot rolling along the floor, to jump over; `height` px above the feet. */
  shockwave?: { speed: number; height: number };
  /** The mech's leap onto the marine: time in the air and how high it rises. */
  leap?: { durationMs: number; height: number };
  contactDamage: number;
  points: number;
  /** Big explosions while it blows up, and the time between them. */
  explosions: { effect: string; everyMs: number };
}

export const BOSSES: Readonly<Record<BossType, BossStats>> = {
  // Level 1 (M3.3; design approved by the owner 2026-10-18): drives back and forth firing its
  // cannon at head height (crouch or jump); below half health it adds lobbed mortar shells.
  tank: {
    name: 'TANK',
    sheet: 'tank',
    frame: { width: 128, height: 64 },
    // Turret and hull span x 17–110 and rows 20–63 (the treads touch the bottom row).
    body: { width: 94, height: 44, offsetX: 17, offsetY: 20 },
    facesLeftInArt: false,
    // The barrel ends at x 109, rows 28–32; the turret's hatch is near its top.
    muzzle: [109, 31],
    hatch: [40, 10],
    drive: { min: 176, max: 256 },
    startBeyond: 80,
    tuning: {
      // About 20 s of steady fire, more with dodging; to be tuned once the owner plays it.
      hp: 100,
      introSpeed: 60,
      phases: [
        {
          fromHpShare: 1,
          driveSpeed: 20,
          attacks: [{ kind: 'cannon', cooldownMs: 2200, firstDelayMs: 900 }],
        },
        {
          fromHpShare: 0.5,
          driveSpeed: 32,
          attacks: [
            { kind: 'cannon', cooldownMs: 1500, firstDelayMs: 600 },
            { kind: 'mortar', cooldownMs: 2600, firstDelayMs: 1200 },
          ],
        },
      ],
      dyingMs: 2400,
    },
    cannon: { shotSpeed: 110 },
    // 0.9 s keeps the shell's arc on screen (it peaks about 66 px above the hatch).
    mortar: { flightMs: 900, spread: 24 },
    contactDamage: 1,
    points: 5000,
    explosions: { effect: 'ground-explosion', everyMs: 300 },
  },
  // Level 2 (M4.4; design approved by the owner 2026-10-19): stomps back and forth firing a
  // 3-shot spread from its chest light, with a ground shockwave each time it turns; below half
  // health it is faster and leaps onto the marine (the landing marked), a shockwave both ways.
  mech: {
    name: 'MECH',
    sheet: 'mech',
    frame: { width: 96, height: 80 },
    // The legs, body and arms span x 20–66 and rows 16–79 (its feet touch the bottom row).
    body: { width: 40, height: 58, offsetX: 24, offsetY: 21 },
    facesLeftInArt: false,
    // The chest light (the spread comes from here) and the head.
    muzzle: [47, 36],
    hatch: [47, 24],
    drive: { min: 150, max: 270 },
    startBeyond: 70,
    tuning: {
      // Eased a little after the owner's first play ("very hard but fun", 2026-10-20): it is
      // the middle boss, so Level 3's boss stays the hardest. Was 150 hits, spread 1.4 s and
      // leap 3.2 s in the second half.
      hp: 120,
      introSpeed: 40,
      phases: [
        {
          fromHpShare: 1,
          driveSpeed: 24,
          shockwaveOnTurn: true,
          attacks: [{ kind: 'spread', cooldownMs: 1800, firstDelayMs: 800 }],
        },
        {
          fromHpShare: 0.5,
          driveSpeed: 36,
          shockwaveOnTurn: true,
          attacks: [
            { kind: 'spread', cooldownMs: 1700, firstDelayMs: 600 },
            { kind: 'leap', cooldownMs: 4000, firstDelayMs: 1500 },
          ],
        },
      ],
      dyingMs: 2600,
    },
    spreadShot: { shotSpeed: 100, count: 3, spreadDeg: 15 },
    // Low enough to jump over, high enough to hit a standing or crouching marine.
    shockwave: { speed: 120, height: 5 },
    leap: { durationMs: 1000, height: 60 },
    contactDamage: 1,
    points: 8000,
    explosions: { effect: 'ground-explosion', everyMs: 300 },
  },
};
