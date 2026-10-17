import { describe, expect, it } from 'vitest';
import { PLAYER_BODY, PLAYER_FRAME } from '../../src/config/tuning';
import { bodyOffsetX, framePointToWorld, spriteYForFeet } from '../../src/logic/body';

describe('bodyOffsetX', () => {
  it('uses the measured offset when facing right', () => {
    expect(bodyOffsetX(PLAYER_FRAME.width, PLAYER_BODY, false)).toBe(27);
  });

  it('mirrors the box inside the frame when facing left', () => {
    // 75 - 27 - 16 = 32: the box keeps the same distance from the opposite edge.
    expect(bodyOffsetX(PLAYER_FRAME.width, PLAYER_BODY, true)).toBe(32);
  });
});

describe('spriteYForFeet', () => {
  it('puts the bottom of the box on the floor', () => {
    // Box bottom is row 48 of the frame, so the centre (row 24) is 24 px above the feet.
    expect(spriteYForFeet(160, PLAYER_FRAME.height, PLAYER_BODY)).toBe(136);
  });

  it('accounts for boxes that stop above the frame bottom', () => {
    expect(spriteYForFeet(100, 40, { width: 10, height: 20, offsetX: 0, offsetY: 10 })).toBe(90);
  });
});

describe('framePointToWorld', () => {
  const frame = { width: 75, height: 48 };

  it('finds the barrel tip of a sprite facing right', () => {
    // Sprite centred at (100, 50): frame left = 62.5, top = 26. Pixel (56, 23) → right edge 119.5.
    expect(framePointToWorld(100, 50, frame, [56, 23], false)).toEqual({ x: 119.5, y: 49.5 });
  });

  it('mirrors the point when the sprite faces left', () => {
    // Mirrored pixel column = 75 - 1 - 56 = 18 → its left edge is 62.5 + 18 = 80.5.
    expect(framePointToWorld(100, 50, frame, [56, 23], true)).toEqual({ x: 80.5, y: 49.5 });
  });

  it('is symmetric about the sprite centre', () => {
    const r = framePointToWorld(100, 50, frame, [56, 23], false);
    const l = framePointToWorld(100, 50, frame, [56, 23], true);
    expect(r.x - 100).toBe(100 - l.x);
  });
});
