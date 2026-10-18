import Phaser from 'phaser';
import { GAME_WIDTH, HEALTH } from '../config/tuning';
import { formatScore } from '../logic/score';

const PIP = { width: 6, height: 4, gap: 2 } as const;
const ORIGIN = { x: 6, y: 6 } as const;
const COLORS = {
  full: 0x4fe3c1,
  empty: 0x1c2a33,
  border: 0x07060d,
  text: '#e6eef7',
  best: '#ffd166',
} as const;
const LINE = 9;
const DEPTH = 100;

/** Health pips and lives top-left, score and best score top-right, fixed to the screen. */
export class Hud {
  private readonly pips: Phaser.GameObjects.Rectangle[] = [];
  private readonly lives: Phaser.GameObjects.Text;
  private readonly score: Phaser.GameObjects.Text;
  private readonly best: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
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
        fontFamily: 'monospace',
        fontSize: '8px',
        color: COLORS.text,
      })
      .setScrollFactor(0)
      .setDepth(DEPTH);
    const right = GAME_WIDTH - ORIGIN.x;
    const style = { fontFamily: 'monospace', fontSize: '8px', color: COLORS.text };
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
  }

  update(hp: number, lives: number, score: number, best: number): void {
    this.pips.forEach((pip, i) => pip.setFillStyle(i < hp ? COLORS.full : COLORS.empty));
    this.lives.setText(`x${lives}`);
    this.score.setText(formatScore(score));
    this.best.setText(`HI ${formatScore(best)}`);
  }
}
