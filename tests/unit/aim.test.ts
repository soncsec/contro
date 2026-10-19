import { describe, expect, it } from 'vitest';
import { marineAnim, shotVelocity, stanceFor, type Stance } from '../../src/logic/aim';

const stand: Stance = { crouching: false, aim: 'forward' };
const crouch: Stance = { crouching: true, aim: 'forward' };
const diag: Stance = { crouching: false, aim: 'diagonal' };

describe('stanceFor', () => {
  it('stands and aims forward with nothing held', () => {
    expect(stanceFor({ up: false, down: false }, true)).toEqual(stand);
  });

  it('crouches with down, only on the floor', () => {
    expect(stanceFor({ up: false, down: true }, true)).toEqual(crouch);
    expect(stanceFor({ up: false, down: true }, false)).toEqual(stand);
  });

  it('aims diagonally with up, on the floor or in the air', () => {
    expect(stanceFor({ up: true, down: false }, true)).toEqual(diag);
    expect(stanceFor({ up: true, down: false }, false)).toEqual(diag);
  });

  it('lets down win over up on the floor', () => {
    expect(stanceFor({ up: true, down: true }, true)).toEqual(crouch);
    // In the air there is no crouch, so up still aims.
    expect(stanceFor({ up: true, down: true }, false)).toEqual(diag);
  });
});

describe('marineAnim', () => {
  it('uses the jump frames in the air whatever the stance', () => {
    expect(marineAnim(false, 90, true, diag)).toBe('jump');
    expect(marineAnim(false, 0, false, stand)).toBe('jump');
  });

  it('standing: idle, shoot, aim-diag, shoot-diag', () => {
    expect(marineAnim(true, 0, false, stand)).toBe('idle');
    expect(marineAnim(true, 0, true, stand)).toBe('shoot');
    expect(marineAnim(true, 0, false, diag)).toBe('aim-diag');
    expect(marineAnim(true, 0, true, diag)).toBe('shoot-diag');
  });

  it('running: run or run-diag, firing or not', () => {
    expect(marineAnim(true, 90, false, stand)).toBe('run');
    expect(marineAnim(true, -90, true, stand)).toBe('run');
    expect(marineAnim(true, 90, true, diag)).toBe('run-diag');
  });

  it('crouching: crouch or crouch-shoot', () => {
    expect(marineAnim(true, 0, false, crouch)).toBe('crouch');
    expect(marineAnim(true, 0, true, crouch)).toBe('crouch-shoot');
  });
});

describe('shotVelocity', () => {
  it('flies straight ahead when aiming forward', () => {
    expect(shotVelocity(1, 'forward', 300)).toEqual({ vx: 300, vy: 0 });
    expect(shotVelocity(-1, 'forward', 300)).toEqual({ vx: -300, vy: 0 });
  });

  it('flies 45° up at the same speed when aiming diagonally', () => {
    const r = shotVelocity(1, 'diagonal', 300);
    expect(r.vx).toBeCloseTo(212.13, 2);
    expect(r.vy).toBeCloseTo(-212.13, 2);
    expect(Math.hypot(r.vx, r.vy)).toBeCloseTo(300, 6);
    expect(shotVelocity(-1, 'diagonal', 300).vx).toBeCloseTo(-212.13, 2);
  });
});

describe('aiming down while running (M3.13)', () => {
  const down: Stance = { crouching: false, aim: 'down' };

  it('down alone still crouches on the floor', () => {
    expect(stanceFor({ up: false, down: true, left: false, right: false }, true)).toEqual(crouch);
  });

  it('down with left or right runs and aims down, on the floor and in the air', () => {
    expect(stanceFor({ up: false, down: true, right: true }, true)).toEqual(down);
    expect(stanceFor({ up: false, down: true, left: true }, true)).toEqual(down);
    expect(stanceFor({ up: false, down: true, right: true }, false)).toEqual(down);
  });

  it('down wins over up when moving', () => {
    expect(stanceFor({ up: true, down: true, right: true }, true)).toEqual(down);
  });

  it('left and right together cancel out, so down crouches', () => {
    expect(stanceFor({ up: false, down: true, left: true, right: true }, true)).toEqual(crouch);
  });

  it('down alone in the air aims forward (no crouch, no down aim)', () => {
    expect(stanceFor({ up: false, down: true }, false)).toEqual(stand);
  });

  it('uses the run-down frames on the floor and the jump frames in the air', () => {
    expect(marineAnim(true, 90, false, down)).toBe('run-down');
    expect(marineAnim(true, 0, true, down)).toBe('run-down');
    expect(marineAnim(false, 90, true, down)).toBe('jump');
  });

  it('flies 45° down at the same speed', () => {
    const r = shotVelocity(1, 'down', 300);
    expect(r.vx).toBeCloseTo(212.13, 2);
    expect(r.vy).toBeCloseTo(212.13, 2);
    expect(shotVelocity(-1, 'down', 300).vx).toBeCloseTo(-212.13, 2);
  });
});
