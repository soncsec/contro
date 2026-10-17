import Phaser from 'phaser';
import { LEVELS } from '../assets/manifest';
import {
  DIALOGUE_CARD,
  GAME_HEIGHT,
  GAME_WIDTH,
  HEALTH,
  GRAVITY_Y,
  PARALLAX_BACK_FACTOR,
  RIFLE_DAMAGE,
} from '../config/tuning';
import { CAMPAIGN } from '../data/campaign';
import { ENEMIES, ENEMY_TYPES } from '../data/enemies';
import { Bullets } from '../entities/Bullets';
import { Effects } from '../entities/Effects';
import { Enemies, type EnemySnapshot } from '../entities/Enemies';
import { Hud } from '../entities/Hud';
import { Player, type PlayerSnapshot } from '../entities/Player';
import { afterExit } from '../logic/campaign';
import { respawnPoint } from '../logic/health';
import { DEFAULT_KEY_BINDINGS, type ActionFrame } from '../logic/input';
import { readLevelLayout, type LevelLayout } from '../logic/levelMap';
import { KeyboardInput } from '../systems/KeyboardInput';

export interface LevelSceneData {
  level?: string;
}

/** State the e2e test hook reads. */
export interface LevelSnapshot {
  level: string;
  /**
   * Gameplay clock in ms: the sum of the frame steps the movement and weapon rules
   * received. After a stall Phaser caps the step, so this can run behind wall-clock time.
   */
  timeMs: number;
  widthPx: number;
  player: PlayerSnapshot;
  cameraX: number;
  bullets: {
    active: number;
    fired: number;
    firedDiagonal: number;
    impacts: number;
    lastShot: { x: number; y: number; aim: string } | null;
  };
  enemies: EnemySnapshot[];
  /** True once the player has reached the exit and the room is fading out. */
  exiting: boolean;
  /** Furthest x the player has reached, and where they would respawn now. */
  reachedX: number;
  respawnAt: { x: number; y: number };
  gameOver: boolean;
}

const DEFAULT_LEVEL = 'corridor-test';

const NOTHING = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  fire: false,
  pause: false,
};
/** Input used while the level fades out after the exit: the marine stops. */
const NO_INPUT: ActionFrame = { held: NOTHING, pressed: NOTHING };

/**
 * Plays one level: the Tiled map, its collision rectangles, a parallax background,
 * the player, and a camera that follows the player within the level's edges.
 */
export class LevelScene extends Phaser.Scene {
  private levelKey = DEFAULT_LEVEL;
  private layout!: LevelLayout;
  private player!: Player;
  private keyboard!: KeyboardInput;
  private bullets!: Bullets;
  private effects!: Effects;
  private enemies!: Enemies;
  private elapsedMs = 0;
  /** Set once the player reaches the exit; input is ignored while the scene fades out. */
  private exiting = false;
  private gameOver = false;
  private reachedX = 0;
  private hud!: Hud;
  private back: Phaser.GameObjects.TileSprite | null = null;

  constructor() {
    super('Level');
  }

  init(data: LevelSceneData): void {
    this.levelKey = data.level ?? DEFAULT_LEVEL;
    this.elapsedMs = 0;
    this.exiting = false;
    this.gameOver = false;
    this.reachedX = 0;
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

    this.effects = new Effects(this);
    this.bullets = new Bullets(this, (x, y, direction) => {
      // The impact art is drawn for a wall on the right; its right edge goes on the hit point.
      this.effects.play('wall-impact', x - direction * 8, y, direction < 0);
    });
    this.physics.add.overlap(this.bullets.group, solids, (bullet) => {
      this.bullets.hit(bullet as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody);
    });

    this.enemies = new Enemies(this, this.layout.enemies, (type, x, y) => {
      this.effects.play(ENEMIES[type].deathEffect, x, y);
    });
    this.physics.add.collider(this.enemies.group, solids);
    this.physics.add.overlap(this.bullets.group, this.enemies.group, (bullet, enemy) => {
      const tip = this.bullets.absorb(bullet as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody);
      if (!tip) return;
      this.enemies.damage(enemy as Phaser.GameObjects.GameObject, RIFLE_DAMAGE);
      this.effects.play('hit', tip.x, tip.y, tip.direction < 0);
    });

    // Touching a live enemy hurts the marine.
    this.physics.add.overlap(this.player.sprite, this.enemies.group, (_player, enemy) => {
      const damage = this.enemies.contactDamage(enemy as Phaser.GameObjects.GameObject);
      if (damage > 0) this.player.hurt(damage, (enemy as Phaser.GameObjects.Sprite).x);
    });
    this.hud = new Hud(this);

    // Reaching the exit shows this room's card, then the next room.
    const { exit } = this.layout;
    const exitZone = this.add.zone(
      exit.x + exit.width / 2,
      exit.y + exit.height / 2,
      exit.width,
      exit.height,
    );
    this.physics.add.existing(exitZone, true);
    this.physics.add.overlap(this.player.sprite, exitZone, () => this.reachExit());

    this.cameras.main.setBounds(0, 0, widthPx, heightPx);
    this.cameras.main.startFollow(this.player.sprite, true);
    this.cameras.main.fadeIn(DIALOGUE_CARD.fadeMs);
  }

  override update(_time: number, deltaMs: number): void {
    this.elapsedMs += deltaMs;
    const input = this.keyboard.frame();
    const { shot, event } = this.player.update(deltaMs, this.exiting ? NO_INPUT : input);
    if (shot) this.bullets.fire(shot);
    if (!this.player.dead) this.reachedX = Math.max(this.reachedX, this.player.snapshot().x);
    if (event === 'respawn') {
      const at = this.respawnAt();
      this.player.respawn(at.x, at.y);
    } else if (event === 'game-over') {
      this.showGameOver();
    }
    const p = this.player.snapshot();
    this.hud.update(p.hp, p.lives);
    this.bullets.update();
    this.enemies.update(deltaMs);
    if (this.back) this.back.tilePositionX = this.cameras.main.scrollX * PARALLAX_BACK_FACTOR;
  }

  private respawnAt(): { x: number; y: number } {
    return respawnPoint(this.layout.playerStart, this.layout.checkpoints, this.reachedX);
  }

  /** Out of lives: show GAME OVER, then restart this level with full lives. */
  private showGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'GAME OVER', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ff4fd8',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);
    this.time.delayedCall(HEALTH.gameOverMs, () => {
      this.cameras.main.fadeOut(DIALOGUE_CARD.fadeMs);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.restart({ level: this.levelKey });
      });
    });
  }

  private reachExit(): void {
    if (this.exiting || this.player.dead) return;
    this.exiting = true;
    const { card, nextLevel } = afterExit(CAMPAIGN, this.levelKey);
    this.cameras.main.fadeOut(DIALOGUE_CARD.fadeMs);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Dialogue', { card, nextLevel });
    });
  }

  /** Test hook: hurt the player as if touched by something just in front of them. */
  hurtPlayer(damage: number): void {
    const p = this.player.snapshot();
    this.player.hurt(damage, p.x + (p.facing === 'left' ? -1 : 1));
  }

  /** Test hook: move the player (feet stay on the same line). */
  teleportPlayer(x: number): void {
    this.player.teleport(x);
  }

  snapshot(): LevelSnapshot {
    return {
      level: this.levelKey,
      timeMs: Math.round(this.elapsedMs),
      widthPx: this.layout.widthPx,
      player: this.player.snapshot(),
      cameraX: Math.round(this.cameras.main.scrollX),
      bullets: {
        active: this.bullets.active,
        fired: this.bullets.fired,
        firedDiagonal: this.bullets.firedDiagonal,
        impacts: this.bullets.impacts,
        lastShot: this.bullets.lastShot && {
          x: Math.round(this.bullets.lastShot.x),
          y: Math.round(this.bullets.lastShot.y),
          aim: this.bullets.lastShot.aim,
        },
      },
      enemies: this.enemies.snapshot(),
      exiting: this.exiting,
      reachedX: this.reachedX,
      respawnAt: this.respawnAt(),
      gameOver: this.gameOver,
    };
  }
}
