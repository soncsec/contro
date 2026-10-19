/**
 * Continues after game over (M3.4, owner decision 2026-10-18): continuing restarts the
 * section the marine died in, with full lives and the score back to zero, as in Contra.
 * A run has a limited number; with none left, game over returns to the title screen.
 */
export const CONTINUE_OPTIONS = ['CONTINUE', 'QUIT'] as const;
export type ContinueOption = (typeof CONTINUE_OPTIONS)[number];

/** The menu after game over: continue or quit while any are left, otherwise nothing. */
export function continueOptions(left: number): readonly ContinueOption[] {
  return left > 0 ? CONTINUE_OPTIONS : [];
}

/** Continues left after using one (never below zero). */
export function useContinue(left: number): number {
  return Math.max(0, Math.floor(left) - 1);
}
