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
export function controlsGuide(
  keys: Bindings,
  pad: PadBindings,
  fullscreenKey: string,
  touch = false,
): GuideRow[] {
  const k = (codes: readonly string[]) => codes.map(keyLabel).join(' ');
  const p = (buttons: readonly number[], stick = false) =>
    [...unique(buttons.map(padLabel)), ...(stick ? ['STICK'] : [])].join(' ');
  const pairs = keys.left.map((code, i) => {
    const right = keys.right[i];
    return right ? `${keyLabel(code)}/${keyLabel(right)}` : keyLabel(code);
  });
  // On a touch screen the keys column shows the on-screen controls instead (M3.11).
  const second: SixLabels = touch
    ? TOUCH_GUIDE
    : [pairs.join(' '), k(keys.up), k(keys.down), k(keys.jump), k(keys.fire), k(keys.pause)];
  const fullscreen = touch ? TOUCH_FULLSCREEN : keyLabel(fullscreenKey);
  return [
    ['MOVE', second[0], p([...pad.buttons.left, ...pad.buttons.right], true)],
    ['AIM UP', second[1], p(pad.buttons.up, true)],
    ['CROUCH', second[2], p(pad.buttons.down, true)],
    ['JUMP', second[3], p(pad.buttons.jump)],
    ['FIRE', second[4], p(pad.buttons.fire)],
    ['PAUSE', second[5], p(pad.buttons.pause)],
    ['FULLSCREEN', fullscreen, ''],
  ];
}

/** The on-screen controls' labels, as the buttons show them (src/systems/TouchControls.ts). */
export const TOUCH_LABELS = { jump: 'JUMP', fire: 'FIRE', pause: 'II', fullscreen: '[ ]' } as const;
type SixLabels = readonly [string, string, string, string, string, string];
const TOUCH_GUIDE: SixLabels = [
  'STICK',
  'STICK UP',
  'STICK DOWN',
  TOUCH_LABELS.jump,
  TOUCH_LABELS.fire,
  TOUCH_LABELS.pause,
] as const;
const TOUCH_FULLSCREEN = TOUCH_LABELS.fullscreen;
