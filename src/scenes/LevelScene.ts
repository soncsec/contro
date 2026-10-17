import Phaser from 'phaser';
import { LEVELS, animKey } from '../assets/manifest';
import {
  GAME_WIDTH,
  GRAVITY_Y,
  PARALLAX_BACK_FACTOR,
  PLAYER_BODY,
  PLAYER_FRAME,
} from '../config/tuning';
import { ENEMY_TYPES } from '../data/enemies';
import { bodyOffsetX, spriteYForFeet } from '../logic/body';
import { readLevelLayout, type LevelLayout } from '../logic/levelMap';

export interface LevelSceneData {
  level?: string;
}

/** State the e2e test hook reads. */
export interface LevelSnapshot {
  level: string;
  widthPx: number;
  player: { x: number; feetY: number; onFloor: boolean };
  cameraX: number;
}

const DEFAULT_LEVEL = 'corridor-test';

/**
 * Plays one level: the Tiled map, its collision rectangles, a parallax background,
 * the player, and a camera that follows the player within the level's edges.
 * Player controls arrive in M1.4; for now the marine stands at the start.
 */
export class LevelScene extends Phaser.Scene {
  private levelKey = DEFAULT_LEVEL;
  private layout!: LevelLayout;
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
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
    this.player = this.physics.add.sprite(
      start.x,
      spriteYForFeet(start.y, PLAYER_FRAME.height, PLAYER_BODY),
      'marine-idle',
    );
    this.player.body
      .setSize(PLAYER_BODY.width, PLAYER_BODY.height)
      .setOffset(bodyOffsetX(PLAYER_FRAME.width, PLAYER_BODY, false), PLAYER_BODY.offsetY);
    this.player.setCollideWorldBounds(true);
    this.player.play(animKey('marine-idle'));
    this.physics.add.collider(this.player, solids);

    this.cameras.main.setBounds(0, 0, widthPx, heightPx);
    this.cameras.main.startFollow(this.player, true);
  }

  override update(): void {
    if (this.back) this.back.tilePositionX = this.cameras.main.scrollX * PARALLAX_BACK_FACTOR;
  }

  /** Test hook: move the player (feet stay on the same line). */
  teleportPlayer(x: number): void {
    this.player.body.reset(x, this.player.y);
  }

  snapshot(): LevelSnapshot {
    const body = this.player.body;
    return {
      level: this.levelKey,
      widthPx: this.layout.widthPx,
      player: {
        x: Math.round(body.center.x),
        feetY: Math.round(body.bottom),
        onFloor: body.blocked.down,
      },
      cameraX: Math.round(this.cameras.main.scrollX),
    };
  }
}
