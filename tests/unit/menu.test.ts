import { describe, expect, it } from 'vitest';
import { INPUT_DELAY_MAX_STEP_MS, shownFor } from '../../src/logic/menu';

describe('shownFor (input delay)', () => {
  it('counts ordinary frames in full', () => {
    expect(shownFor(0, 16)).toBe(16);
    expect(shownFor(100, 33)).toBe(133);
  });

  it('counts a stalled frame as only INPUT_DELAY_MAX_STEP_MS', () => {
    expect(shownFor(0, 900)).toBe(INPUT_DELAY_MAX_STEP_MS);
  });

  it('ignores a negative step', () => {
    expect(shownFor(40, -5)).toBe(40);
  });
});
