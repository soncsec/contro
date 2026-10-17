import Phaser from 'phaser';
import { ASSETS, LEVELS, animKey } from '../assets/manifest';

/** Loads every asset and level map in the manifest and registers each sheet's default animation. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    for (const asset of ASSETS) {
      if (asset.kind === 'sheet') {
        this.load.spritesheet(asset.key, asset.path, {
          frameWidth: asset.frameWidth,
          frameHeight: asset.frameHeight,
        });
      } else {
        this.load.image(asset.key, asset.path);
      }
    }
    for (const level of LEVELS) this.load.tilemapTiledJSON(level.key, level.path);
  }

  create(): void {
    for (const asset of ASSETS) {
      if (asset.kind !== 'sheet') continue;
      this.anims.create({
        key: animKey(asset.key),
        frames: this.anims.generateFrameNumbers(asset.key, { start: 0, end: asset.frames - 1 }),
        frameRate: asset.frameRate,
        repeat: asset.loop ? -1 : 0,
      });
    }
    const next =
      new URLSearchParams(window.location.search).get('scene') === 'preview'
        ? 'AssetPreview'
        : 'Level';
    this.scene.start(next);
  }
}
