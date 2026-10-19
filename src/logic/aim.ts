/**
 * Stance and aim rules (M2.2, M3.13): crouching, aiming 45° up or down, and which animation
 * shows them. The marine aims forward, 45° up or 45° down in the direction he faces
 * (PROJECT.md: no straight-up or straight-down aim).
 */
export type Aim = 'forward' | 'diagonal' | 'down';

export interface Stance {
  crouching: boolean;
  aim: Aim;
}

/** The directions held this frame (left and right default to not held). */
export interface AimInput {
  up: boolean;
  down: boolean;
  left?: boolean;
  right?: boolean;
}

/**
 * Down alone crouches on the floor. Down with left or right runs and aims 45° down (M3.13,
 * owner request), on the floor or in the air; down wins over up. Up aims 45° up when not
 * crouching, including in the air.
 */
export function stanceFor(held: AimInput, onFloor: boolean): Stance {
  const moving = (held.left === true) !== (held.right === true);
  if (held.down && moving) return { crouching: false, aim: 'down' };
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
  | 'run-diag'
  | 'run-down';

/** Which animation shows the marine's state this frame. */
export function marineAnim(
  onFloor: boolean,
  vx: number,
  firing: boolean,
  stance: Stance,
): MarineAnim {
  if (!onFloor) return 'jump';
  if (stance.crouching) return firing ? 'crouch-shoot' : 'crouch';
  if (stance.aim === 'down') return 'run-down';
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
  return { vx: direction * d, vy: aim === 'down' ? d : -d };
}
