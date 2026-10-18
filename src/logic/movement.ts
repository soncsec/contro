/**
 * Player movement rules: running, jumping, coyote time, jump buffering, short hops and the
 * double jump. Pure functions; the scene applies the result to the physics body and Phaser
 * does gravity.
 */
export interface MovementTuning {
  runSpeed: number;
  jumpSpeed: number;
  coyoteMs: number;
  jumpBufferMs: number;
  jumpCutFactor: number;
  maxStepMs: number;
  /** Jumps allowed in mid-air before landing again (double jump), and their launch speed. */
  airJumps: number;
  airJumpSpeed: number;
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
  /** Standing on a one-way platform (a catwalk) rather than solid ground (default false). */
  onPlatform?: boolean;
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
  /** Mid-air jumps left before landing (double jump). */
  airJumpsLeft: number;
}

export interface MovementResult {
  state: MovementState;
  vx: number;
  /** New vertical speed, or null to leave it to gravity. */
  vy: number | null;
  jumped: boolean;
  /** This jump was a mid-air (double) jump. */
  airJumped: boolean;
  /** Down + jump on a catwalk: drop through it instead of jumping (as in Contra). */
  dropped: boolean;
}

export const initialMovement = (airJumps = 1): MovementState => ({
  facing: 'right',
  airMs: 0,
  bufferedJumpMs: null,
  jumpHeld: false,
  jumping: false,
  airJumpsLeft: airJumps,
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
  const landed = body.onFloor && body.vy >= 0;
  const airJumpsLeft = landed ? t.airJumps : prev.airJumpsLeft;

  let bufferedJumpMs: number | null = input.jumpPressed
    ? 0
    : prev.bufferedJumpMs === null
      ? null
      : prev.bufferedJumpMs + dt;
  if (bufferedJumpMs !== null && bufferedJumpMs > t.jumpBufferMs) bufferedJumpMs = null;

  // Down + jump while crouched on a catwalk drops through it instead of jumping.
  if (input.jumpPressed && input.crouch && input.onPlatform && body.onFloor) {
    return {
      state: { facing, airMs, bufferedJumpMs: null, jumpHeld: input.jump, jumping, airJumpsLeft },
      vx,
      vy: null,
      jumped: false,
      airJumped: false,
      dropped: true,
    };
  }

  const canJump = !jumping && (body.onFloor || airMs <= t.coyoteMs);
  if (bufferedJumpMs !== null && canJump) {
    return {
      state: {
        facing,
        airMs,
        bufferedJumpMs: null,
        jumpHeld: input.jump,
        jumping: true,
        airJumpsLeft,
      },
      vx,
      vy: -t.jumpSpeed,
      jumped: true,
      airJumped: false,
      dropped: false,
    };
  }

  // Double jump: a new press in mid-air (past coyote time) uses an air jump if one is left.
  if (input.jumpPressed && !body.onFloor && airJumpsLeft > 0) {
    return {
      state: {
        facing,
        airMs,
        bufferedJumpMs: null,
        jumpHeld: input.jump,
        jumping: true,
        airJumpsLeft: airJumpsLeft - 1,
      },
      vx,
      vy: -t.airJumpSpeed,
      jumped: true,
      airJumped: true,
      dropped: false,
    };
  }

  // Short hop: letting go of jump while rising cuts the climb.
  const releasedNow = !input.jump && prev.jumpHeld;
  const vy = releasedNow && jumping && body.vy < 0 ? body.vy * t.jumpCutFactor : null;

  return {
    state: { facing, airMs, bufferedJumpMs, jumpHeld: input.jump, jumping, airJumpsLeft },
    vx,
    vy,
    jumped: false,
    airJumped: false,
    dropped: false,
  };
}
