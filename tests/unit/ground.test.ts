import { describe, expect, it } from 'vitest';
import { standingOn } from '../../src/logic/ground';

const floor = { type: 'solid' as const, x: 0, y: 160, width: 300, height: 16 };
const catwalk = { type: 'platform' as const, x: 176, y: 119, width: 128, height: 6 };
const rects = [floor, catwalk];

describe('standingOn', () => {
  it('finds the floor and the catwalk', () => {
    expect(standingOn({ left: 40, right: 56, bottom: 160 }, rects)).toBe('solid');
    expect(standingOn({ left: 200, right: 216, bottom: 119 }, rects)).toBe('platform');
  });

  it('allows a pixel of rounding', () => {
    expect(standingOn({ left: 200, right: 216, bottom: 119.8 }, rects)).toBe('platform');
    expect(standingOn({ left: 200, right: 216, bottom: 121 }, rects)).toBeNull();
  });

  it('needs sideways overlap', () => {
    expect(standingOn({ left: 160, right: 176, bottom: 119 }, rects)).toBeNull(); // just touching
    expect(standingOn({ left: 300, right: 316, bottom: 119 }, rects)).toBe('platform');
    expect(standingOn({ left: 304, right: 320, bottom: 119 }, rects)).toBeNull();
  });

  it('is nothing in mid-air, and solid wins over a platform at the same height', () => {
    expect(standingOn({ left: 40, right: 56, bottom: 100 }, rects)).toBeNull();
    const ledge = { type: 'platform' as const, x: 0, y: 160, width: 50, height: 6 };
    expect(standingOn({ left: 40, right: 56, bottom: 160 }, [ledge, floor])).toBe('solid');
  });
});
