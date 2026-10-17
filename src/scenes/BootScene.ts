import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/tuning';

/**
 * Placeholder start screen for the M0 scaffold. Replaced by the preload and
 * level scenes in M1.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 8, 'CONTRO', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ff4fd8',
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 16, 'scaffold build', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#4fe3c1',
      })
      .setOrigin(0.5);
  }
}
