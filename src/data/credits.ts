/**
 * The credits that roll after the ending (M5.4). Wording of the maker line chosen by the owner
 * (2026-10-21); the rest follows CREDITS.md. Each line fits the 320 px screen in the 8 px font
 * (tests/unit/credits.test.ts). A heading starts a group; blank lines space them.
 */
export interface CreditLine {
  text: string;
  heading?: boolean;
}

const h = (text: string): CreditLine => ({ text, heading: true });
const t = (text: string): CreditLine => ({ text });
const gap = t('');

export const CREDITS: readonly CreditLine[] = [
  h('CONTRO'),
  gap,
  t('A GAME BY KEITH SONCRANT'),
  t('github.com/soncsec/contro'),
  gap,
  gap,
  h('ART'),
  t('ANSIMUZ (LUIS ZUNO)'),
  t('LEGACY COLLECTION - CC0'),
  t('WARPED, GOTHICVANIA,'),
  t('EXPLOSIONS AND MAGIC'),
  gap,
  h('MUSIC'),
  t('ANSIMUZ (LUIS ZUNO) - CC0'),
  t('CYBER RUNNER'),
  t('DARK HAPPY WORLD'),
  t('GOTHICVANIA GHOST TOWN'),
  t('BOSS FIGHT 2'),
  t("HERO'S DETERMINATION"),
  gap,
  h('SOUND EFFECTS'),
  t('KENNEY - CC0'),
  gap,
  h('FONT'),
  t('PRESS START 2P'),
  t('BY CODEMAN38 - SIL OFL 1.1'),
  gap,
  h('BUILT WITH'),
  t('PHASER, TYPESCRIPT, VITE'),
  gap,
  gap,
  h('THANKS FOR PLAYING'),
];

/** Longest line, in characters, that fits the screen in the 8 px font with a margin. */
export const CREDIT_LINE_MAX = 36;
