/**
 * Scoring (M2.9): points for enemies destroyed, extra lives at score thresholds (as in Contra),
 * and the best score.
 */
export interface ScoreState {
  score: number;
  /** Best score so far, including this run. */
  best: number;
  /** How many extra-life thresholds have been passed this run. */
  livesAwarded: number;
}

export const newRun = (best: number): ScoreState => ({ score: 0, best, livesAwarded: 0 });

/**
 * Adds points. Returns the new state and how many extra lives were earned by this addition
 * (one per threshold crossed, in order).
 */
export function addPoints(
  s: ScoreState,
  points: number,
  thresholds: readonly number[],
): { state: ScoreState; extraLives: number } {
  const score = s.score + Math.max(0, Math.floor(points));
  let livesAwarded = s.livesAwarded;
  while (livesAwarded < thresholds.length && score >= (thresholds[livesAwarded] ?? Infinity)) {
    livesAwarded++;
  }
  return {
    state: { score, best: Math.max(s.best, score), livesAwarded },
    extraLives: livesAwarded - s.livesAwarded,
  };
}

/** Score as shown in the HUD: zero-padded to a fixed width, like an arcade counter. */
export function formatScore(score: number, digits = 6): string {
  const clamped = Math.min(Math.max(0, Math.floor(score)), 10 ** digits - 1);
  return String(clamped).padStart(digits, '0');
}
