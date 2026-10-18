import { flattenCampaign, type CampaignLevel } from '../logic/campaign';
import type { DialogueId } from './dialogue';

/**
 * The campaign (ARCHITECTURE.md ADR-C10): levels in order, each made of sections (maps)
 * played back to back. A dialogue card plays only after a level's last section. After the
 * last level the campaign starts again from the first (until the ending exists, M5.4).
 */
export const STORY_LEVELS: readonly CampaignLevel<DialogueId>[] = [
  {
    stage: 1,
    name: 'THE STEELWORKS',
    // Built one section at a time (M3.1, owner approved 2026-10-18).
    sections: ['steelworks-1', 'steelworks-2'],
    introCard: 'level-1-intro',
    endCard: 'level-1-end',
  },
];

/**
 * The two corridor test rooms, played first in the e2e build only, so the browser tests keep
 * small fixed rooms to play in. Players never see them (owner's call, 2026-10-18).
 */
export const TRAINING_LEVEL: CampaignLevel<DialogueId> = {
  stage: 1,
  name: 'TRAINING CORRIDOR',
  sections: ['corridor-test', 'corridor-test-2'],
  endCard: 'training-end',
};

/** The e2e build's campaign: training first, then the story levels numbered after it. */
export const TEST_CAMPAIGN_LEVELS: readonly CampaignLevel<DialogueId>[] = [
  TRAINING_LEVEL,
  ...STORY_LEVELS.map((level) => ({ ...level, stage: level.stage + 1 })),
];

export const CAMPAIGN_LEVELS = import.meta.env.MODE === 'e2e' ? TEST_CAMPAIGN_LEVELS : STORY_LEVELS;

/** Every section in play order, with its level number, section number and level name. */
export const CAMPAIGN = flattenCampaign(CAMPAIGN_LEVELS);
