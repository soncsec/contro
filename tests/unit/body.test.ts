import { describe, expect, it } from 'vitest';
import { PLAYER_BODY, PLAYER_FRAME } from '../../src/config/tuning';
import { bodyOffsetX, spriteYForFeet } from '../../src/logic/body';

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
