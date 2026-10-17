import type { BodyBox } from '../logic/body';

/**
 * Enemy types that level maps may place, and their stats (ARCHITECTURE.md ADR-C03).
 * tests/unit/enemies.test.ts checks every entry against the asset manifest.
 */
export const ENEMY_TYPES = ['alien-walker'] as const;
export type EnemyType = (typeof ENEMY_TYPES)[number];

export interface EnemyStats {
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
}

export const ENEMIES: Readonly<Record<EnemyType, EnemyStats>> = {
  'alien-walker': {
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
  },
};
