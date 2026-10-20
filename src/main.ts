import Phaser from 'phaser';
import './style.css';
import { BACKGROUND_COLOR, FONT, GAME_HEIGHT, GAME_WIDTH } from './config/tuning';
import { integerZoom } from './logic/scaling';
import { installFullscreenKey } from './systems/Fullscreen';
import { TouchControls } from './systems/TouchControls';
import { AssetPreviewScene } from './scenes/AssetPreviewScene';
import { BaseScene } from './scenes/BaseScene';
import { ContinueScene } from './scenes/ContinueScene';
import { DialogueScene } from './scenes/DialogueScene';
import { EndScene } from './scenes/EndScene';
import { LevelScene } from './scenes/LevelScene';
import { PauseScene } from './scenes/PauseScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';

// Load the font before any text is drawn, so the first frame doesn't use the fallback.
await document.fonts.load(`8px ${FONT.family}`).catch(() => undefined);

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
  input: { gamepad: true },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [
    PreloadScene,
    TitleScene,
    LevelScene,
    BaseScene,
    PauseScene,
    DialogueScene,
    ContinueScene,
    EndScene,
    AssetPreviewScene,
  ],
});

const container = document.getElementById('game');
if (container) {
  installFullscreenKey(container);
  // On touch screens: the on-screen controls (M3.11), and landscape only (owner, 2026-10-18).
  // In portrait the page shows "turn your phone sideways" (src/style.css) and the game waits.
  if (TouchControls.install(container)) {
    const portrait = window.matchMedia('(orientation: portrait)');
    const follow = (): void => (portrait.matches ? game.pause() : game.resume());
    portrait.addEventListener('change', follow);
    follow();
  }
}

window.addEventListener('resize', () => {
  const zoom = zoomForWindow();
  if (game.scale.zoom !== zoom) game.scale.setZoom(zoom);
});

// The e2e build adds a test hook. Vite replaces MODE at build time, so this
// branch and the hook module are left out of the normal build entirely.
if (import.meta.env.MODE === 'e2e') {
  void import('./debug/testHook').then(({ installTestHook }) => installTestHook(game));
}
