/**
 * The spitting snake (M5.1, owner chose it for Level 3 on 2026-10-20): it sits still on a ledge
 * like a turret. Once it sees the marine it rears back (the warning), then spits a glob aimed
 * at him, and rests before the next one. Pure, so it is unit tested; the Enemies entity applies
 * it.
 */
import type { Point } from './flyer';

export interface SnakeTuning {
  /** It notices the marine this close (px, either side). */
  sightRange: number;
  /** It rears back this long before each spit (the warning). */
  windupMs: number;
  /** It rests this long after a spit. */
  restMs: number;
  /** Speed of the glob, px/s. */
  shotSpeed: number;
}

export interface SnakeState {
  mode: 'idle' | 'windup' | 'rest';
  /** Time in the current mode. */
  ms: number;
  /** Facing: -1 left, 1 right. */
  direction: -1 | 1;
}

export const initialSnake = (): SnakeState => ({ mode: 'idle', ms: 0, direction: -1 });

/**
 * One frame. `mouth` is where the glob leaves from; `player` is the marine's body centre, or
 * null when it can't see him (dead, or the GHOUL cheat). `spit` is the glob's velocity on the
 * frame it spits.
 */
export function stepSnake(
  prev: SnakeState,
  mouth: Point,
  player: Point | null,
  dtMs: number,
  t: SnakeTuning,
): { state: SnakeState; spit: { vx: number; vy: number } | null } {
  const dt = Math.max(0, dtMs);
  const sees = player !== null && Math.abs(player.x - mouth.x) <= t.sightRange;
  const direction: -1 | 1 = sees ? (player.x < mouth.x ? -1 : 1) : prev.direction;
  if (prev.mode === 'rest') {
    const ms = prev.ms + dt;
    if (ms < t.restMs) return { state: { mode: 'rest', ms, direction }, spit: null };
    return { state: { mode: sees ? 'windup' : 'idle', ms: 0, direction }, spit: null };
  }
  if (!sees) return { state: { mode: 'idle', ms: 0, direction }, spit: null };
  if (prev.mode === 'idle') return { state: { mode: 'windup', ms: 0, direction }, spit: null };
  const ms = prev.ms + dt;
  if (ms < t.windupMs) return { state: { mode: 'windup', ms, direction }, spit: null };
  return { state: { mode: 'rest', ms: 0, direction }, spit: aim(mouth, player, t.shotSpeed) };
}

/** Velocity from `from` towards `to` at `speed`; straight ahead if they are on top of each other. */
export function aim(from: Point, to: Point, speed: number): { vx: number; vy: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d === 0) return { vx: speed, vy: 0 };
  return { vx: (dx / d) * speed, vy: (dy / d) * speed };
}
