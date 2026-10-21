/**
 * The credits roll (M5.4): lines scroll up the screen at a steady speed. Pure, unit tested;
 * EndScene draws it.
 */

/** Top of the credits block `ms` into the roll: starts just below the screen, then rises. */
export function creditsTop(ms: number, startY: number, speed: number): number {
  return startY - (Math.max(0, ms) / 1000) * speed;
}

/** True once the whole block (`lines` tall, `lineHeight` apart) has scrolled off the top. */
export function creditsDone(top: number, lines: number, lineHeight: number): boolean {
  return top + lines * lineHeight < 0;
}
