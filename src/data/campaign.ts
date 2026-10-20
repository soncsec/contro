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
    sections: ['steelworks-1', 'steelworks-2', 'steelworks-3', 'steelworks-4', 'steelworks-5'],
    introCard: 'level-1-intro',
    endCard: 'level-1-end',
    music: 'music-level-1',
  },
  {
    stage: 2,
    name: 'THE NEON DISTRICT',
    // Built one section at a time (M4.3; scenery: owner chose option A, 2026-10-19).
    sections: ['neon-1', 'neon-2', 'neon-3', 'neon-4', 'neon-5'],
    introCard: 'level-2-intro',
    endCard: 'level-2-end',
    // Level 1's loop until Level 2's own music is chosen (M4.5).
    music: 'music-level-1',
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
