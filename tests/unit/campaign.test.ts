import { describe, expect, it } from 'vitest';
import { ASSETS, LEVELS } from '../../src/assets/manifest';
import { CAMPAIGN } from '../../src/data/campaign';
import { DIALOGUE, SPEAKERS } from '../../src/data/dialogue';
import { DIALOGUE_CARD } from '../../src/config/tuning';
import {
  afterExit,
  levelLabel,
  stepFor,
  validateCampaign,
  validateCardText,
} from '../../src/logic/campaign';

const levelKeys = LEVELS.map((l) => l.key);
const cardIds = Object.keys(DIALOGUE);

describe('campaign data', () => {
  it('only uses known levels and cards', () => {
    expect(validateCampaign(CAMPAIGN, levelKeys, cardIds)).toEqual([]);
  });

  it('plays every level in the manifest', () => {
    expect(CAMPAIGN.map((s) => s.level).sort()).toEqual([...levelKeys].sort());
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

describe('afterExit', () => {
  const steps = [
    { level: 'a', exitCard: 'card-a', stage: 1, section: 1, name: 'ONE' },
    { level: 'b', exitCard: 'card-b', stage: 1, section: 2, name: 'ONE' },
  ];

  it("shows the level's card and moves to the next level", () => {
    expect(afterExit(steps, 'a')).toEqual({ card: 'card-a', nextLevel: 'b' });
  });

  it('wraps from the last level to the first', () => {
    expect(afterExit(steps, 'b')).toEqual({ card: 'card-b', nextLevel: 'a' });
  });

  it('rejects a level that is not in the campaign', () => {
    expect(() => afterExit(steps, 'z')).toThrow(/not in the campaign/);
  });
});

describe('validateCampaign', () => {
  const step = (level: string, stage: number, section: number, name = 'ONE') => ({
    level,
    exitCard: 'c',
    stage,
    section,
    name,
  });

  it('reports unknown levels and cards, repeats, and an empty campaign', () => {
    expect(validateCampaign([], ['a'], ['c'])).toEqual(['campaign is empty']);
    expect(
      validateCampaign(
        [step('a', 1, 1), { ...step('x', 1, 2), exitCard: 'y' }, step('a', 1, 3)],
        ['a'],
        ['c'],
      ),
    ).toEqual(['unknown level "x"', 'unknown card "y"', 'level "a" is listed twice']);
  });

  it('accepts levels numbered from 1 with sections from 1 in order', () => {
    const ok = [step('a', 1, 1), step('b', 1, 2), step('c', 2, 1, 'TWO'), step('d', 2, 2, 'TWO')];
    expect(validateCampaign(ok, ['a', 'b', 'c', 'd'], ['c'])).toEqual([]);
  });

  it('reports numbering gaps, out-of-order sections and mixed level names', () => {
    expect(validateCampaign([step('a', 1, 2)], ['a'], ['c'])).toEqual(['"a" is 1-2, expected 1-1']);
    expect(validateCampaign([step('a', 1, 1), step('b', 3, 1)], ['a', 'b'], ['c'])).toEqual([
      '"b" is 3-1, expected 2-1',
    ]);
    expect(
      validateCampaign([step('a', 1, 1), step('b', 1, 2, 'OTHER')], ['a', 'b'], ['c']),
    ).toEqual(['level 1 has more than one name']);
    expect(validateCampaign([step('a', 1, 1, ' ')], ['a'], ['c'])).toEqual([
      '"a" has no level name',
    ]);
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
