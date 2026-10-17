import Phaser from 'phaser';
import { HEALTH } from '../config/tuning';

const PIP = { width: 6, height: 4, gap: 2 } as const;
const ORIGIN = { x: 6, y: 6 } as const;
const COLORS = { full: 0x4fe3c1, empty: 0x1c2a33, border: 0x07060d, text: '#e6eef7' } as const;
const DEPTH = 100;

/** Health pips and lives in the top-left corner, fixed to the screen. */
export class Hud {
  private readonly pips: Phaser.GameObjects.Rectangle[] = [];
  private readonly lives: Phaser.GameObjects.Text;

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
  }

  update(hp: number, lives: number): void {
    this.pips.forEach((pip, i) => pip.setFillStyle(i < hp ? COLORS.full : COLORS.empty));
    this.lives.setText(`x${lives}`);
  }
}
