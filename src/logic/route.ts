/**
 * Can the marine get through a map along the ground? A data check for level design (M3.1):
 * every pit must be jumpable and every step up reachable with the real jump numbers.
 * One-way walkways are optional routes, so only solid ground is checked. Pure, unit tested.
 */
import type { Rect } from './levelMap';

export interface JumpReach {
  /** Widest pit (px) a running jump clears, with a safety margin. */
  maxGap: number;
  /** Highest step up (px) a jump plus double jump reaches, with a safety margin. */
  maxStep: number;
}

/** Fraction of the ideal jump a level may ask for, so a jump never needs to be perfect. */
export const SAFETY = 0.85;

export function jumpReach(m: {
  runSpeed: number;
  jumpSpeed: number;
  airJumpSpeed: number;
  airJumps: number;
  gravity: number;
}): JumpReach {
  const rise = (v: number) => (v * v) / (2 * m.gravity);
  const airTime = (2 * m.jumpSpeed) / m.gravity;
  const height = rise(m.jumpSpeed) + (m.airJumps > 0 ? rise(m.airJumpSpeed) : 0);
  return { maxGap: m.runSpeed * airTime * SAFETY, maxStep: height * SAFETY };
}

/** Problems along the ground from left to right; empty means the way through is clear. */
export function routeProblems(
  colliders: readonly (Rect & { type: string })[],
  reach: JumpReach,
): string[] {
  const ground = colliders.filter((c) => c.type === 'solid').sort((a, b) => a.x - b.x);
  const problems: string[] = [];
  for (let i = 1; i < ground.length; i++) {
    const a = ground[i - 1];
    const b = ground[i];
    if (!a || !b) continue;
    const gap = b.x - (a.x + a.width);
    const step = a.y - b.y;
    if (gap > reach.maxGap) {
      problems.push(
        `pit at x ${a.x + a.width} is ${gap} px wide (max ${Math.floor(reach.maxGap)})`,
      );
    }
    if (step > reach.maxStep) {
      problems.push(`step up at x ${b.x} is ${step} px high (max ${Math.floor(reach.maxStep)})`);
    }
  }
  return problems;
}
