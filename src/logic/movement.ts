/**
 * Player movement rules: running, jumping, coyote time, jump buffering and short hops.
 * Pure functions; the scene applies the result to the physics body and Phaser does gravity.
 */
export interface MovementTuning {
  runSpeed: number;
  jumpSpeed: number;
  coyoteMs: number;
  jumpBufferMs: number;
  jumpCutFactor: number;
  maxStepMs: number;
}

export interface MovementInput {
  /** -1 left, 0 none, 1 right. */
  direction: -1 | 0 | 1;
  /** Jump key held this frame. */
  jump: boolean;
  /** Jump key newly pressed since the last frame (from the input layer). */
  jumpPressed: boolean;
  /** Crouching: the marine stays put but can still turn (default false). */
  crouch?: boolean;
}

export interface BodyState {
  onFloor: boolean;
  /** Current vertical speed in px/s (negative = rising). */
  vy: number;
}

export interface MovementState {
  facing: 'left' | 'right';
  /** Time since the player was last on the floor (0 while on it). */
  airMs: number;
  /** Time since jump was pressed, or null if no press is waiting. */
  bufferedJumpMs: number | null;
  jumpHeld: boolean;
  /** True from take-off until landing, so coyote time can't give a second jump. */
  jumping: boolean;
}

export interface MovementResult {
  state: MovementState;
  vx: number;
  /** New vertical speed, or null to leave it to gravity. */
  vy: number | null;
  jumped: boolean;
}

export const initialMovement = (): MovementState => ({
  facing: 'right',
  airMs: 0,
  bufferedJumpMs: null,
  jumpHeld: false,
  jumping: false,
});

export function stepMovement(
  prev: MovementState,
  input: MovementInput,
  body: BodyState,
  dtMs: number,
  t: MovementTuning,
): MovementResult {
  const dt = Math.min(Math.max(dtMs, 0), t.maxStepMs);
  const facing = input.direction === 0 ? prev.facing : input.direction < 0 ? 'left' : 'right';
  const vx = input.crouch ? 0 : input.direction * t.runSpeed;

  const airMs = body.onFloor ? 0 : prev.airMs + dt;
  const jumping = prev.jumping && !(body.onFloor && body.vy >= 0);

  let bufferedJumpMs: number | null = input.jumpPressed
    ? 0
    : prev.bufferedJumpMs === null
      ? null
      : prev.bufferedJumpMs + dt;
  if (bufferedJumpMs !== null && bufferedJumpMs > t.jumpBufferMs) bufferedJumpMs = null;

  const canJump = !jumping && (body.onFloor || airMs <= t.coyoteMs);
  if (bufferedJumpMs !== null && canJump) {
    return {
      state: { facing, airMs, bufferedJumpMs: null, jumpHeld: input.jump, jumping: true },
      vx,
      vy: -t.jumpSpeed,
      jumped: true,
    };
  }

  // Short hop: letting go of jump while rising cuts the climb.
  const releasedNow = !input.jump && prev.jumpHeld;
  const vy = releasedNow && jumping && body.vy < 0 ? body.vy * t.jumpCutFactor : null;

  return {
    state: { facing, airMs, bufferedJumpMs, jumpHeld: input.jump, jumping },
    vx,
    vy,
    jumped: false,
  };
}
