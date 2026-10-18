import type { DialogueId } from './dialogue';

/**
 * The order rooms are played in and the card shown after each one's exit.
 * After the last room the campaign starts again from the first (walking skeleton, M1.7).
 */
export interface CampaignStep {
  /** Map key in LEVELS (src/assets/manifest.ts). */
  level: string;
  /** Card shown after reaching this map's exit. */
  exitCard: DialogueId;
  /** Level number and section within it, shown as e.g. "1-2" (M2.14). */
  stage: number;
  section: number;
  /** The level's name, shown in the banner when a section starts. */
  name: string;
}

// The two corridor test rooms stand in for level 1 until the real levels (M3) arrive.
export const CAMPAIGN: readonly CampaignStep[] = [
  {
    level: 'corridor-test',
    exitCard: 'room-1-exit',
    stage: 1,
    section: 1,
    name: 'TRAINING CORRIDOR',
  },
  {
    level: 'corridor-test-2',
    exitCard: 'room-2-exit',
    stage: 1,
    section: 2,
    name: 'TRAINING CORRIDOR',
  },
];
