/**
 * Enemy rules: patrolling back and forth around a spawn point, and taking damage.
 * Pure functions; the Enemies entity applies them to arcade bodies.
 */
export interface PatrolTuning {
  speed: number;
  patrolRange: number;
  turnPauseMs: number;
}

export interface PatrolState {
  direction: -1 | 1;
  /** Time left standing still before walking the other way (0 = walking). */
  pauseMs: number;
}

/** Enemies start walking towards the player's usual side: left. */
export const initialPatrol = (): PatrolState => ({ direction: -1, pauseMs: 0 });

/**
 * One frame of patrolling. `blocked` says whether a wall stops the enemy on each side.
 * Returns the new state and the horizontal speed to apply.
 */
export function stepPatrol(
  prev: PatrolState,
  x: number,
  originX: number,
  blocked: { left: boolean; right: boolean },
  dtMs: number,
  t: PatrolTuning,
): { state: PatrolState; vx: number } {
  const dt = Math.max(dtMs, 0);
  if (prev.pauseMs > 0) {
    const pauseMs = Math.max(0, prev.pauseMs - dt);
    if (pauseMs > 0) return { state: { ...prev, pauseMs }, vx: 0 };
    // Pause over: walk the other way.
    const direction = prev.direction === 1 ? -1 : 1;
    return { state: { direction, pauseMs: 0 }, vx: direction * t.speed };
  }
  const atEnd =
    prev.direction === 1
      ? x >= originX + t.patrolRange || blocked.right
      : x <= originX - t.patrolRange || blocked.left;
  if (atEnd) return { state: { ...prev, pauseMs: t.turnPauseMs }, vx: 0 };
  return { state: prev, vx: prev.direction * t.speed };
}

/** Applies damage. Hit points never go below zero. */
export function applyDamage(hp: number, damage: number): { hp: number; dead: boolean } {
  const left = Math.max(0, hp - Math.max(0, damage));
  return { hp: left, dead: left === 0 };
}
