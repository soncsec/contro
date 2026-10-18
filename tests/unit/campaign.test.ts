import { describe, expect, it } from 'vitest';
import { ASSETS, LEVELS } from '../../src/assets/manifest';
import { CAMPAIGN, CAMPAIGN_LEVELS } from '../../src/data/campaign';
import { DIALOGUE, SPEAKERS } from '../../src/data/dialogue';
import { DIALOGUE_CARD } from '../../src/config/tuning';
import {
  type CampaignLevel,
  afterExit,
  flattenCampaign,
  levelLabel,
  stepFor,
  validateCampaign,
  validateCardText,
} from '../../src/logic/campaign';

const levelKeys = LEVELS.map((l) => l.key);
const cardIds = Object.keys(DIALOGUE);

describe('campaign data', () => {
  it('only uses known maps and cards, with levels numbered in order', () => {
    expect(validateCampaign(CAMPAIGN_LEVELS, levelKeys, cardIds)).toEqual([]);
  });

  it('plays every map in the manifest', () => {
    expect(CAMPAIGN.map((s) => s.level).sort()).toEqual([...levelKeys].sort());
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
  { stage: 2, name: 'TWO', sections: ['c'], endCard: 'end-2' },
];
const steps = flattenCampaign(levels);

describe('flattenCampaign', () => {
  it('lists every section in order with its level number and name', () => {
    expect(steps).toEqual([
      { level: 'a', stage: 1, section: 1, name: 'ONE', exitCard: null },
      { level: 'b', stage: 1, section: 2, name: 'ONE', exitCard: 'end-1' },
      { level: 'c', stage: 2, section: 1, name: 'TWO', exitCard: 'end-2' },
    ]);
  });
});

describe('afterExit', () => {
  it('goes straight to the next section of the same level, with no card', () => {
    expect(afterExit(steps, 'a')).toEqual({ card: null, nextLevel: 'b' });
  });

  it("shows the level's end card before the next level", () => {
    expect(afterExit(steps, 'b')).toEqual({ card: 'end-1', nextLevel: 'c' });
  });

  it('wraps from the last section to the first', () => {
    expect(afterExit(steps, 'c')).toEqual({ card: 'end-2', nextLevel: 'a' });
  });

  it('rejects a map not in the campaign', () => {
    expect(() => afterExit(steps, 'z')).toThrow(/not in the campaign/);
  });
});

describe('validateCampaign', () => {
  const maps = ['a', 'b', 'c'];
  const cards = ['end-1', 'end-2', 'intro-1'];

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
    expect(stepFor(CAMPAIGN, 'corridor-test-2')).toMatchObject({ stage: 1, section: 2 });
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
