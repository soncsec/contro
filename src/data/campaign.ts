import { flattenCampaign, type CampaignLevel } from '../logic/campaign';
import type { DialogueId } from './dialogue';

/**
 * The campaign (ARCHITECTURE.md ADR-C10): levels in order, each made of sections (maps)
 * played back to back. A dialogue card plays only after a level's last section. After the
 * last level the campaign starts again from the first (until the ending exists, M5.4).
 */
export const CAMPAIGN_LEVELS: readonly CampaignLevel<DialogueId>[] = [
  // The two corridor test rooms stand in for level 1 until the real levels (M3) arrive.
  {
    stage: 1,
    name: 'TRAINING CORRIDOR',
    sections: ['corridor-test', 'corridor-test-2'],
    introCard: 'level-1-intro',
    endCard: 'level-1-end',
  },
];

/** Every section in play order, with its level number, section number and level name. */
export const CAMPAIGN = flattenCampaign(CAMPAIGN_LEVELS);
