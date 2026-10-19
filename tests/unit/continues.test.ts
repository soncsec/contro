import { describe, expect, it } from 'vitest';
import { CONTINUE } from '../../src/config/tuning';
import { continueOptions, useContinue } from '../../src/logic/continues';

describe('continues (M3.4)', () => {
  it('a run starts with the approved 3', () => {
    expect(CONTINUE.count).toBe(3);
  });

  it('offers CONTINUE or QUIT while any are left', () => {
    expect(continueOptions(3)).toEqual(['CONTINUE', 'QUIT']);
    expect(continueOptions(1)).toEqual(['CONTINUE', 'QUIT']);
  });

  it('offers nothing once they are used up', () => {
    expect(continueOptions(0)).toEqual([]);
  });

  it('uses one at a time and never goes below zero', () => {
    expect(useContinue(3)).toBe(2);
    expect(useContinue(1)).toBe(0);
    expect(useContinue(0)).toBe(0);
  });
});
