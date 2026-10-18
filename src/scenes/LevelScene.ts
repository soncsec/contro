import Phaser from 'phaser';
import { LEVELS } from '../assets/manifest';
import {
  DIALOGUE_CARD,
  GAME_HEIGHT,
  GAME_WIDTH,
  HEALTH,
  PLATFORMS,
  PLAYER_BODY,
  CHEAT_EXTRA_LIVES,
  SCORING,
  GRAVITY_Y,
  PARALLAX_BACK_FACTOR,
  RIFLE_DAMAGE,
} from '../config/tuning';
import { CAMPAIGN } from '../data/campaign';
import { ENEMIES, ENEMY_TYPES } from '../data/enemies';
import { Bullets } from '../entities/Bullets';
import { Effects } from '../entities/Effects';
import { Enemies, type EnemySnapshot } from '../entities/Enemies';
import { EnemyShots } from '../entities/EnemyShots';
import { Hud } from '../entities/Hud';
import { Player, type PlayerSnapshot } from '../entities/Player';
import { afterExit } from '../logic/campaign';
import { standingOn } from '../logic/ground';
import { respawnPoint } from '../logic/health';
import { addPoints, newRun, type ScoreState } from '../logic/score';
import { NO_CHEATS, applyCheat, type CheatId, type CheatState } from '../logic/cheats';
import { NO_ACTIONS, type ActionFrame } from '../logic/input';
import { readLevelLayout, type LevelLayout } from '../logic/levelMap';
import { PlayerInput } from '../systems/PlayerInput';
import { SaveStore } from '../systems/SaveStore';

/** What carries from room to room: the score and lives. */
export interface RunState {
  score: number;
  lives: number;
  /** Health carried in from the previous room (full health if missing). */
  hp?: number;
  /** Cheats switched on in this run (they carry from room to room). */
  cheats?: CheatState;
}

export interface LevelSceneData {
  level?: string;
  /** Score and lives carried in from the previous room; a fresh run if missing. */
  run?: RunState;
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
  enemyShots: { active: number; fired: number };
  /** True once the player has reached the exit and the room is fading out. */
  exiting: boolean;
  /** Furthest x the player has reached, and where they would respawn now. */
  reachedX: number;
  respawnAt: { x: number; y: number };
  gameOver: boolean;
  score: { score: number; best: number };
  cheats: CheatState;
}

const DEFAULT_LEVEL = 'corridor-test';

/** Input used while the level fades out after the exit: the marine stops. */
const NO_INPUT: ActionFrame = { held: NO_ACTIONS, pressed: NO_ACTIONS };

/**
 * Plays one level: the Tiled map, its collision rectangles, a parallax background,
 * the player, and a camera that follows the player within the level's edges.
 */
export class LevelScene extends Phaser.Scene {
  private levelKey = DEFAULT_LEVEL;
  private layout!: LevelLayout;
  private player!: Player;
  private controls!: PlayerInput;
  private bullets!: Bullets;
  private effects!: Effects;
  private enemies!: Enemies;
  private enemyShots!: EnemyShots;
  private elapsedMs = 0;
  /** Set once the player reaches the exit; input is ignored while the scene fades out. */
  private exiting = false;
  private gameOver = false;
  private reachedX = 0;
  private hud!: Hud;
  private score: ScoreState = newRun(0);
  private cheats: CheatState = NO_CHEATS;
  /** The run as it was when this room started (for Restart room). */
  private runAtStart: RunState | null = null;
  private back: Phaser.GameObjects.TileSprite | null = null;

  constructor() {
    super('Level');
  }

  init(data: LevelSceneData): void {
    this.levelKey = data.level ?? DEFAULT_LEVEL;
    this.runAtStart = data.run ?? null;
    this.cheats = data.run?.cheats ?? NO_CHEATS;
    this.skipRoomOnResume = false;
    this.score = { ...newRun(SaveStore.load().bestScore), score: data.run?.score ?? 0 };
    // Thresholds already passed before this room don't award again.
    this.score.livesAwarded = SCORING.extraLifeAt.filter((t) => this.score.score >= t).length;
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
    const tilesets = Object.entries(level.tilesets).map(([name, imageKey]) => {
      const tileset = map.addTilesetImage(name, imageKey);
      if (!tileset) throw new Error(`tileset ${name} missing from ${level.key}`);
      return tileset;
    });
    map.createLayer('background', tilesets);
    // Catwalks and pit edges, drawn over the room.
    if (map.getLayer('platforms')) map.createLayer('platforms', tilesets);

    // Collision rectangles become invisible static bodies. Catwalks (platforms) only block
    // from above, and only the marine stands on them: bullets, orbs and enemies pass through.
    const solids = this.physics.add.staticGroup();
    const platforms = this.physics.add.staticGroup();
    for (const c of this.layout.colliders) {
      const zone = this.add.zone(c.x + c.width / 2, c.y + c.height / 2, c.width, c.height);
      (c.type === 'platform' ? platforms : solids).add(zone);
      const body = zone.body as Phaser.Physics.Arcade.StaticBody;
      if (c.type === 'platform') {
        body.checkCollision.down = false;
        body.checkCollision.left = false;
        body.checkCollision.right = false;
      }
    }

    this.physics.world.gravity.y = GRAVITY_Y;
    // Side walls only: there is no floor below the map, so pits are open.
    this.physics.world.setBounds(0, 0, widthPx, heightPx);
    this.physics.world.setBoundsCollision(true, true, false, false);

    const start = this.layout.playerStart;
    this.player = new Player(
      this,
      start.x,
      start.y,
      this.runAtStart?.lives ?? HEALTH.lives,
      this.runAtStart?.hp ?? HEALTH.maxHp,
    );
    this.player.invincible = this.cheats.invincible;
    this.physics.add.collider(this.player.sprite, solids);
    // Down + jump drops through a catwalk for a moment.
    this.physics.add.collider(
      this.player.sprite,
      platforms,
      undefined,
      () => !this.player.droppingThrough,
    );
    this.controls = new PlayerInput(this);
    // Keys released while paused would otherwise look held (or freshly pressed) on resume.
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.controls.clear();
      if (this.skipRoomOnResume) {
        this.skipRoomOnResume = false;
        this.reachExit();
      }
    });

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
      this.addScore(ENEMIES[type].points);
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
    // Enemy shots hurt the marine and pop on walls and floors.
    this.enemyShots = new EnemyShots(this);
    type Orb = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    this.physics.add.overlap(this.player.sprite, this.enemyShots.group, (_player, orb) => {
      const o = orb as Orb;
      if (!o.active || this.player.dead) return;
      if (this.player.hurt(1, o.x) !== 'ignored') this.effects.play('hit', o.x, o.y);
      this.enemyShots.remove(o);
    });
    this.physics.add.overlap(this.enemyShots.group, solids, (orb) => {
      const o = orb as Orb;
      if (o.active) this.effects.play('hit', o.x, o.y);
      this.enemyShots.remove(o);
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
    const input = this.controls.frame();
    if (input.pressed.pause && !this.exiting && !this.gameOver && !this.player.dead) {
      this.scene.launch('Pause', { level: this.levelKey });
      this.scene.pause();
      return;
    }
    const body = this.player.sprite.body;
    const ground = standingOn(
      { left: body.left, right: body.right, bottom: body.bottom },
      this.layout.colliders,
    );
    const { shot, event } = this.player.update(deltaMs, this.exiting ? NO_INPUT : input, {
      onPlatform: ground === 'platform',
    });
    if (shot) this.bullets.fire(shot);
    if (!this.player.dead) this.reachedX = Math.max(this.reachedX, this.player.snapshot().x);
    if (event === 'respawn') {
      const at = this.respawnAt();
      this.player.respawn(at.x, at.y);
    } else if (event === 'game-over') {
      this.showGameOver();
    }
    // Below the bottom of the map: fell into a pit. Checked after a respawn has moved him back,
    // or the frame he respawns (still down the pit) would count as a second fall.
    if (!this.player.dead && body.top > this.layout.heightPx + PLATFORMS.fallMargin) {
      this.player.fall();
    }
    const p = this.player.snapshot();
    this.hud.update(p.hp, p.lives, this.score.score, this.score.best, this.cheats.used);
    this.bullets.update();
    const p0 = this.player.snapshot();
    // Enemies aim at the middle of the marine's body.
    // Invisible (cheat): enemies can't see him to aim or dive.
    const target =
      p0.dead || this.cheats.invisible ? null : { x: p0.x, y: p0.feetY - PLAYER_BODY.height / 2 };
    for (const shot of this.enemies.update(deltaMs, target)) this.enemyShots.fire(shot);
    this.enemyShots.update();
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
        // A fresh run: score back to zero, full lives (the best score is kept).
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
      this.scene.start('Dialogue', { card, nextLevel, run: this.run() });
    });
  }

  /** Adds points, awards any extra lives, and saves a new best score. */
  addScore(points: number): void {
    const r = addPoints(this.score, points, SCORING.extraLifeAt);
    // A cheated run never sets a best score.
    const best = this.cheats.used ? this.score.best : r.state.best;
    const newBest = best > this.score.best;
    this.score = { ...r.state, best };
    if (r.extraLives > 0) this.player.addLives(r.extraLives);
    if (newBest) SaveStore.save({ version: 1, bestScore: this.score.best });
  }

  /** A cheat was entered on the pause screen. Returns a short line confirming it. */
  applyCheat(id: CheatId): string {
    this.cheats = applyCheat(this.cheats, id);
    this.player.invincible = this.cheats.invincible;
    switch (id) {
      case 'extra-lives':
        this.player.addLives(CHEAT_EXTRA_LIVES);
        return `+${CHEAT_EXTRA_LIVES} LIVES`;
      case 'invincible':
        return this.cheats.invincible ? 'INVINCIBLE ON' : 'INVINCIBLE OFF';
      case 'invisible':
        return this.cheats.invisible ? 'INVISIBLE ON' : 'INVISIBLE OFF';
      case 'skip-room':
        this.skipRoomOnResume = true;
        return 'SKIPPING ROOM';
    }
  }

  /** The score, lives, health and cheats to carry into the next room. */
  run(): RunState {
    const p = this.player.snapshot();
    return { score: this.score.score, lives: p.lives, hp: p.hp, cheats: this.cheats };
  }

  /** Room skip (cheat): leave through the exit as soon as the game resumes. */
  private skipRoomOnResume = false;

  /** The run this room started with (null on a fresh run), for Restart room. */
  get startingRun(): RunState | null {
    return this.runAtStart;
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
      enemyShots: { active: this.enemyShots.active, fired: this.enemyShots.fired },
      exiting: this.exiting,
      reachedX: this.reachedX,
      respawnAt: this.respawnAt(),
      gameOver: this.gameOver,
      score: { score: this.score.score, best: this.score.best },
      cheats: this.cheats,
    };
  }
}
