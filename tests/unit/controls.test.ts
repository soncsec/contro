import { describe, expect, it } from 'vitest';
import { controlsGuide, keyLabel, padLabel } from '../../src/logic/controls';
import { DEFAULT_KEY_BINDINGS, DEFAULT_PAD_BINDINGS } from '../../src/logic/input';

describe('keyLabel', () => {
  it.each([
    ['KeyA', 'A'],
    ['Digit5', '5'],
    ['ArrowLeft', 'LEFT'],
    ['Escape', 'ESC'],
    ['Space', 'SPACE'],
    ['Enter', 'ENTER'],
    ['Tab', 'TAB'],
  ])('%s is shown as %s', (code, label) => {
    expect(keyLabel(code)).toBe(label);
  });
});

describe('padLabel', () => {
  it('names standard-mapping buttons, and numbers unknown ones', () => {
    expect([0, 1, 2, 3, 9, 12, 15].map(padLabel)).toEqual([
      'A',
      'B',
      'X',
      'Y',
      'START',
      'D-PAD',
      'D-PAD',
    ]);
    expect(padLabel(17)).toBe('B17');
  });
});

describe('controlsGuide', () => {
  it('describes the default controls', () => {
    expect(controlsGuide(DEFAULT_KEY_BINDINGS, DEFAULT_PAD_BINDINGS, 'KeyF')).toEqual([
      ['MOVE', 'LEFT/RIGHT A/D', 'D-PAD STICK'],
      ['AIM UP', 'UP W', 'D-PAD STICK'],
      ['CROUCH', 'DOWN S', 'D-PAD STICK'],
      ['JUMP', 'SPACE Z K', 'A'],
      ['FIRE', 'X J', 'X B'],
      ['PAUSE', 'ESC P', 'START'],
      ['FULLSCREEN', 'F', ''],
    ]);
  });

  it('shows the on-screen controls instead of keys on a touch screen', () => {
    expect(controlsGuide(DEFAULT_KEY_BINDINGS, DEFAULT_PAD_BINDINGS, 'KeyF', true)).toEqual([
      ['MOVE', 'STICK', 'D-PAD STICK'],
      ['AIM UP', 'STICK UP', 'D-PAD STICK'],
      ['CROUCH', 'STICK DOWN', 'D-PAD STICK'],
      ['JUMP', 'JUMP', 'A'],
      ['FIRE', 'FIRE', 'X B'],
      ['PAUSE', 'II', 'START'],
      ['FULLSCREEN', '[ ]', ''],
    ]);
  });

  it('follows changed bindings, including an unpaired left key', () => {
    const keys = {
      ...DEFAULT_KEY_BINDINGS,
      left: ['KeyQ', 'KeyH'],
      right: ['KeyE'],
      fire: ['Enter'],
    };
    const pad = {
      ...DEFAULT_PAD_BINDINGS,
      buttons: { ...DEFAULT_PAD_BINDINGS.buttons, fire: [3] },
    };
    const rows = controlsGuide(keys, pad, 'KeyG');
    expect(rows[0]).toEqual(['MOVE', 'Q/E H', 'D-PAD STICK']);
    expect(rows[4]).toEqual(['FIRE', 'ENTER', 'Y']);
    expect(rows[6]).toEqual(['FULLSCREEN', 'G', '']);
  });

  it('fits the 320 px screen at 8 px a character in three columns', () => {
    const rows = controlsGuide(DEFAULT_KEY_BINDINGS, DEFAULT_PAD_BINDINGS, 'KeyF');
    for (const [action, keys, pad] of rows) {
      expect(action.length).toBeLessThanOrEqual(10);
      expect(keys.length).toBeLessThanOrEqual(14);
      expect(pad.length).toBeLessThanOrEqual(11);
    }
  });
});
