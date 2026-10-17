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
