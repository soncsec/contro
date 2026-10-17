import type Phaser from 'phaser';
import type { AssetGroup } from '../assets/manifest';
import type { AssetPreviewScene } from '../scenes/AssetPreviewScene';

/**
 * Test-only hook for Playwright (Star Destroyer ADR-006). It is loaded only in
 * the e2e build (`vite build --mode e2e`), so the build players get never includes it.
 */
export interface TestHook {
  /** The key of the scene that is running, or null while loading. */
  scene(): string | null;
  /** The asset group the preview scene is showing, or null if it isn't running. */
  previewGroup(): AssetGroup | null;
  /** Number of pages in the preview scene, or null if it isn't running. */
  previewPageCount(): number | null;
}

declare global {
  interface Window {
    __contro?: TestHook;
  }
}

export function installTestHook(game: Phaser.Game): void {
  window.__contro = {
    scene: () => game.scene.getScenes(true)[0]?.scene.key ?? null,
    previewGroup: () =>
      game.scene.isActive('AssetPreview')
        ? (game.scene.getScene('AssetPreview') as AssetPreviewScene).currentGroup
        : null,
    previewPageCount: () =>
      game.scene.isActive('AssetPreview')
        ? (game.scene.getScene('AssetPreview') as AssetPreviewScene).pageCount
        : null,
  };
}
