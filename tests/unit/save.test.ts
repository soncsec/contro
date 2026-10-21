import { describe, expect, it } from 'vitest';
import { titleOptions } from '../../src/logic/menu';
import { DEFAULT_SAVE, parseSave, pickLevel, reachLevel } from '../../src/logic/save';

describe('furthest level reached (M3.5)', () => {
  it('starts at level 1', () => {
    expect(DEFAULT_SAVE.furthestLevel).toBe(1);
  });

  it('reads a save from before M3.5 as level 1, keeping its best score', () => {
    expect(parseSave('{"version":1,"bestScore":900}')).toEqual({
      version: 1,
      bestScore: 900,
      furthestLevel: 1,
      musicLevel: 3,
      sfxLevel: 3,
    });
  });

  it('ignores a bad furthest level, and drops fractions', () => {
    expect(parseSave('{"version":1,"bestScore":0,"furthestLevel":0}').furthestLevel).toBe(1);
    expect(parseSave('{"version":1,"bestScore":0,"furthestLevel":"3"}').furthestLevel).toBe(1);
    expect(parseSave('{"version":1,"bestScore":0,"furthestLevel":2.9}').furthestLevel).toBe(2);
  });

  it('only ever moves forward', () => {
    const at2 = reachLevel(DEFAULT_SAVE, 2);
    expect(at2.furthestLevel).toBe(2);
    expect(reachLevel(at2, 1)).toBe(at2);
    expect(reachLevel(at2, 2)).toBe(at2);
  });
});

describe('volume levels (M6.2)', () => {
  it('start at HIGH, the normal loudness', () => {
    expect(DEFAULT_SAVE).toMatchObject({ musicLevel: 3, sfxLevel: 3 });
  });

  it("keep an older save's sound switch: on reads as HIGH, off as OFF", () => {
    expect(parseSave('{"version":1,"bestScore":0}')).toMatchObject({ musicLevel: 3, sfxLevel: 3 });
    expect(parseSave('{"version":1,"bestScore":0,"soundOn":false}')).toMatchObject({
      musicLevel: 0,
      sfxLevel: 0,
    });
  });

  it('read saved levels, and ignore bad ones', () => {
    expect(parseSave('{"version":1,"bestScore":0,"musicLevel":1,"sfxLevel":2}')).toMatchObject({
      musicLevel: 1,
      sfxLevel: 2,
    });
    const bad = parseSave('{"version":1,"bestScore":0,"musicLevel":7,"sfxLevel":"loud"}');
    expect(bad).toMatchObject({ musicLevel: 3, sfxLevel: 3 });
    expect(parseSave('{"version":1,"bestScore":0,"musicLevel":1.5}').musicLevel).toBe(3);
  });
});

describe('pickLevel (M3.5)', () => {
  it('steps through the reached levels and wraps', () => {
    expect(pickLevel(1, 3, 1)).toBe(2);
    expect(pickLevel(3, 3, 1)).toBe(1);
    expect(pickLevel(1, 3, -1)).toBe(3);
  });

  it('stays on level 1 when only level 1 is reached', () => {
    expect(pickLevel(1, 1, 1)).toBe(1);
    expect(pickLevel(1, 1, -1)).toBe(1);
  });
});

describe('titleOptions (M3.5)', () => {
  it('has no LEVEL row until a later level is reached', () => {
    expect(titleOptions(1)).toEqual(['START', 'CONTROLS', 'MORE GAMES']);
  });

  it('adds the LEVEL row after START once level 2 is reached', () => {
    expect(titleOptions(2)).toEqual(['START', 'LEVEL', 'CONTROLS', 'MORE GAMES']);
  });
});
