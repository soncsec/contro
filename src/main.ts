import Phaser from 'phaser';
import './style.css';
import { BACKGROUND_COLOR, GAME_HEIGHT, GAME_WIDTH } from './config/tuning';
import { integerZoom } from './logic/scaling';
import { AssetPreviewScene } from './scenes/AssetPreviewScene';
import { DialogueScene } from './scenes/DialogueScene';
import { LevelScene } from './scenes/LevelScene';
import { PreloadScene } from './scenes/PreloadScene';

const zoomForWindow = (): number =>
  integerZoom(window.innerWidth, window.innerHeight, GAME_WIDTH, GAME_HEIGHT);

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: BACKGROUND_COLOR,
  pixelArt: true,
  roundPixels: true,
  scale: {
    // Whole-number zoom keeps pixels crisp; the page's CSS centers the canvas.
    mode: Phaser.Scale.NONE,
    zoom: zoomForWindow(),
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [PreloadScene, LevelScene, DialogueScene, AssetPreviewScene],
});

window.addEventListener('resize', () => {
  const zoom = zoomForWindow();
  if (game.scale.zoom !== zoom) game.scale.setZoom(zoom);
});

// The e2e build adds a test hook. Vite replaces MODE at build time, so this
// branch and the hook module are left out of the normal build entirely.
if (import.meta.env.MODE === 'e2e') {
  void import('./debug/testHook').then(({ installTestHook }) => installTestHook(game));
}
