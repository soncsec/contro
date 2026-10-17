/**
 * Campaign order and dialogue card checks. Pure, so the data can be validated in unit tests.
 */
export interface Step {
  level: string;
  exitCard: string;
}

/** The card to show after `level`'s exit and the level to play next (wrapping to the first). */
export function afterExit(
  campaign: readonly Step[],
  level: string,
): { card: string; nextLevel: string } {
  const i = campaign.findIndex((s) => s.level === level);
  const step = campaign[i];
  const next = campaign[(i + 1) % campaign.length];
  if (!step || !next) throw new Error(`level ${level} is not in the campaign`);
  return { card: step.exitCard, nextLevel: next.level };
}

/** Problems with a campaign: unknown levels or cards, or a level listed twice. */
export function validateCampaign(
  campaign: readonly Step[],
  levels: readonly string[],
  cards: readonly string[],
): string[] {
  const problems: string[] = [];
  if (campaign.length === 0) problems.push('campaign is empty');
  const seen = new Set<string>();
  for (const step of campaign) {
    if (!levels.includes(step.level)) problems.push(`unknown level "${step.level}"`);
    if (!cards.includes(step.exitCard)) problems.push(`unknown card "${step.exitCard}"`);
    if (seen.has(step.level)) problems.push(`level "${step.level}" is listed twice`);
    seen.add(step.level);
  }
  return problems;
}

/** Problems with a dialogue card's text: too many lines, too-long lines, or none. */
export function validateCardText(
  lines: readonly string[],
  maxLines: number,
  maxLineChars: number,
): string[] {
  const problems: string[] = [];
  if (lines.length === 0) problems.push('card has no lines');
  if (lines.length > maxLines) problems.push(`card has ${lines.length} lines (max ${maxLines})`);
  lines.forEach((line, i) => {
    if (line.length > maxLineChars) {
      problems.push(`line ${i + 1} has ${line.length} characters (max ${maxLineChars})`);
    }
    if (line.trim() !== line || line === '') problems.push(`line ${i + 1} is blank or padded`);
  });
  return problems;
}
