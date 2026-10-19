import Phaser from 'phaser';
import { FONT, GAME_WIDTH, HEALTH } from '../config/tuning';
import { WEAPONS, type WeaponType } from '../data/weapons';
import { formatScore } from '../logic/score';

const PIP = { width: 6, height: 4, gap: 2 } as const;
const ORIGIN = { x: 6, y: 6 } as const;
const COLORS = {
  full: 0x4fe3c1,
  empty: 0x1c2a33,
  border: 0x07060d,
  text: '#e6eef7',
  best: '#ffd166',
  cheat: '#ff4fd8',
} as const;
const LINE = 9;
const DEPTH = 100;
/** The boss's health bar, on the HUD's second line between CHEAT and the best score. */
const BOSS_BAR = { x: 112, y: 16, width: 112, height: 5, fill: 0xff4f4f, back: 0x2a1418 } as const;

/** Health pips and lives top-left, score and best score top-right, fixed to the screen. */
export class Hud {
  private readonly pips: Phaser.GameObjects.Rectangle[] = [];
  private readonly lives: Phaser.GameObjects.Text;
  /** The pickup weapon in hand, as its letter after the lives (M4.1); empty for the rifle. */
  private readonly weapon: Phaser.GameObjects.Text;
  private readonly score: Phaser.GameObjects.Text;
  private readonly best: Phaser.GameObjects.Text;
  private readonly cheat: Phaser.GameObjects.Text;
  private readonly bossName: Phaser.GameObjects.Text;
  private readonly bossBack: Phaser.GameObjects.Rectangle;
  private readonly bossFill: Phaser.GameObjects.Rectangle;

  /** `label` is the current level and section, e.g. "1-2", shown top centre (M2.14). */
  constructor(scene: Phaser.Scene, label: string) {
    for (let i = 0; i < HEALTH.maxHp; i++) {
      const pip = scene.add
        .rectangle(
          ORIGIN.x + i * (PIP.width + PIP.gap),
          ORIGIN.y,
          PIP.width,
          PIP.height,
          COLORS.full,
        )
        .setOrigin(0)
        .setStrokeStyle(1, COLORS.border)
        .setScrollFactor(0)
        .setDepth(DEPTH);
      this.pips.push(pip);
    }
    this.lives = scene.add
      .text(ORIGIN.x + HEALTH.maxHp * (PIP.width + PIP.gap) + 4, ORIGIN.y - 3, '', {
        fontFamily: FONT.family,
        fontSize: FONT.size,
        color: COLORS.text,
      })
      .setScrollFactor(0)
      .setDepth(DEPTH);
    this.weapon = scene.add
      .text(0, ORIGIN.y - 3, '', { fontFamily: FONT.family, fontSize: FONT.size })
      .setScrollFactor(0)
      .setDepth(DEPTH);
    const right = GAME_WIDTH - ORIGIN.x;
    const style = { fontFamily: FONT.family, fontSize: FONT.size, color: COLORS.text };
    this.score = scene.add
      .text(right, ORIGIN.y - 3, '', style)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH);
    this.best = scene.add
      .text(right, ORIGIN.y - 3 + LINE, '', { ...style, color: COLORS.best })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH);
    scene.add
      .text(GAME_WIDTH / 2, ORIGIN.y - 3, label, { ...style, color: COLORS.best })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH);
    // Shown for the rest of a run once any cheat is used (the best score isn't saved then).
    this.cheat = scene.add
      .text(ORIGIN.x, ORIGIN.y - 3 + LINE, 'CHEAT', { ...style, color: COLORS.cheat })
      .setScrollFactor(0)
      .setDepth(DEPTH)
      .setVisible(false);
    // Boss fights (M3.2): its name and a health bar, shown while the fight is on.
    this.bossName = scene.add
      .text(BOSS_BAR.x - 4, BOSS_BAR.y - 2, '', { ...style, color: COLORS.cheat })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH)
      .setVisible(false);
    this.bossBack = scene.add
      .rectangle(BOSS_BAR.x, BOSS_BAR.y, BOSS_BAR.width, BOSS_BAR.height, BOSS_BAR.back)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.border)
      .setScrollFactor(0)
      .setDepth(DEPTH)
      .setVisible(false);
    this.bossFill = scene.add
      .rectangle(BOSS_BAR.x, BOSS_BAR.y, BOSS_BAR.width, BOSS_BAR.height, BOSS_BAR.fill)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH)
      .setVisible(false);
  }

  /** Shows the boss's name and health (share of full health, 0–1); null hides them. */
  boss(name: string | null, share = 1): void {
    const on = name !== null;
    this.bossName.setVisible(on).setText(name ?? '');
    this.bossBack.setVisible(on);
    this.bossFill.setVisible(on && share > 0);
    this.bossFill.width = Math.round(BOSS_BAR.width * Math.max(0, Math.min(1, share)));
  }

  update(
    hp: number,
    lives: number,
    score: number,
    best: number,
    cheated: boolean,
    weapon: WeaponType = 'rifle',
  ): void {
    this.cheat.setVisible(cheated);
    this.pips.forEach((pip, i) => pip.setFillStyle(i < hp ? COLORS.full : COLORS.empty));
    this.lives.setText(`x${lives}`);
    const stats = WEAPONS[weapon];
    this.weapon
      .setText(stats.pickup ? stats.letter : '')
      .setColor(stats.color)
      .setX(this.lives.x + this.lives.width + 6);
    this.score.setText(formatScore(score));
    this.best.setText(`HI ${formatScore(best)}`);
  }
}
