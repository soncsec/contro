import { describe, expect, it } from 'vitest';
import { MOVEMENT } from '../../src/config/tuning';
import {
  initialMovement,
  playerAnim,
  stepMovement,
  type MovementInput,
  type MovementState,
} from '../../src/logic/movement';

const FRAME = 16;
const ground = { onFloor: true, vy: 0 };
const air = (vy = 0) => ({ onFloor: false, vy });
const none: MovementInput = { direction: 0, jump: false };
const jump: MovementInput = { direction: 0, jump: true };

/** Runs several frames with the same input and body, returning the last result. */
function run(state: MovementState, input: MovementInput, body: typeof ground, frames: number) {
  let r = stepMovement(state, input, body, FRAME, MOVEMENT);
  for (let i = 1; i < frames; i++) r = stepMovement(r.state, input, body, FRAME, MOVEMENT);
  return r;
}

describe('running', () => {
  it('goes full speed at once and stops at once', () => {
    const s = initialMovement();
    expect(stepMovement(s, { direction: 1, jump: false }, ground, FRAME, MOVEMENT).vx).toBe(90);
    expect(stepMovement(s, { direction: -1, jump: false }, ground, FRAME, MOVEMENT).vx).toBe(-90);
    expect(stepMovement(s, none, ground, FRAME, MOVEMENT).vx).toBe(0);
  });

  it('faces the last direction moved', () => {
    const left = stepMovement(
      initialMovement(),
      { direction: -1, jump: false },
      ground,
      FRAME,
      MOVEMENT,
    );
    expect(left.state.facing).toBe('left');
    expect(stepMovement(left.state, none, ground, FRAME, MOVEMENT).state.facing).toBe('left');
    expect(initialMovement().facing).toBe('right');
  });

  it('steers in the air the same as on the ground', () => {
    expect(
      stepMovement(initialMovement(), { direction: 1, jump: false }, air(), FRAME, MOVEMENT).vx,
    ).toBe(90);
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
    expect(stepMovement(landed, jump, ground, FRAME, MOVEMENT).jumped).toBe(false);
  });

  it('allows a jump shortly after running off a ledge (coyote time)', () => {
    // 4 frames in the air, then jump on the 5th: 80 ms, inside the 90 ms window.
    const falling = run(initialMovement(), none, air(), 4);
    expect(falling.state.airMs).toBe(64);
    expect(stepMovement(falling.state, jump, air(20), FRAME, MOVEMENT).jumped).toBe(true);
  });

  it('refuses a jump after coyote time runs out', () => {
    // 5 frames in the air, then jump on the 6th: 96 ms, just past the window.
    const falling = run(initialMovement(), none, air(), 5);
    expect(stepMovement(falling.state, jump, air(20), FRAME, MOVEMENT).jumped).toBe(false);
  });

  it('gives no second jump in the air during coyote time', () => {
    const up = stepMovement(initialMovement(), jump, ground, FRAME, MOVEMENT);
    const rising = stepMovement(up.state, none, air(-250), FRAME, MOVEMENT);
    expect(stepMovement(rising.state, jump, air(-230), FRAME, MOVEMENT).jumped).toBe(false);
  });

  it('remembers a press just before landing (jump buffer)', () => {
    const pressed = stepMovement(
      { ...initialMovement(), airMs: 500 },
      jump,
      air(200),
      FRAME,
      MOVEMENT,
    );
    expect(pressed.jumped).toBe(false);
    const stillFalling = run(pressed.state, jump, air(200), 5); // 96 ms after the press
    expect(stillFalling.jumped).toBe(false);
    expect(stepMovement(stillFalling.state, jump, ground, FRAME, MOVEMENT).jumped).toBe(true);
  });

  it('forgets a press made too long before landing', () => {
    const pressed = stepMovement(
      { ...initialMovement(), airMs: 500 },
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
      stepMovement(up.state, jump, { onFloor: true, vy: -300 }, FRAME, MOVEMENT).state.jumping,
    ).toBe(true);
    expect(stepMovement(up.state, jump, ground, FRAME, MOVEMENT).state.jumping).toBe(false);
  });

  it('caps long frame steps so a stall cannot skip coyote time checks', () => {
    const r = stepMovement(initialMovement(), none, air(), 1000, MOVEMENT);
    expect(r.state.airMs).toBe(50);
    expect(stepMovement(initialMovement(), none, air(), -5, MOVEMENT).state.airMs).toBe(0);
  });
});

describe('playerAnim', () => {
  it('picks jump in the air, run when moving, idle otherwise', () => {
    expect(playerAnim(false, 0)).toBe('jump');
    expect(playerAnim(true, 90)).toBe('run');
    expect(playerAnim(true, -90)).toBe('run');
    expect(playerAnim(true, 0)).toBe('idle');
  });
});
