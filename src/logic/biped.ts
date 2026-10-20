/**
 * The bipedal walker (M4.2, owner approved 2026-10-19): it walks towards the marine once it can
 * see him, stops, and fires its cannon at head height (crouch or jump to dodge, like the tank),
 * then walks on. Pure, so it is unit tested; the Enemies entity applies it.
 */
export interface BipedTuning {
  /** px/s while walking. */
  speed: number;
  /** It notices the marine this close (px, either side). */
  sightRange: number;
  /** It doesn't walk closer than this. */
  keepDistance: number;
  /** Walks this long between shots. */
  walkMs: number;
  /** Stands still this long, aiming, before each shot (the warning). */
  aimMs: number;
}

export interface BipedState {
  mode: 'idle' | 'walk' | 'aim';
  /** Time in the current mode. */
  ms: number;
  direction: -1 | 1;
}

export const initialBiped = (): BipedState => ({ mode: 'idle', ms: 0, direction: -1 });

/** One frame. `playerX` is null when it can't see him (dead, or the GHOUL cheat). */
export function stepBiped(
  prev: BipedState,
  x: number,
  playerX: number | null,
  blocked: { left: boolean; right: boolean },
  dtMs: number,
  t: BipedTuning,
): { state: BipedState; vx: number; fire: boolean } {
  const dt = Math.max(0, dtMs);
  const sees = playerX !== null && Math.abs(playerX - x) <= t.sightRange;
  if (!sees) return { state: { ...prev, mode: 'idle', ms: 0 }, vx: 0, fire: false };
  const direction: -1 | 1 = (playerX as number) < x ? -1 : 1;
  if (prev.mode === 'aim') {
    const ms = prev.ms + dt;
    if (ms < t.aimMs) return { state: { mode: 'aim', ms, direction }, vx: 0, fire: false };
    return { state: { mode: 'walk', ms: 0, direction }, vx: 0, fire: true };
  }
  // Seeing him for the first time counts as having walked: it stops to aim straight away.
  const ms = prev.mode === 'idle' ? t.walkMs : prev.ms + dt;
  if (ms >= t.walkMs) return { state: { mode: 'aim', ms: 0, direction }, vx: 0, fire: false };
  const close = Math.abs((playerX as number) - x) <= t.keepDistance;
  const wall = direction < 0 ? blocked.left : blocked.right;
  const vx = close || wall ? 0 : direction * t.speed;
  return { state: { mode: 'walk', ms, direction }, vx, fire: false };
}
