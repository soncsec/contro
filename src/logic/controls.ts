/**
 * The controls guide on the title screen (M3.10), built from the real bindings so it can
 * never disagree with them. Pure, so it is unit tested.
 */
import type { Bindings, PadBindings } from './input';

/** How a key code is written on screen: KeyA → A, ArrowLeft → LEFT, Escape → ESC. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return code.slice(5).toUpperCase();
  const named: Record<string, string> = { Escape: 'ESC', Space: 'SPACE', Enter: 'ENTER' };
  return named[code] ?? code.toUpperCase();
}

/** Standard-mapping gamepad button names (Xbox-style labels). */
const PAD_BUTTONS: Record<number, string> = {
  0: 'A',
  1: 'B',
  2: 'X',
  3: 'Y',
  4: 'LB',
  5: 'RB',
  6: 'LT',
  7: 'RT',
  8: 'BACK',
  9: 'START',
  12: 'D-PAD',
  13: 'D-PAD',
  14: 'D-PAD',
  15: 'D-PAD',
};

export function padLabel(button: number): string {
  return PAD_BUTTONS[button] ?? `B${button}`;
}

/** One row of the guide: what it does, its keys, its gamepad buttons. */
export type GuideRow = readonly [action: string, keys: string, pad: string];

const unique = (labels: string[]): string[] => [...new Set(labels)];

/**
 * The guide's rows. Left and right are shown as pairs (LEFT/RIGHT, A/D); the left stick
 * also moves and aims, so directions list it after the d-pad.
 */
export function controlsGuide(keys: Bindings, pad: PadBindings, fullscreenKey: string): GuideRow[] {
  const k = (codes: readonly string[]) => codes.map(keyLabel).join(' ');
  const p = (buttons: readonly number[], stick = false) =>
    [...unique(buttons.map(padLabel)), ...(stick ? ['STICK'] : [])].join(' ');
  const pairs = keys.left.map((code, i) => {
    const right = keys.right[i];
    return right ? `${keyLabel(code)}/${keyLabel(right)}` : keyLabel(code);
  });
  return [
    ['MOVE', pairs.join(' '), p([...pad.buttons.left, ...pad.buttons.right], true)],
    ['AIM UP', k(keys.up), p(pad.buttons.up, true)],
    ['CROUCH', k(keys.down), p(pad.buttons.down, true)],
    ['JUMP', k(keys.jump), p(pad.buttons.jump)],
    ['FIRE', k(keys.fire), p(pad.buttons.fire)],
    ['PAUSE', k(keys.pause), p(pad.buttons.pause)],
    ['FULLSCREEN', keyLabel(fullscreenKey), ''],
  ];
}
