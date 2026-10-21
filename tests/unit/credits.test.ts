import { describe, expect, it } from 'vitest';
import { CREDITS, CREDIT_LINE_MAX } from '../../src/data/credits';
import { creditsDone, creditsTop } from '../../src/logic/credits';

describe('credits (M5.4)', () => {
  it('every line fits the screen', () => {
    for (const line of CREDITS) expect(line.text.length).toBeLessThanOrEqual(CREDIT_LINE_MAX);
  });

  it('credit the maker as the owner chose, and every source in CREDITS.md', () => {
    const text = CREDITS.map((l) => l.text).join('\n');
    expect(text).toContain('A GAME BY KEITH SONCRANT');
    expect(text).toContain('github.com/soncsec/contro');
    for (const name of ['ANSIMUZ', 'KENNEY', 'PRESS START 2P', 'CODEMAN38']) {
      expect(text).toContain(name);
    }
  });

  it('starts below the screen and rises at the scroll speed', () => {
    expect(creditsTop(0, 176, 20)).toBe(176);
    expect(creditsTop(1000, 176, 20)).toBe(156);
    expect(creditsTop(-500, 176, 20)).toBe(176);
  });

  it('is done once the last line has gone off the top', () => {
    expect(creditsDone(-100, 10, 12)).toBe(false); // the last line is at 20
    expect(creditsDone(-121, 10, 12)).toBe(true);
  });
});
