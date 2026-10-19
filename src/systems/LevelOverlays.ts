import Phaser from 'phaser';
import { FONT, GAME_HEIGHT, GAME_WIDTH, LEVEL_BANNER } from '../config/tuning';

/**
 * "LEVEL 1-2" and the level's name across the middle of the screen, then a fade (M2.14).
 * Calls `onGone` once it has faded away.
 */
export function showLevelBanner(
  scene: Phaser.Scene,
  label: string,
  name: string,
  onGone: () => void,
): void {
  const y = GAME_HEIGHT / 2 - 12;
  const title = scene.add
    .text(GAME_WIDTH / 2, y, `LEVEL ${label}`, {
      fontFamily: FONT.family,
      fontSize: FONT.large,
      color: '#ffd166',
    })
    .setOrigin(0.5);
  const sub = scene.add
    .text(GAME_WIDTH / 2, y + 18, name, {
      fontFamily: FONT.family,
      fontSize: FONT.size,
      color: '#4fe3c1',
    })
    .setOrigin(0.5);
  // A dark band behind the text keeps it readable over any scenery.
  const band = scene.add
    .rectangle(0, y - 14, GAME_WIDTH, 40, 0x07060d, 0.85)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(99);
  const banner = [band, title, sub];
  title.setScrollFactor(0).setDepth(100);
  sub.setScrollFactor(0).setDepth(100);
  scene.time.delayedCall(LEVEL_BANNER.showMs, () => {
    scene.tweens.add({
      targets: banner,
      alpha: 0,
      duration: LEVEL_BANNER.fadeMs,
      onComplete: () => {
        for (const t of banner) t.destroy();
        onGone();
      },
    });
  });
}

/** GAME OVER across the middle of the screen. */
export function showGameOverText(scene: Phaser.Scene): void {
  scene.add
    .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'GAME OVER', {
      fontFamily: FONT.family,
      fontSize: FONT.large,
      color: '#ff4fd8',
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(100);
}
