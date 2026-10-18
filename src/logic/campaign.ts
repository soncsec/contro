/**
 * Campaign order and dialogue card checks. Pure, so the data can be validated in unit tests.
 */
export interface Step {
  level: string;
  exitCard: string;
  stage: number;
  section: number;
  name: string;
}

/** The label shown in the HUD: level number and section, e.g. "1-2". */
export function levelLabel(step: { stage: number; section: number }): string {
  return `${step.stage}-${step.section}`;
}

/** The campaign step for a map key. Throws if the map isn't in the campaign. */
export function stepFor<S extends Step>(campaign: readonly S[], level: string): S {
  const step = campaign.find((s) => s.level === level);
  if (!step) throw new Error(`level ${level} is not in the campaign`);
  return step;
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

/**
 * Problems with a campaign: unknown maps or cards, a map listed twice, or numbering that
 * isn't in order (levels from 1, sections from 1 within each level, no gaps), or a level
 * whose sections don't share one name.
 */
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
  campaign.forEach((step, i) => {
    const prev = campaign[i - 1];
    const expected = !prev
      ? { stage: 1, section: 1 }
      : step.stage === prev.stage
        ? { stage: prev.stage, section: prev.section + 1 }
        : { stage: prev.stage + 1, section: 1 };
    if (step.stage !== expected.stage || step.section !== expected.section) {
      problems.push(`"${step.level}" is ${levelLabel(step)}, expected ${levelLabel(expected)}`);
    }
    if (prev && step.stage === prev.stage && step.name !== prev.name) {
      problems.push(`level ${step.stage} has more than one name`);
    }
    if (step.name.trim() === '') problems.push(`"${step.level}" has no level name`);
  });
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
