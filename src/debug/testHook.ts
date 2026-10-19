import type Phaser from 'phaser';
import { HEALTH } from '../config/tuning';
import { GameSound } from '../systems/GameSound';
import type { AssetGroup } from '../assets/manifest';
import type { AssetPreviewScene } from '../scenes/AssetPreviewScene';
import type { ContinueScene } from '../scenes/ContinueScene';
import type { DialogueScene } from '../scenes/DialogueScene';
import type { EndScene } from '../scenes/EndScene';
import type { PauseScene } from '../scenes/PauseScene';
import type { LevelScene, LevelSnapshot } from '../scenes/LevelScene';
import type { TitleScene } from '../scenes/TitleScene';

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
  /** The title screen's state, or null if it isn't showing. */
  title(): ReturnType<TitleScene['snapshot']> | null;
  /** The highlighted pause-menu option, or null if the game isn't paused. */
  pauseMenu(): string | null;
  /** The last cheat confirmation on the pause screen, or null. */
  cheatMessage(): string | null;
  /** Sound on or off, the music that should be playing, and recent sounds (M3.6). */
  sound(): ReturnType<typeof GameSound.snapshot>;
  /** Frames per second the game is managing right now (Phaser's measurement). */
  fps(): number;
  /** The dialogue card on screen, or null if none is showing. */
  dialogue(): ReturnType<DialogueScene['snapshot']> | null;
  /** The continue screen after game over, or null if it isn't showing (M3.4). */
  continueMenu(): ReturnType<ContinueScene['snapshot']> | null;
  /** The end screen after the last level, or null if it isn't showing (M3.4). */
  end(): ReturnType<EndScene['snapshot']> | null;
  /** Adds points as if enemies were destroyed. Throws if no level is running. */
  addScore(points: number): void;
  /** Hurts the player as if touched from the front. Throws if no level is running. */
  hurtPlayer(damage: number): void;
  /** Hurts the boss as if hit by bullets. Throws if no level is running. */
  hurtBoss(damage: number): void;
  /** Sends a blimp carrying a pickup (a weapon or health) across from the right edge at height y. */
  spawnBlimp(carries: 'machine-gun' | 'spread' | 'health', y: number): void;
  /** Moves the player to x (level pixels). Throws if no level is running. */
  teleportPlayer(x: number): void;
  /**
   * Leaves whatever is showing and starts a fresh run in the named map, optionally with only
   * this many continues left (M3.4).
   */
  startLevel(key: string, continues?: number): void;
}

declare global {
  interface Window {
    __contro?: TestHook;
  }
}

export function installTestHook(game: Phaser.Game): void {
  // A paused level still reports its state.
  const level = (): LevelScene | null =>
    game.scene.isActive('Level') || game.scene.isPaused('Level')
      ? (game.scene.getScene('Level') as LevelScene)
      : null;

  window.__contro = {
    startLevel: (key, continues) => {
      if (continues !== undefined && !(Number.isInteger(continues) && continues >= 0))
        throw new Error(`startLevel needs a whole number of continues, got ${String(continues)}`);
      for (const scene of game.scene.getScenes(false)) {
        if (scene.scene.key !== 'Level' && scene.scene.isActive()) scene.scene.stop();
      }
      const run =
        continues === undefined ? {} : { run: { score: 0, lives: HEALTH.lives, continues } };
      game.scene.start('Level', { level: key, ...run });
    },
    scene: () => game.scene.getScenes(true)[0]?.scene.key ?? null,
    fps: () => Math.round(game.loop.actualFps),
    sound: () => GameSound.snapshot(),
    previewGroup: () =>
      game.scene.isActive('AssetPreview')
        ? (game.scene.getScene('AssetPreview') as AssetPreviewScene).currentGroup
        : null,
    previewPageCount: () =>
      game.scene.isActive('AssetPreview')
        ? (game.scene.getScene('AssetPreview') as AssetPreviewScene).pageCount
        : null,
    level: () => level()?.snapshot() ?? null,
    title: () =>
      game.scene.isActive('Title') ? (game.scene.getScene('Title') as TitleScene).snapshot() : null,
    cheatMessage: () =>
      game.scene.isActive('Pause')
        ? (game.scene.getScene('Pause') as PauseScene).cheatMessage
        : null,
    pauseMenu: () =>
      game.scene.isActive('Pause') ? (game.scene.getScene('Pause') as PauseScene).selected : null,
    dialogue: () =>
      game.scene.isActive('Dialogue')
        ? (game.scene.getScene('Dialogue') as DialogueScene).snapshot()
        : null,
    continueMenu: () =>
      game.scene.isActive('Continue')
        ? (game.scene.getScene('Continue') as ContinueScene).snapshot()
        : null,
    end: () =>
      game.scene.isActive('End') ? (game.scene.getScene('End') as EndScene).snapshot() : null,
    addScore: (points) => {
      const scene = level();
      if (!scene) throw new Error('no level is running');
      if (!Number.isFinite(points))
        throw new Error(`addScore needs a number, got ${String(points)}`);
      scene.addScore(points);
    },
    hurtPlayer: (damage) => {
      const scene = level();
      if (!scene) throw new Error('no level is running');
      if (!Number.isFinite(damage))
        throw new Error(`hurtPlayer needs a number, got ${String(damage)}`);
      scene.hurtPlayer(damage);
    },
    hurtBoss: (damage) => {
      const scene = level();
      if (!scene) throw new Error('no level is running');
      if (!Number.isFinite(damage))
        throw new Error(`hurtBoss needs a number, got ${String(damage)}`);
      scene.hurtBoss(damage);
    },
    spawnBlimp: (carries, y) => {
      const scene = level();
      if (!scene) throw new Error('no level is running');
      if (carries !== 'machine-gun' && carries !== 'spread' && carries !== 'health')
        throw new Error(`unknown pickup ${String(carries)}`);
      if (!Number.isFinite(y)) throw new Error(`spawnBlimp needs a number, got ${String(y)}`);
      scene.spawnBlimp(carries, y);
    },
    teleportPlayer: (x) => {
      const scene = level();
      if (!scene) throw new Error('no level is running');
      if (!Number.isFinite(x)) throw new Error(`teleportPlayer needs a number, got ${String(x)}`);
      scene.teleportPlayer(x);
    },
  };
}
