/**
 * Enemies that run in from the edge of the screen (M3.14, as in Contra). A map's spawner
 * waits until its point scrolls into view, then sends `count` enemies in from one side of the
 * screen, one every `everyMs`. Pure, so it is unit tested; the Enemies entity applies it.
 */
export interface Spawner {
  /** The point that starts it when it comes into view. */
  x: number;
  /** The spawner's own height (runners land on the ground where they appear instead). */
  y: number;
  enemy: string;
  count: number;
  everyMs: number;
  /** The screen edge they come from. */
  from: 'left' | 'right';
}

export interface SpawnerState {
  spawned: number;
  /** Time since the last one, or null before the spawner has started. */
  sinceMs: number | null;
}

export const initialSpawner = (): SpawnerState => ({ spawned: 0, sinceMs: null });

export interface SpawnOrder {
  x: number;
  y: number;
  enemy: string;
  /** -1 runs left (in from the right edge), 1 runs right. */
  direction: -1 | 1;
}

/**
 * One frame of a spawner. `view` is the camera's visible span in level pixels; enemies appear
 * `margin` px outside it so they run in rather than pop up, standing on `groundAt` there. Over
 * a pit (no ground) the next one waits until there is ground to land on.
 */
export function stepSpawner(
  prev: SpawnerState,
  spawner: Spawner,
  view: { left: number; right: number },
  dtMs: number,
  margin: number,
  groundAt: (x: number) => number | null,
): { state: SpawnerState; spawn: SpawnOrder | null } {
  if (prev.spawned >= spawner.count) return { state: prev, spawn: null };
  const inView = spawner.x >= view.left && spawner.x <= view.right;
  if (prev.sinceMs === null && !inView) return { state: prev, spawn: null };
  const since = prev.sinceMs === null ? spawner.everyMs : prev.sinceMs + Math.max(0, dtMs);
  if (since < spawner.everyMs) return { state: { ...prev, sinceMs: since }, spawn: null };
  const right = spawner.from === 'right';
  const x = right ? view.right + margin : view.left - margin;
  const ground = groundAt(x);
  if (ground === null) return { state: { ...prev, sinceMs: since }, spawn: null };
  return {
    state: { spawned: prev.spawned + 1, sinceMs: 0 },
    spawn: {
      x,
      y: ground,
      enemy: spawner.enemy,
      direction: right ? -1 : 1,
    },
  };
}

/**
 * A runner keeps running the way it was sent, turns around at a wall, and is removed once it
 * is `farPx` outside the view (it ran off or was left behind).
 */
export function stepRunner(direction: -1 | 1, blocked: { left: boolean; right: boolean }): -1 | 1 {
  if (direction < 0 && blocked.left) return 1;
  if (direction > 0 && blocked.right) return -1;
  return direction;
}

export function runnerGone(
  x: number,
  feetY: number,
  view: { left: number; right: number },
  farPx: number,
  mapHeight: number,
): boolean {
  return x < view.left - farPx || x > view.right + farPx || feetY > mapHeight + farPx;
}

/**
 * The top of the highest solid floor under x, or null over a pit or past the map's ends.
 * Catwalks don't count: a runner lands on solid ground.
 */
export function groundAt(
  colliders: readonly { x: number; y: number; width: number; type: string }[],
  x: number,
): number | null {
  let top: number | null = null;
  for (const c of colliders) {
    if (c.type !== 'solid' || x < c.x || x >= c.x + c.width) continue;
    if (top === null || c.y < top) top = c.y;
  }
  return top;
}
