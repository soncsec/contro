import { describe, expect, it } from 'vitest';
import { ASSETS, LEVELS } from '../../src/assets/manifest';
import {
  CAMPAIGN,
  CAMPAIGN_LEVELS,
  STORY_LEVELS,
  TEST_CAMPAIGN_LEVELS,
  TRAINING_LEVEL,
} from '../../src/data/campaign';
import { DIALOGUE, SPEAKERS } from '../../src/data/dialogue';
import { DIALOGUE_CARD } from '../../src/config/tuning';
import {
  type CampaignLevel,
  afterExit,
  campaignStart,
  flattenCampaign,
  levelLabel,
  stepFor,
  validateCampaign,
  validateCardText,
} from '../../src/logic/campaign';

const levelKeys = LEVELS.map((l) => l.key);
const cardIds = Object.keys(DIALOGUE);

describe('campaign data', () => {
  const storyMaps = LEVELS.filter((l) => !l.testOnly).map((l) => l.key);
  const testMaps = LEVELS.filter((l) => l.testOnly).map((l) => l.key);

  it.each([
    ['story', STORY_LEVELS],
    ['e2e', TEST_CAMPAIGN_LEVELS],
  ] as const)(
    'the %s campaign uses known maps and cards, levels numbered in order',
    (_n, levels) => {
      expect(validateCampaign(levels, levelKeys, cardIds)).toEqual([]);
    },
  );

  it('players get every story map and no test map', () => {
    expect(STORY_LEVELS.flatMap((l) => l.sections).sort()).toEqual([...storyMaps].sort());
  });

  it('the e2e build plays the training corridor first, then the story renumbered', () => {
    expect(TEST_CAMPAIGN_LEVELS[0]).toBe(TRAINING_LEVEL);
    expect([...TRAINING_LEVEL.sections].sort()).toEqual([...testMaps].sort());
    expect(TEST_CAMPAIGN_LEVELS.slice(1).map((l) => [l.stage, l.name])).toEqual(
      STORY_LEVELS.map((l) => [l.stage + 1, l.name]),
    );
  });

  it('unit tests (not e2e) see the story campaign', () => {
    expect(CAMPAIGN_LEVELS).toBe(STORY_LEVELS);
    expect(CAMPAIGN[0]?.level).toBe('steelworks-1');
  });

  it('shows a card only after the last section of each level', () => {
    for (const step of CAMPAIGN) {
      const level = CAMPAIGN_LEVELS[step.stage - 1];
      const last = step.section === level?.sections.length;
      expect(step.exitCard).toBe(last ? level?.endCard : null);
    }
  });
});

describe('dialogue data', () => {
  it.each(Object.entries(DIALOGUE))('card %s fits on screen', (_id, card) => {
    expect(
      validateCardText(card.lines, DIALOGUE_CARD.maxLines, DIALOGUE_CARD.maxLineChars),
    ).toEqual([]);
  });

  it.each(Object.entries(SPEAKERS))('speaker %s has a 48×48 portrait', (_id, speaker) => {
    const asset = ASSETS.find((a) => a.key === speaker.portrait);
    expect(asset).toMatchObject({ kind: 'image', width: 48, height: 48 });
  });
});

const levels: CampaignLevel[] = [
  { stage: 1, name: 'ONE', sections: ['a', 'b'], endCard: 'end-1', introCard: 'intro-1' },
  { stage: 2, name: 'TWO', sections: ['c'], endCard: 'end-2', introCard: 'intro-2' },
  { stage: 3, name: 'THREE', sections: ['d'], endCard: 'end-3' },
];
const steps = flattenCampaign(levels);

describe('flattenCampaign', () => {
  it('lists every section in order with its level number and name', () => {
    expect(steps).toEqual([
      { level: 'a', stage: 1, section: 1, name: 'ONE', exitCard: null, introCard: 'intro-1' },
      { level: 'b', stage: 1, section: 2, name: 'ONE', exitCard: 'end-1', introCard: null },
      { level: 'c', stage: 2, section: 1, name: 'TWO', exitCard: 'end-2', introCard: 'intro-2' },
      { level: 'd', stage: 3, section: 1, name: 'THREE', exitCard: 'end-3', introCard: null },
    ]);
  });
});

describe('afterExit', () => {
  it('goes straight to the next section of the same level, with no card', () => {
    expect(afterExit(steps, 'a')).toEqual({ cards: [], nextLevel: 'b' });
  });

  it("shows the level's end card, then the next level's intro card (M3.4)", () => {
    expect(afterExit(steps, 'b')).toEqual({ cards: ['end-1', 'intro-2'], nextLevel: 'c' });
  });

  it('shows only the end card when the next level has no intro', () => {
    expect(afterExit(steps, 'c')).toEqual({ cards: ['end-2'], nextLevel: 'd' });
  });

  it('ends the campaign after the last level instead of starting again (M3.4)', () => {
    expect(afterExit(steps, 'd')).toEqual({ cards: ['end-3'], nextLevel: null });
  });

  it('rejects a map not in the campaign', () => {
    expect(() => afterExit(steps, 'z')).toThrow(/not in the campaign/);
  });
});

describe('campaignStart (M3.4)', () => {
  it("opens with the first level's intro card", () => {
    expect(campaignStart(steps)).toEqual({ cards: ['intro-1'], nextLevel: 'a' });
  });

  it('goes straight in when the first level has no intro', () => {
    expect(campaignStart(steps.slice(3))).toEqual({ cards: [], nextLevel: 'd' });
  });

  it('rejects an empty campaign', () => {
    expect(() => campaignStart([])).toThrow(/empty/);
  });

  it('starts at a chosen level, with its intro card (M3.5)', () => {
    expect(campaignStart(steps, 2)).toEqual({ cards: ['intro-2'], nextLevel: 'c' });
    expect(campaignStart(steps, 3)).toEqual({ cards: [], nextLevel: 'd' });
  });

  it('rejects a level that does not exist', () => {
    expect(() => campaignStart(steps, 9)).toThrow(/no level 9/);
  });
});

describe('validateCampaign', () => {
  const maps = ['a', 'b', 'c', 'd'];
  const cards = ['end-1', 'end-2', 'end-3', 'intro-1', 'intro-2'];

  it('accepts a good campaign', () => {
    expect(validateCampaign(levels, maps, cards)).toEqual([]);
  });

  it('rejects an empty campaign', () => {
    expect(validateCampaign([], maps, cards)).toEqual(['campaign is empty']);
  });

  it('rejects unknown maps and cards, and maps used twice', () => {
    expect(
      validateCampaign(
        [{ stage: 1, name: 'ONE', sections: ['a', 'x', 'a'], endCard: 'y', introCard: 'z' }],
        maps,
        cards,
      ),
    ).toEqual([
      'level 1: unknown map "x"',
      'map "a" is used twice',
      'level 1: unknown card "y"',
      'level 1: unknown card "z"',
    ]);
  });

  it('rejects levels out of order, unnamed, or with no sections', () => {
    expect(
      validateCampaign(
        [
          { stage: 1, name: 'ONE', sections: ['a'], endCard: 'end-1' },
          { stage: 3, name: ' ', sections: [], endCard: 'end-2' },
        ],
        maps,
        cards,
      ),
    ).toEqual(['level 2 is numbered 3', 'level 3 has no name', 'level 3 has no sections']);
  });
});

describe('levelLabel and stepFor', () => {
  it('labels a section like 1-2', () => {
    expect(levelLabel({ stage: 1, section: 2 })).toBe('1-2');
  });

  it('finds the step for a map, and rejects an unknown one', () => {
    expect(stepFor(CAMPAIGN, 'steelworks-1')).toMatchObject({ stage: 1, section: 1 });
    expect(() => stepFor(CAMPAIGN, 'nowhere')).toThrow(/not in the campaign/);
  });
});

describe('validateCardText', () => {
  it('accepts one or two short lines', () => {
    expect(validateCardText(['Hello.'], 2, 34)).toEqual([]);
    expect(validateCardText(['Hello.', 'Again.'], 2, 34)).toEqual([]);
  });

  it('rejects empty, too many, too long, or padded lines', () => {
    expect(validateCardText([], 2, 34)).toEqual(['card has no lines']);
    expect(validateCardText(['a', 'b', 'c'], 2, 34)).toEqual(['card has 3 lines (max 2)']);
    expect(validateCardText(['x'.repeat(35)], 2, 34)).toEqual([
      'line 1 has 35 characters (max 34)',
    ]);
    expect(validateCardText([' hi', ''], 2, 34)).toEqual([
      'line 1 is blank or padded',
      'line 2 is blank or padded',
    ]);
  });
});
