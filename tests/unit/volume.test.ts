import { describe, expect, it } from 'vitest';
import {
  MAX_VOLUME,
  VOLUME_NAMES,
  cycleVolume,
  stepVolume,
  volumeFactor,
  volumeName,
} from '../../src/logic/volume';

describe('volume levels (M6.2)', () => {
  it('are OFF, LOW, MID and HIGH', () => {
    expect(VOLUME_NAMES).toEqual(['OFF', 'LOW', 'MID', 'HIGH']);
    expect(MAX_VOLUME).toBe(3);
    expect([0, 1, 2, 3].map(volumeName)).toEqual(['OFF', 'LOW', 'MID', 'HIGH']);
  });

  it('scale the sound from silent to the normal loudness', () => {
    expect(volumeFactor(0)).toBe(0);
    expect(volumeFactor(1)).toBeCloseTo(1 / 3, 10);
    expect(volumeFactor(3)).toBe(1);
    expect(volumeFactor(9)).toBe(1);
    expect(volumeFactor(-2)).toBe(0);
  });

  it('left and right step down and up, stopping at the ends', () => {
    expect(stepVolume(2, 1)).toBe(3);
    expect(stepVolume(3, 1)).toBe(3);
    expect(stepVolume(1, -1)).toBe(0);
    expect(stepVolume(0, -1)).toBe(0);
  });

  it('choosing steps up, from HIGH round to OFF', () => {
    expect([0, 1, 2, 3].map(cycleVolume)).toEqual([1, 2, 3, 0]);
  });
});
