import { describe, expect, it } from 'vitest';
import {
  ACTION_CHEATS,
  CheatMatcher,
  NO_CHEATS,
  RESERVED_LETTERS,
  WORD_CHEATS,
  applyCheat,
} from '../../src/logic/cheats';

const KONAMI = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'fire', 'jump'];
const type = (m: CheatMatcher, tokens: readonly string[]) => tokens.map((t) => m.push(t));

describe('the Konami code', () => {
  it('gives extra lives when entered exactly', () => {
    const m = new CheatMatcher(ACTION_CHEATS);
    const results = type(m, KONAMI);
    expect(results.slice(0, -1).every((r) => r === null)).toBe(true);
    expect(results.at(-1)).toBe('extra-lives');
  });

  it('works after stray presses, and can be entered twice', () => {
    const m = new CheatMatcher(ACTION_CHEATS);
    type(m, ['fire', 'down', 'up']);
    expect(type(m, KONAMI).at(-1)).toBe('extra-lives');
    expect(type(m, KONAMI).at(-1)).toBe('extra-lives');
  });

  it('does nothing when a step is wrong', () => {
    const m = new CheatMatcher(ACTION_CHEATS);
    const wrong = [...KONAMI];
    wrong[5] = 'left';
    expect(type(m, wrong).every((r) => r === null)).toBe(true);
  });

  it('reports progress through the code', () => {
    const m = new CheatMatcher(ACTION_CHEATS);
    expect(m.progress).toBe(0);
    type(m, KONAMI.slice(0, 8));
    expect(m.progress).toBe(8);
    m.push('fire');
    expect(m.progress).toBe(9);
    m.reset();
    expect(m.progress).toBe(0);
  });

  it('progress follows the latest presses, not old ones', () => {
    const m = new CheatMatcher(ACTION_CHEATS);
    type(m, ['up', 'up', 'down', 'fire']);
    expect(m.progress).toBe(0);
    type(m, ['up']);
    expect(m.progress).toBe(1);
  });
});

describe('word cheats', () => {
  it.each([
    ['IRON', 'invincible'],
    ['GHOUL', 'invisible'],
    ['THRU', 'skip-room'],
  ])('%s gives %s', (word, id) => {
    const m = new CheatMatcher(WORD_CHEATS);
    expect(type(m, [...word]).at(-1)).toBe(id);
  });

  it('finds a word typed after other letters', () => {
    const m = new CheatMatcher(WORD_CHEATS);
    expect(type(m, [...'HELLOIRON']).at(-1)).toBe('invincible');
  });

  it('never uses a letter the game binds to an action or fullscreen', () => {
    for (const code of WORD_CHEATS) {
      for (const letter of code.sequence) {
        expect(RESERVED_LETTERS as readonly string[]).not.toContain(letter);
      }
    }
  });
});

describe('applyCheat', () => {
  it('toggles invincibility and invisibility, and marks the run as cheated', () => {
    const on = applyCheat(NO_CHEATS, 'invincible');
    expect(on).toEqual({ invincible: true, invisible: false, used: true });
    expect(applyCheat(on, 'invincible')).toEqual({
      invincible: false,
      invisible: false,
      used: true,
    });
    expect(applyCheat(NO_CHEATS, 'invisible').invisible).toBe(true);
  });

  it('marks extra lives and room skips as cheats too', () => {
    expect(applyCheat(NO_CHEATS, 'extra-lives')).toEqual({ ...NO_CHEATS, used: true });
    expect(applyCheat(NO_CHEATS, 'skip-room').used).toBe(true);
  });
});
