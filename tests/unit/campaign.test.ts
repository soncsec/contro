import { describe, expect, it } from 'vitest';
import { ASSETS, LEVELS } from '../../src/assets/manifest';
import { CAMPAIGN } from '../../src/data/campaign';
import { DIALOGUE, SPEAKERS } from '../../src/data/dialogue';
import { DIALOGUE_CARD } from '../../src/config/tuning';
import { afterExit, validateCampaign, validateCardText } from '../../src/logic/campaign';

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
    { level: 'a', exitCard: 'card-a' },
    { level: 'b', exitCard: 'card-b' },
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
  it('reports unknown levels and cards, repeats, and an empty campaign', () => {
    expect(validateCampaign([], ['a'], ['c'])).toEqual(['campaign is empty']);
    expect(
      validateCampaign(
        [
          { level: 'a', exitCard: 'c' },
          { level: 'x', exitCard: 'y' },
          { level: 'a', exitCard: 'c' },
        ],
        ['a'],
        ['c'],
      ),
    ).toEqual(['unknown level "x"', 'unknown card "y"', 'level "a" is listed twice']);
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
