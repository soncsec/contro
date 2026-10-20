/**
 * Player health rules: hits, invulnerability, death, lives and respawning.
 * Pure functions; the Player entity and level scene apply the results.
 */
export interface HealthTuning {
  maxHp: number;
  lives: number;
  invulnerableMs: number;
  hitStunMs: number;
  respawnDelayMs: number;
}

export interface HealthState {
  hp: number;
  /** Lives left, including the current one. */
  lives: number;
  /** Time left during which hits are ignored. */
  invulnerableMs: number;
  /** Time left during which controls are ignored after a hit. */
  stunMs: number;
  /** Time since death, or null while alive. */
  deadMs: number | null;
}

export const initialHealth = (t: HealthTuning): HealthState => ({
  hp: t.maxHp,
  lives: t.lives,
  invulnerableMs: 0,
  stunMs: 0,
  deadMs: null,
});

export type HitResult = 'ignored' | 'hurt' | 'died';

/** Applies a hit. Hits while invulnerable or dead are ignored. */
export function takeHit(
  s: HealthState,
  damage: number,
  t: HealthTuning,
): { state: HealthState; result: HitResult } {
  if (s.deadMs !== null || s.invulnerableMs > 0 || damage <= 0)
    return { state: s, result: 'ignored' };
  const hp = Math.max(0, s.hp - damage);
  if (hp === 0) {
    return { state: { ...s, hp, invulnerableMs: 0, stunMs: 0, deadMs: 0 }, result: 'died' };
  }
  return {
    state: { ...s, hp, invulnerableMs: t.invulnerableMs, stunMs: t.hitStunMs },
    result: 'hurt',
  };
}

export type StepEvent = 'none' | 'respawn' | 'game-over';

/**
 * Advances timers. Once the respawn delay has passed after a death, returns 'respawn'
 * (a life is used; full health, invulnerable) or 'game-over' if no lives are left.
 */
export function stepHealth(
  s: HealthState,
  dtMs: number,
  t: HealthTuning,
): { state: HealthState; event: StepEvent } {
  const dt = Math.max(0, dtMs);
  if (s.deadMs === null) {
    return {
      state: {
        ...s,
        invulnerableMs: Math.max(0, s.invulnerableMs - dt),
        stunMs: Math.max(0, s.stunMs - dt),
      },
      event: 'none',
    };
  }
  const deadMs = s.deadMs + dt;
  if (deadMs < t.respawnDelayMs) return { state: { ...s, deadMs }, event: 'none' };
  const lives = s.lives - 1;
  if (lives <= 0) return { state: { ...s, deadMs, lives: 0 }, event: 'game-over' };
  return {
    state: { hp: t.maxHp, lives, invulnerableMs: t.invulnerableMs, stunMs: 0, deadMs: null },
    event: 'respawn',
  };
}

/** Whether the sprite is drawn this frame while invulnerable (blinking). */
export function visibleWhileInvulnerable(invulnerableMs: number, blinkMs: number): boolean {
  if (invulnerableMs <= 0) return true;
  return Math.floor(invulnerableMs / blinkMs) % 2 === 0;
}

/**
 * Where to respawn: the furthest checkpoint the player has passed, or the start.
 * `reachedX` is the furthest x the player has reached so far.
 */
export function respawnPoint<P extends { x: number }>(
  start: P,
  checkpoints: readonly P[],
  reachedX: number,
): P {
  return checkpoints
    .filter((c) => c.x <= reachedX)
    .reduce((best, c) => (c.x > best.x ? c : best), start);
}

/** Falling into a pit: always fatal, even while invulnerable. Ignored if already dead. */
export function fallDeath(s: HealthState): HealthState {
  if (s.deadMs !== null) return s;
  return { ...s, hp: 0, invulnerableMs: 0, stunMs: 0, deadMs: 0 };
}

/** A health pickup (M4.1): back to full health. Lives and timers are unchanged. */
export function restoreHealth(s: HealthState, t: HealthTuning): HealthState {
  return s.deadMs === null ? { ...s, hp: t.maxHp } : s;
}
