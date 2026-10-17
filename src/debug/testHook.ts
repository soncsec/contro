import type Phaser from 'phaser';
import type { AssetGroup } from '../assets/manifest';
import type { AssetPreviewScene } from '../scenes/AssetPreviewScene';
import type { DialogueScene } from '../scenes/DialogueScene';
import type { LevelScene, LevelSnapshot } from '../scenes/LevelScene';

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
  /** Level state, or null if no level is running. */
  level(): LevelSnapshot | null;
  /** The dialogue card on screen, or null if none is showing. */
  dialogue(): ReturnType<DialogueScene['snapshot']> | null;
  /** Hurts the player as if touched from the front. Throws if no level is running. */
  hurtPlayer(damage: number): void;
  /** Moves the player to x (level pixels). Throws if no level is running. */
  teleportPlayer(x: number): void;
}

declare global {
  interface Window {
    __contro?: TestHook;
  }
}

export function installTestHook(game: Phaser.Game): void {
  const level = (): LevelScene | null =>
    game.scene.isActive('Level') ? (game.scene.getScene('Level') as LevelScene) : null;

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
    level: () => level()?.snapshot() ?? null,
    dialogue: () =>
      game.scene.isActive('Dialogue')
        ? (game.scene.getScene('Dialogue') as DialogueScene).snapshot()
        : null,
    hurtPlayer: (damage) => {
      const scene = level();
      if (!scene) throw new Error('no level is running');
      if (!Number.isFinite(damage))
        throw new Error(`hurtPlayer needs a number, got ${String(damage)}`);
      scene.hurtPlayer(damage);
    },
    teleportPlayer: (x) => {
      const scene = level();
      if (!scene) throw new Error('no level is running');
      if (!Number.isFinite(x)) throw new Error(`teleportPlayer needs a number, got ${String(x)}`);
      scene.teleportPlayer(x);
    },
  };
}
