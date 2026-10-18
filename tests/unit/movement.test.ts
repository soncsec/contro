import { describe, expect, it } from 'vitest';
import { MOVEMENT } from '../../src/config/tuning';
import {
  initialMovement,
  stepMovement,
  type MovementInput,
  type MovementState,
} from '../../src/logic/movement';

const FRAME = 16;
const ground = { onFloor: true, vy: 0 };
const air = (vy = 0) => ({ onFloor: false, vy });
const none: MovementInput = { direction: 0, jump: false, jumpPressed: false };
/** Jump newly pressed this frame. */
const jump: MovementInput = { direction: 0, jump: true, jumpPressed: true };
/** Jump still held from an earlier frame. */
const held: MovementInput = { direction: 0, jump: true, jumpPressed: false };
const move = (direction: -1 | 1): MovementInput => ({ direction, jump: false, jumpPressed: false });

/** Runs several frames with the same input and body, returning the last result. */
function run(state: MovementState, input: MovementInput, body: typeof ground, frames: number) {
  let r = stepMovement(state, input, body, FRAME, MOVEMENT);
  for (let i = 1; i < frames; i++) r = stepMovement(r.state, input, body, FRAME, MOVEMENT);
  return r;
}

describe('running', () => {
  it('goes full speed at once and stops at once', () => {
    const s = initialMovement();
    expect(stepMovement(s, move(1), ground, FRAME, MOVEMENT).vx).toBe(90);
    expect(stepMovement(s, move(-1), ground, FRAME, MOVEMENT).vx).toBe(-90);
    expect(stepMovement(s, none, ground, FRAME, MOVEMENT).vx).toBe(0);
  });

  it('faces the last direction moved', () => {
    const left = stepMovement(initialMovement(), move(-1), ground, FRAME, MOVEMENT);
    expect(left.state.facing).toBe('left');
    expect(stepMovement(left.state, none, ground, FRAME, MOVEMENT).state.facing).toBe('left');
    expect(initialMovement().facing).toBe('right');
  });

  it('steers in the air the same as on the ground', () => {
    expect(stepMovement(initialMovement(), move(1), air(), FRAME, MOVEMENT).vx).toBe(90);
  });
});

describe('jumping', () => {
  it('jumps when pressed on the floor', () => {
    const r = stepMovement(initialMovement(), jump, ground, FRAME, MOVEMENT);
    expect(r.jumped).toBe(true);
    expect(r.vy).toBe(-300);
    expect(r.state.jumping).toBe(true);
  });

  it('needs a new press: holding jump does not bounce', () => {
    const first = stepMovement(initialMovement(), jump, ground, FRAME, MOVEMENT);
    const landed = { ...first.state, jumping: false };
    expect(stepMovement(landed, held, ground, FRAME, MOVEMENT).jumped).toBe(false);
  });

  it('jumps again on a new press even if jump never looked released between frames', () => {
    // The input layer reports a release and re-press within one frame as a new press.
    const first = stepMovement(initialMovement(), jump, ground, FRAME, MOVEMENT);
    const landed = { ...first.state, jumping: false };
    expect(stepMovement(landed, jump, ground, FRAME, MOVEMENT).jumped).toBe(true);
  });

  it('allows a jump shortly after running off a ledge (coyote time)', () => {
    // 4 frames in the air, then jump on the 5th: 80 ms, inside the 90 ms window.
    const falling = run(initialMovement(), none, air(), 4);
    expect(falling.state.airMs).toBe(64);
    expect(stepMovement(falling.state, jump, air(20), FRAME, MOVEMENT).jumped).toBe(true);
  });

  it('refuses a ground jump after coyote time runs out', () => {
    // 5 frames in the air, then jump on the 6th: 96 ms, just past the window.
    const falling = run({ ...initialMovement(), airJumpsLeft: 0 }, none, air(), 5);
    expect(stepMovement(falling.state, jump, air(20), FRAME, MOVEMENT).jumped).toBe(false);
    // With the double jump still available, the press uses it instead (at the lower speed).
    const fresh = run(initialMovement(), none, air(), 5);
    const r = stepMovement(fresh.state, jump, air(20), FRAME, MOVEMENT);
    expect(r).toMatchObject({ airJumped: true, vy: -MOVEMENT.airJumpSpeed });
  });

  it('gives no second ground jump in the air during coyote time', () => {
    const up = stepMovement(initialMovement(), jump, ground, FRAME, MOVEMENT);
    const rising = stepMovement(up.state, none, air(-250), FRAME, MOVEMENT);
    // Air jump used up: a press while rising does nothing.
    const used = { ...rising.state, airJumpsLeft: 0 };
    expect(stepMovement(used, jump, air(-230), FRAME, MOVEMENT).jumped).toBe(false);
    // Air jump available: the press is the double jump, not a second full-height ground jump.
    expect(stepMovement(rising.state, jump, air(-230), FRAME, MOVEMENT)).toMatchObject({
      airJumped: true,
      vy: -MOVEMENT.airJumpSpeed,
    });
    // Holding jump through the take-off gives no second jump of either kind.
    expect(stepMovement(up.state, held, air(-280), FRAME, MOVEMENT).jumped).toBe(false);
  });

  it('remembers a press just before landing (jump buffer), once the air jump is used', () => {
    const pressed = stepMovement(
      { ...initialMovement(), airMs: 500, airJumpsLeft: 0 },
      jump,
      air(200),
      FRAME,
      MOVEMENT,
    );
    expect(pressed.jumped).toBe(false);
    const stillFalling = run(pressed.state, held, air(200), 5); // 96 ms after the press
    expect(stillFalling.jumped).toBe(false);
    expect(stepMovement(stillFalling.state, held, ground, FRAME, MOVEMENT).jumped).toBe(true);
  });

  it('forgets a press made too long before landing', () => {
    const pressed = stepMovement(
      { ...initialMovement(), airMs: 500, airJumpsLeft: 0 },
      jump,
      air(200),
      FRAME,
      MOVEMENT,
    );
    const later = run(pressed.state, none, air(200), 8); // 128 ms
    expect(later.state.bufferedJumpMs).toBeNull();
    expect(stepMovement(later.state, none, ground, FRAME, MOVEMENT).jumped).toBe(false);
  });

  it('cuts the climb when jump is released while rising (short hop)', () => {
    const up = stepMovement(initialMovement(), jump, ground, FRAME, MOVEMENT);
    const released = stepMovement(up.state, none, air(-280), FRAME, MOVEMENT);
    expect(released.vy).toBe(-140);
  });

  it('leaves falling speed alone when jump is released', () => {
    const up = stepMovement(initialMovement(), jump, ground, FRAME, MOVEMENT);
    expect(stepMovement(up.state, none, air(50), FRAME, MOVEMENT).vy).toBeNull();
  });

  it('ends the jump on landing', () => {
    const up = stepMovement(initialMovement(), jump, ground, FRAME, MOVEMENT);
    // The take-off frame can still report the floor while moving up: still jumping.
    expect(
      stepMovement(up.state, held, { onFloor: true, vy: -300 }, FRAME, MOVEMENT).state.jumping,
    ).toBe(true);
    expect(stepMovement(up.state, held, ground, FRAME, MOVEMENT).state.jumping).toBe(false);
  });

  it('caps long frame steps so a stall cannot skip coyote time checks', () => {
    const r = stepMovement(initialMovement(), none, air(), 1000, MOVEMENT);
    expect(r.state.airMs).toBe(50);
    expect(stepMovement(initialMovement(), none, air(), -5, MOVEMENT).state.airMs).toBe(0);
  });
});

describe('double jump', () => {
  it('a press in mid-air jumps again, lower than a ground jump', () => {
    const up = stepMovement(initialMovement(), jump, ground, FRAME, MOVEMENT);
    expect(up.airJumped).toBe(false);
    const rising = stepMovement(up.state, none, air(-200), FRAME, MOVEMENT);
    const again = stepMovement(rising.state, jump, air(-150), FRAME, MOVEMENT);
    expect(again).toMatchObject({ jumped: true, airJumped: true, vy: -251 });
    expect(again.state).toMatchObject({ airJumpsLeft: 0, jumping: true });
    // 251² / (2 × 900) = 35 px: about 70% of the 50 px ground jump.
    expect(MOVEMENT.airJumpSpeed ** 2 / 1800).toBeCloseTo(35, 0);
  });

  it('only once before landing', () => {
    const used = { ...initialMovement(), airMs: 300, jumping: true, airJumpsLeft: 0 };
    expect(stepMovement(used, jump, air(50), FRAME, MOVEMENT).jumped).toBe(false);
  });

  it('is restored on landing', () => {
    const used = { ...initialMovement(), airMs: 300, jumping: true, airJumpsLeft: 0 };
    const landed = stepMovement(used, none, ground, FRAME, MOVEMENT);
    expect(landed.state.airJumpsLeft).toBe(1);
  });

  it('is not restored while still rising off the floor (take-off frame)', () => {
    const used = { ...initialMovement(), jumping: true, airJumpsLeft: 0 };
    const r = stepMovement(used, none, { onFloor: true, vy: -251 }, FRAME, MOVEMENT);
    expect(r.state.airJumpsLeft).toBe(0);
  });

  it('works after walking off a ledge, once coyote time has passed', () => {
    const falling = run(initialMovement(), none, air(), 10); // 160 ms off the ledge
    expect(stepMovement(falling.state, jump, air(60), FRAME, MOVEMENT).airJumped).toBe(true);
  });

  it('letting go early cuts the double jump short too', () => {
    const up = stepMovement(initialMovement(), jump, ground, FRAME, MOVEMENT);
    const again = stepMovement(up.state, jump, air(-100), FRAME, MOVEMENT);
    const released = stepMovement(again.state, none, air(-240), FRAME, MOVEMENT);
    expect(released.vy).toBe(-120);
  });

  it('can be switched off with airJumps: 0', () => {
    const noDouble = { ...MOVEMENT, airJumps: 0 };
    const up = stepMovement(initialMovement(0), jump, ground, FRAME, noDouble);
    expect(stepMovement(up.state, jump, air(-100), FRAME, noDouble).jumped).toBe(false);
  });
});

describe('dropping through a catwalk', () => {
  const downJump: MovementInput = { ...jump, crouch: true, onPlatform: true };

  it('down + jump on a catwalk drops instead of jumping', () => {
    const r = stepMovement(initialMovement(), downJump, ground, FRAME, MOVEMENT);
    expect(r.dropped).toBe(true);
    expect(r.jumped).toBe(false);
    expect(r.vy).toBeNull();
  });

  it('down + jump on solid ground is a normal jump', () => {
    const r = stepMovement(
      initialMovement(),
      { ...downJump, onPlatform: false },
      ground,
      FRAME,
      MOVEMENT,
    );
    expect(r.jumped).toBe(true);
    expect(r.dropped).toBe(false);
  });

  it('jump without down on a catwalk is a normal jump', () => {
    const r = stepMovement(
      initialMovement(),
      { ...jump, onPlatform: true },
      ground,
      FRAME,
      MOVEMENT,
    );
    expect(r.jumped).toBe(true);
  });

  it('holding down + jump does not keep dropping: it needs a new press', () => {
    const r = stepMovement(
      initialMovement(),
      { ...downJump, jumpPressed: false },
      ground,
      FRAME,
      MOVEMENT,
    );
    expect(r.dropped).toBe(false);
  });
});

describe('crouching', () => {
  it('stops the marine but lets him turn', () => {
    const r = stepMovement(
      initialMovement(),
      { direction: -1, jump: false, jumpPressed: false, crouch: true },
      ground,
      FRAME,
      MOVEMENT,
    );
    expect(r.vx).toBe(0);
    expect(r.state.facing).toBe('left');
  });

  it('can still jump out of a crouch', () => {
    const r = stepMovement(initialMovement(), { ...jump, crouch: true }, ground, FRAME, MOVEMENT);
    expect(r.jumped).toBe(true);
  });
});
