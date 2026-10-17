/**
 * Stance and aim rules (M2.2): crouching, aiming diagonally up, and which animation shows them.
 * The marine aims forward or 45° up in the direction he faces (PROJECT.md: no straight-up aim).
 */
export type Aim = 'forward' | 'diagonal';

export interface Stance {
  crouching: boolean;
  aim: Aim;
}

/**
 * Crouch with down while on the floor (down wins over up). Aim diagonally with up when not
 * crouching, including in the air.
 */
export function stanceFor(held: { up: boolean; down: boolean }, onFloor: boolean): Stance {
  const crouching = held.down && onFloor;
  return { crouching, aim: held.up && !crouching ? 'diagonal' : 'forward' };
}

export type MarineAnim =
  | 'idle'
  | 'run'
  | 'jump'
  | 'shoot'
  | 'crouch'
  | 'crouch-shoot'
  | 'aim-diag'
  | 'shoot-diag'
  | 'run-diag';

/** Which animation shows the marine's state this frame. */
export function marineAnim(
  onFloor: boolean,
  vx: number,
  firing: boolean,
  stance: Stance,
): MarineAnim {
  if (!onFloor) return 'jump';
  if (stance.crouching) return firing ? 'crouch-shoot' : 'crouch';
  const diagonal = stance.aim === 'diagonal';
  if (vx !== 0) return diagonal ? 'run-diag' : 'run';
  if (diagonal) return firing ? 'shoot-diag' : 'aim-diag';
  return firing ? 'shoot' : 'idle';
}

/** Bullet velocity for a shot facing `direction` with the given aim. */
export function shotVelocity(
  direction: -1 | 1,
  aim: Aim,
  speed: number,
): { vx: number; vy: number } {
  if (aim === 'forward') return { vx: direction * speed, vy: 0 };
  const d = speed * Math.SQRT1_2;
  return { vx: direction * d, vy: -d };
}
