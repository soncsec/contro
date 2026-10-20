import { describe, expect, it } from 'vitest';
import { initialBiped, stepBiped, type BipedState } from '../../src/logic/biped';

const t = { speed: 18, sightRange: 260, keepDistance: 90, walkMs: 2400, aimMs: 600 };
const open = { left: false, right: false };

/** Steps frame by frame, collecting how many shots it fires. */
function run(state: BipedState, frames: number, playerX: number | null, x = 400) {
  let s = state;
  let shots = 0;
  let vx = 0;
  for (let i = 0; i < frames; i++) {
    const r = stepBiped(s, x, playerX, open, 100, t);
    s = r.state;
    vx = r.vx;
    if (r.fire) shots++;
  }
  return { state: s, shots, vx };
}

describe('stepBiped (M4.2)', () => {
  it('stands still until it sees the marine', () => {
    expect(run(initialBiped(), 30, null)).toMatchObject({ shots: 0, vx: 0 });
    expect(run(initialBiped(), 30, 900)).toMatchObject({ shots: 0, vx: 0 }); // too far
  });

  it('on seeing him, faces him, aims for a moment, then fires', () => {
    const first = stepBiped(initialBiped(), 400, 200, open, 16, t);
    expect(first.state).toMatchObject({ mode: 'aim', direction: -1 });
    expect(first.vx).toBe(0);
    expect(run(first.state, 5, 200).shots).toBe(0); // 500 ms: still aiming
    expect(run(first.state, 7, 200).shots).toBe(1);
  });

  it('then walks towards him, and fires again after each walk', () => {
    const aimed = run(initialBiped(), 7, 200).state;
    const walking = stepBiped(aimed, 400, 200, open, 100, t);
    expect(walking.vx).toBe(-18);
    // Every walk (2.4 s) and aim (0.6 s): one more shot.
    expect(run(aimed, 30, 200).shots).toBe(1);
  });

  it('stops walking when close, or at a wall, but still shoots', () => {
    const aimed = run(initialBiped(), 7, 200).state;
    expect(stepBiped(aimed, 400, 340, open, 100, t).vx).toBe(0); // 60 px away
    expect(stepBiped(aimed, 400, 200, { left: true, right: false }, 100, t).vx).toBe(0);
    expect(run(aimed, 31, 340).shots).toBe(1);
  });

  it('turns to face him when he passes it', () => {
    const r = stepBiped(initialBiped(), 400, 500, open, 16, t);
    expect(r.state.direction).toBe(1);
  });
});
