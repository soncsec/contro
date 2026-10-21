/**
 * Music and effects volume levels (M6.2; owner chose OFF/LOW/MID/HIGH, 2026-10-21). Pure, unit
 * tested; GameSound applies them and the pause menu changes them.
 */
export const VOLUME_NAMES = ['OFF', 'LOW', 'MID', 'HIGH'] as const;
export const MAX_VOLUME = VOLUME_NAMES.length - 1;

/** Share of full volume: OFF silent, HIGH the game's normal loudness. */
export const volumeFactor = (level: number): number =>
  Math.min(MAX_VOLUME, Math.max(0, level)) / MAX_VOLUME;

export const volumeName = (level: number): string =>
  VOLUME_NAMES[Math.min(MAX_VOLUME, Math.max(0, level))] ?? 'OFF';

/** Left or right on a volume row: one step down or up, stopping at OFF and HIGH. */
export function stepVolume(level: number, delta: -1 | 1): number {
  return Math.min(MAX_VOLUME, Math.max(0, level + delta));
}

/** Choosing a volume row: one step up, from HIGH round to OFF. */
export function cycleVolume(level: number): number {
  return level >= MAX_VOLUME ? 0 : level + 1;
}
