/**
 * Enemy types that level maps may place (ARCHITECTURE.md ADR-C03).
 * Stats are added as each enemy is built (M1.6 onward).
 */
export const ENEMY_TYPES = ['alien-walker'] as const;
export type EnemyType = (typeof ENEMY_TYPES)[number];
