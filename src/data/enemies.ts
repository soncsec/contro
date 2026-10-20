import type { BodyBox } from '../logic/body';
import type { BipedTuning } from '../logic/biped';
import type { FlyerTuning } from '../logic/flyer';

/**
 * Enemy types that level maps may place, and their stats (ARCHITECTURE.md ADR-C03).
 * tests/unit/enemies.test.ts checks every entry against the asset manifest.
 */
export const ENEMY_TYPES = [
  'alien-walker',
  'alien-flyer',
  'alien-runner',
  'bipedal-walker',
] as const;
export type EnemyType = (typeof ENEMY_TYPES)[number];

export interface EnemyStats {
  /**
   * Walkers patrol on the floor; flyers hover, shoot and dive (src/logic/flyer.ts); runners
   * run in from the edge of the screen and keep going (src/logic/spawner.ts, M3.14).
   */
  movement: 'walker' | 'flyer' | 'runner' | 'biped';
  /** Colour multiplied over the art, so one sheet can make a variant (M3.14). */
  tint?: number;
  /** Speeds up the walk animation, for an enemy faster than the art was drawn for. */
  animTimeScale?: number;
  /** Sprite sheet (asset key) for walking; its default animation is played. */
  walkSheet: string;
  frame: { width: number; height: number };
  /** Physics box inside the frame, measured from the art as drawn (see facesLeftInArt). */
  body: BodyBox;
  /** True if the art faces left, so the sprite is flipped when it walks right. */
  facesLeftInArt: boolean;
  /** Hits from the default rifle to destroy it. */
  hp: number;
  /** Walking speed in px/s. */
  speed: number;
  /** How far it walks either side of its spawn point before turning. */
  patrolRange: number;
  /** How long it waits before turning around. */
  turnPauseMs: number;
  /** One-shot effect played when it dies. */
  deathEffect: string;
  /** Damage to the marine on touch. */
  contactDamage: number;
  /** Score for destroying it. */
  points: number;
  /** Flyers only: hover, dive and shooting numbers. */
  flyer?: FlyerTuning;
  /** Bipeds only (M4.2): walking, aiming and the cannon. */
  biped?: BipedTuning & {
    /** Barrel tip [x, y] in the frame, facing right as drawn. */
    muzzle: readonly [number, number];
    shotSpeed: number;
  };
}

export const ENEMIES: Readonly<Record<EnemyType, EnemyStats>> = {
  'alien-walker': {
    movement: 'walker',
    walkSheet: 'alien-walker-walk',
    frame: { width: 57, height: 42 },
    // The body spans x 14–42 and rows 9–37 (top of the spikes to the feet) in every walk frame.
    body: { width: 28, height: 29, offsetX: 14, offsetY: 9 },
    facesLeftInArt: true,
    hp: 3,
    speed: 30,
    patrolRange: 48,
    turnPauseMs: 400,
    deathEffect: 'enemy-death',
    contactDamage: 1,
    points: 100,
  },
  'alien-flyer': {
    movement: 'flyer',
    walkSheet: 'alien-flyer',
    frame: { width: 83, height: 64 },
    // The insect's body (not the wings above it) spans x 24–53 and rows 26–55.
    body: { width: 30, height: 30, offsetX: 24, offsetY: 26 },
    facesLeftInArt: true,
    hp: 2,
    speed: 25,
    patrolRange: 64,
    turnPauseMs: 0,
    deathEffect: 'enemy-death',
    contactDamage: 1,
    points: 200,
    flyer: {
      driftSpeed: 25,
      patrolRange: 64,
      bobAmplitude: 6,
      bobPeriodMs: 1400,
      diveRangeX: 48,
      diveCooldownMs: 3500,
      windupMs: 450,
      diveSpeed: 150,
      maxDiveMs: 1500,
      riseSpeed: 70,
      fireRange: 220,
      fireCooldownMs: 2600,
      shotSpeed: 80,
    },
  },
  // M3.14: the walker's art, tinted red, running in from the screen's edge. Fragile and fast.
  'alien-runner': {
    movement: 'runner',
    walkSheet: 'alien-walker-walk',
    frame: { width: 57, height: 42 },
    body: { width: 28, height: 29, offsetX: 14, offsetY: 9 },
    facesLeftInArt: true,
    hp: 1,
    speed: 75,
    patrolRange: 0,
    turnPauseMs: 0,
    deathEffect: 'enemy-death',
    contactDamage: 1,
    points: 50,
    tint: 0xff8a7a,
    animTimeScale: 2.5,
  },
  // M4.2: the pack's bipedal unit (owner approved 2026-10-19). Walks at the marine, stops and
  // fires its cannon at head height (29 px above its feet: crouch or jump to dodge).
  'bipedal-walker': {
    movement: 'biped',
    walkSheet: 'bipedal-walk',
    frame: { width: 80, height: 64 },
    // The body and legs span x 15–58 and rows 10–63 (the barrel sticks out past x 58).
    body: { width: 40, height: 50, offsetX: 16, offsetY: 13 },
    facesLeftInArt: false,
    hp: 6,
    speed: 18,
    patrolRange: 0,
    turnPauseMs: 0,
    deathEffect: 'ground-explosion',
    contactDamage: 1,
    points: 400,
    biped: {
      speed: 18,
      sightRange: 260,
      keepDistance: 90,
      walkMs: 2400,
      aimMs: 600,
      muzzle: [61, 34],
      shotSpeed: 110,
    },
  },
};
