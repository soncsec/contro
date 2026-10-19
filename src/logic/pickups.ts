/**
 * Weapon pickups (M4.1), as in Contra: a pod flies across the screen in a wave; shooting it
 * drops a letter that the marine collects by touching it. Pure, so it is unit tested.
 */

/** A bullet's velocity for each bullet of a shot, fanned `spreadDeg` apart around the aim. */
export function fanVelocities(
  base: { vx: number; vy: number },
  count: number,
  spreadDeg: number,
): { vx: number; vy: number }[] {
  const n = Math.max(1, Math.floor(count));
  const out: { vx: number; vy: number }[] = [];
  for (let i = 0; i < n; i++) {
    const angle = ((i - (n - 1) / 2) * spreadDeg * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    out.push({ vx: base.vx * cos - base.vy * sin, vy: base.vx * sin + base.vy * cos });
  }
  return out;
}

export interface PodTuning {
  /** Across the screen, px/s. */
  speed: number;
  /** Height of the wave either side of its line, px. */
  amplitude: number;
  /** One full wave, ms. */
  periodMs: number;
}

/** Where a pod is `ms` after it set off from (startX, lineY), flying `direction`. */
export function podPosition(
  start: { x: number; y: number },
  direction: -1 | 1,
  ms: number,
  t: PodTuning,
): { x: number; y: number } {
  const s = Math.max(0, ms) / 1000;
  return {
    x: start.x + direction * t.speed * s,
    y: start.y + t.amplitude * Math.sin((2 * Math.PI * Math.max(0, ms)) / t.periodMs),
  };
}

/** The weapon the marine holds after losing a life: back to the rifle (owner decision). */
export function weaponAfterDeath(): 'rifle' {
  return 'rifle';
}
