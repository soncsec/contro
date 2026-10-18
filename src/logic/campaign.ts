/**
 * Campaign order (ADR-C10: levels made of sections) and dialogue card checks.
 * Pure, so the data can be validated in unit tests.
 */
export interface CampaignLevel<Card extends string = string> {
  /** Level number, from 1. */
  stage: number;
  /** Shown in the banner when each of its sections starts. */
  name: string;
  /** Map keys (LEVELS in src/assets/manifest.ts), played in order. */
  sections: readonly string[];
  /** Card shown after the level's last section. */
  endCard: Card;
  /** Card shown before the level starts (used once the title screen exists, M3.4). */
  introCard?: Card;
}

/** One section in play order. */
export interface Step<Card extends string = string> {
  /** Map key. */
  level: string;
  stage: number;
  section: number;
  name: string;
  /** The card after this section, or null between sections of the same level. */
  exitCard: Card | null;
}

export function flattenCampaign<Card extends string>(
  levels: readonly CampaignLevel<Card>[],
): Step<Card>[] {
  return levels.flatMap((lv) =>
    lv.sections.map((map, i) => ({
      level: map,
      stage: lv.stage,
      section: i + 1,
      name: lv.name,
      exitCard: i === lv.sections.length - 1 ? lv.endCard : null,
    })),
  );
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

/**
 * What follows `level`'s exit: the card to show (null between sections of a level) and the
 * section to play next, wrapping from the last to the first.
 */
export function afterExit<Card extends string>(
  campaign: readonly Step<Card>[],
  level: string,
): { card: Card | null; nextLevel: string } {
  const i = campaign.findIndex((s) => s.level === level);
  const step = campaign[i];
  const next = campaign[(i + 1) % campaign.length];
  if (!step || !next) throw new Error(`level ${level} is not in the campaign`);
  return { card: step.exitCard, nextLevel: next.level };
}

/**
 * Problems with a campaign: levels not numbered 1, 2, 3…, a level with no sections or no
 * name, unknown maps or cards, or a map used twice.
 */
export function validateCampaign(
  levels: readonly CampaignLevel[],
  maps: readonly string[],
  cards: readonly string[],
): string[] {
  const problems: string[] = [];
  if (levels.length === 0) problems.push('campaign is empty');
  const seen = new Set<string>();
  levels.forEach((lv, i) => {
    if (lv.stage !== i + 1) problems.push(`level ${i + 1} is numbered ${lv.stage}`);
    if (lv.name.trim() === '') problems.push(`level ${lv.stage} has no name`);
    if (lv.sections.length === 0) problems.push(`level ${lv.stage} has no sections`);
    for (const map of lv.sections) {
      if (!maps.includes(map)) problems.push(`level ${lv.stage}: unknown map "${map}"`);
      if (seen.has(map)) problems.push(`map "${map}" is used twice`);
      seen.add(map);
    }
    for (const card of [lv.endCard, ...(lv.introCard ? [lv.introCard] : [])]) {
      if (!cards.includes(card)) problems.push(`level ${lv.stage}: unknown card "${card}"`);
    }
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
