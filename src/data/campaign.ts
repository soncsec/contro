import type { DialogueId } from './dialogue';

/**
 * The order rooms are played in and the card shown after each one's exit.
 * After the last room the campaign starts again from the first (walking skeleton, M1.7).
 */
export interface CampaignStep {
  /** Level key in LEVELS (src/assets/manifest.ts). */
  level: string;
  /** Card shown after reaching this level's exit. */
  exitCard: DialogueId;
}

export const CAMPAIGN: readonly CampaignStep[] = [
  { level: 'corridor-test', exitCard: 'room-1-exit' },
  { level: 'corridor-test-2', exitCard: 'room-2-exit' },
];
