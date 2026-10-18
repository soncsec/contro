import { describe, expect, it } from 'vitest';
import { SCORING } from '../../src/config/tuning';
import { ENEMIES, ENEMY_TYPES } from '../../src/data/enemies';
import { addPoints, formatScore, newRun } from '../../src/logic/score';
import { DEFAULT_SAVE, SAVE_KEY, parseSave, serializeSave } from '../../src/logic/save';

const T = SCORING.extraLifeAt; // 20 000 and 50 000

describe('addPoints', () => {
  it('adds points and raises the best score with it', () => {
    const r = addPoints(newRun(500), 100, T);
    expect(r.state).toEqual({ score: 100, best: 500, livesAwarded: 0 });
    const r2 = addPoints({ score: 450, best: 500, livesAwarded: 0 }, 100, T);
    expect(r2.state.best).toBe(550);
  });

  it('awards an extra life on reaching 20 000, once', () => {
    const r = addPoints({ score: 19_900, best: 0, livesAwarded: 0 }, 100, T);
    expect(r.extraLives).toBe(1);
    expect(r.state.livesAwarded).toBe(1);
    expect(addPoints(r.state, 100, T).extraLives).toBe(0);
  });

  it('awards both lives if one big score crosses both thresholds', () => {
    expect(addPoints(newRun(0), 60_000, T).extraLives).toBe(2);
  });

  it('awards nothing past the last threshold', () => {
    const done = { score: 60_000, best: 60_000, livesAwarded: 2 };
    expect(addPoints(done, 100_000, T).extraLives).toBe(0);
  });

  it('ignores negative and fractional points', () => {
    expect(addPoints(newRun(0), -50, T).state.score).toBe(0);
    expect(addPoints(newRun(0), 99.9, T).state.score).toBe(99);
  });
});

describe('formatScore', () => {
  it('pads to six digits like an arcade counter', () => {
    expect(formatScore(0)).toBe('000000');
    expect(formatScore(1200)).toBe('001200');
  });

  it('caps at the counter width and never goes negative', () => {
    expect(formatScore(12_345_678)).toBe('999999');
    expect(formatScore(-5)).toBe('000000');
  });
});

describe('enemy points', () => {
  it.each(ENEMY_TYPES)('%s is worth a positive number of points', (type) => {
    expect(ENEMIES[type].points).toBeGreaterThan(0);
  });

  it('a flyer is worth more than a walker', () => {
    expect(ENEMIES['alien-flyer'].points).toBeGreaterThan(ENEMIES['alien-walker'].points);
  });
});

describe('save data', () => {
  it('uses one versioned key', () => {
    expect(SAVE_KEY).toBe('contro.save.v1');
  });

  it('round-trips', () => {
    const data = { version: 1 as const, bestScore: 4200 };
    expect(parseSave(serializeSave(data))).toEqual(data);
  });

  it('falls back to defaults for missing, corrupt, wrong-version or bad data', () => {
    expect(parseSave(null)).toEqual(DEFAULT_SAVE);
    expect(parseSave('{not json')).toEqual(DEFAULT_SAVE);
    expect(parseSave('42')).toEqual(DEFAULT_SAVE);
    expect(parseSave('null')).toEqual(DEFAULT_SAVE);
    expect(parseSave('{"version":2,"bestScore":5}')).toEqual(DEFAULT_SAVE);
    expect(parseSave('{"version":1,"bestScore":-3}')).toEqual(DEFAULT_SAVE);
    expect(parseSave('{"version":1,"bestScore":"lots"}')).toEqual(DEFAULT_SAVE);
    expect(parseSave('{"version":1,"bestScore":12.7}')).toEqual({ version: 1, bestScore: 12 });
  });
});
