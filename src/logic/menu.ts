/** Menu navigation: up/down move (wrapping), jump/fire choose, pause goes back. */
import type { ActionState } from './input';

export type MenuStep = { index: number; choose: boolean; back: boolean };

export function stepMenu(index: number, count: number, pressed: ActionState): MenuStep {
  if (count <= 0) return { index: 0, choose: false, back: pressed.pause };
  let next = index;
  if (pressed.up) next -= 1;
  if (pressed.down) next += 1;
  next = ((next % count) + count) % count;
  return { index: next, choose: pressed.jump || pressed.fire, back: pressed.pause };
}

export const TITLE_OPTIONS = ['START', 'LEVEL', 'CONTROLS', 'MORE GAMES'] as const;
export type TitleOption = (typeof TITLE_OPTIONS)[number];

/** The title menu: the LEVEL row appears only once a later level has been reached (M3.5). */
export function titleOptions(furthestLevel: number): TitleOption[] {
  return TITLE_OPTIONS.filter((o) => o !== 'LEVEL' || furthestLevel > 1);
}
