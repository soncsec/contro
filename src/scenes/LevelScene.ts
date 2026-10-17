import Phaser from 'phaser';
import { LEVELS } from '../assets/manifest';
import { GAME_WIDTH, GRAVITY_Y, PARALLAX_BACK_FACTOR } from '../config/tuning';
import { ENEMY_TYPES } from '../data/enemies';
import { Player, type PlayerSnapshot } from '../entities/Player';
import { DEFAULT_KEY_BINDINGS } from '../logic/input';
import { readLevelLayout, type LevelLayout } from '../logic/levelMap';
import { KeyboardInput } from '../systems/KeyboardInput';

export interface LevelSceneData {
  level?: string;
}

/** State the e2e test hook reads. */
export interface LevelSnapshot {
  level: string;
  widthPx: number;
  player: PlayerSnapshot;
  cameraX: number;
}

const DEFAULT_LEVEL = 'corridor-test';

/**
 * Plays one level: the Tiled map, its collision rectangles, a parallax background,
 * the player, and a camera that follows the player within the level's edges.
 */
export class LevelScene extends Phaser.Scene {
  private levelKey = DEFAULT_LEVEL;
  private layout!: LevelLayout;
  private player!: Player;
  private keyboard!: KeyboardInput;
  private back: Phaser.GameObjects.TileSprite | null = null;

  constructor() {
    super('Level');
  }

  init(data: LevelSceneData): void {
    this.levelKey = data.level ?? DEFAULT_LEVEL;
  }

  create(): void {
    const level = LEVELS.find((l) => l.key === this.levelKey);
    if (!level) throw new Error(`unknown level ${this.levelKey}`);
    this.layout = readLevelLayout(this.cache.tilemap.get(level.key)?.data, ENEMY_TYPES);
    const { widthPx, heightPx } = this.layout;

    // Far background: fixed to the camera, scrolled slowly for depth.
    if (this.layout.background) {
      this.back = this.add
        .tileSprite(0, 0, GAME_WIDTH, heightPx, this.layout.background)
        .setOrigin(0)
        .setScrollFactor(0);
    }

    const map = this.make.tilemap({ key: level.key });
    for (const [name, imageKey] of Object.entries(level.tilesets)) {
      const tileset = map.addTilesetImage(name, imageKey);
      if (!tileset) throw new Error(`tileset ${name} missing from ${level.key}`);
      map.createLayer('background', tileset);
    }

    // Collision rectangles become invisible static bodies. Platforms only block from above.
    const solids = this.physics.add.staticGroup();
    for (const c of this.layout.colliders) {
      const zone = this.add.zone(c.x + c.width / 2, c.y + c.height / 2, c.width, c.height);
      solids.add(zone);
      const body = zone.body as Phaser.Physics.Arcade.StaticBody;
      if (c.type === 'platform') {
        body.checkCollision.down = false;
        body.checkCollision.left = false;
        body.checkCollision.right = false;
      }
    }

    this.physics.world.gravity.y = GRAVITY_Y;
    // Side walls only: falling out of the bottom is handled with pits in M2.4.
    this.physics.world.setBounds(0, 0, widthPx, heightPx);
    this.physics.world.setBoundsCollision(true, true, false, false);

    const start = this.layout.playerStart;
    this.player = new Player(this, start.x, start.y);
    this.physics.add.collider(this.player.sprite, solids);
    this.keyboard = new KeyboardInput(this, DEFAULT_KEY_BINDINGS);

    this.cameras.main.setBounds(0, 0, widthPx, heightPx);
    this.cameras.main.startFollow(this.player.sprite, true);
  }

  override update(_time: number, deltaMs: number): void {
    this.player.update(deltaMs, this.keyboard.actions());
    if (this.back) this.back.tilePositionX = this.cameras.main.scrollX * PARALLAX_BACK_FACTOR;
  }

  /** Test hook: move the player (feet stay on the same line). */
  teleportPlayer(x: number): void {
    this.player.teleport(x);
  }

  snapshot(): LevelSnapshot {
    return {
      level: this.levelKey,
      widthPx: this.layout.widthPx,
      player: this.player.snapshot(),
      cameraX: Math.round(this.cameras.main.scrollX),
    };
  }
}
