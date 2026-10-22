import Phaser from 'phaser';
import { LEVELS } from '../assets/manifest';
import {
  AIR_JUMP_RING_SQUASH,
  CHEAT_EXTRA_LIVES,
  CONTINUE,
  DIALOGUE_CARD,
  GAME_WIDTH,
  GRAVITY_Y,
  HEALTH,
  PARALLAX_BACK_FACTOR,
  PLATFORMS,
  PLAYER_BODY,
  RIFLE_DAMAGE,
  SCORING,
} from '../config/tuning';
import { sceneFor } from '../data/baseStages';
import { BOSS_TYPES } from '../data/bosses';
import { CAMPAIGN } from '../data/campaign';
import { ENEMIES, ENEMY_TYPES, type EnemyType } from '../data/enemies';
import { Bullets } from '../entities/Bullets';
import { Effects } from '../entities/Effects';
import { Enemies, type EnemySnapshot } from '../entities/Enemies';
import { EnemyShots } from '../entities/EnemyShots';
import { Hud } from '../entities/Hud';
import { Player, type PlayerSnapshot } from '../entities/Player';
import { afterExit, levelLabel, stepFor } from '../logic/campaign';
import { standingOn } from '../logic/ground';
import { respawnPoint } from '../logic/health';
import { reachLevel } from '../logic/save';
import { groundAt } from '../logic/spawner';
import { addPoints, newRun, type ScoreState } from '../logic/score';
import { NO_CHEATS, applyCheat, type CheatId, type CheatState } from '../logic/cheats';
import { NO_ACTIONS, type ActionFrame } from '../logic/input';
import { readLevelLayout, type LevelLayout } from '../logic/levelMap';
import { BossFight, type BossFightSnapshot } from '../systems/BossFight';
import { showGameOverText, showLevelBanner } from '../systems/LevelOverlays';
import { PlayerInput } from '../systems/PlayerInput';
import { RunnerSpawners } from '../systems/RunnerSpawners';
import { GameSound } from '../systems/GameSound';
import type { MusicKey } from '../assets/manifest';
import { Blimps, type BlimpSnapshot, type PickupSnapshot } from '../entities/Blimps';
import { BLIMP, PICKUPS, WEAPON_TYPES, type PickupKind, type WeaponType } from '../data/weapons';
import { nextWeapon } from '../logic/pickups';
import { SaveStore } from '../systems/SaveStore';

/** What carries from room to room: the score and lives. */
export interface RunState {
  score: number;
  lives: number;
  /** Health carried in from the previous room (full health if missing). */
  hp?: number;
  /** Cheats switched on in this run (they carry from room to room). */
  cheats?: CheatState;
  /** Continues left after game over (M3.4); a fresh run has CONTINUE.count. */
  continues?: number;
  /** The weapon in hand (M4.1); the rifle if missing. */
  weapon?: WeaponType;
  /** R, rapid fire (M7.1); none if missing. */
  rapid?: boolean;
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
    firedDown: number;
    lastShot: { x: number; y: number; aim: string } | null;
  };
  enemies: EnemySnapshot[];
  /** Runners sent in from the screen's edge so far (M3.14). */
  runnersSpawned: number;
  /** Weapon blimps in flight and letters on the ground (M4.1). */
  blimps: BlimpSnapshot[];
  pickups: PickupSnapshot[];
  /** Bullets fired (a spread shot fires three). */
  bulletsFired: number;
  enemyShots: { active: number; fired: number; landed: number };
  /** True once the player has reached the exit and the room is fading out. */
  exiting: boolean;
  /** Furthest x the player has reached, and where they would respawn now. */
  reachedX: number;
  respawnAt: { x: number; y: number };
  gameOver: boolean;
  /** Continues left in this run (M3.4). */
  continues: number;
  score: { score: number; best: number };
  cheats: CheatState;
  /** Current level and section shown in the HUD, e.g. "1-2". */
  label: string;
  bannerVisible: boolean;
  /** Asset keys of the parallax scenery layers, back to front. */
  scenery: string[];
  /** Left edge of the exit, in level pixels. */
  exitX: number;
  airJumps: number;
  /** The boss fight, if this section has one (M3.2). */
  boss: BossFightSnapshot | null;
}

/** The first section of the campaign, when no section is named. */
const DEFAULT_LEVEL = CAMPAIGN[0]?.level ?? 'steelworks-1';

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
  /** Double jumps made in this room (for tests). */
  private airJumps = 0;
  /** Set once the player reaches the exit; input is ignored while the scene fades out. */
  private exiting = false;
  private gameOver = false;
  private reachedX = 0;
  private hud!: Hud;
  /** Current level and section, e.g. "1-2". */
  private label = '';
  private bannerVisible = false;
  private score: ScoreState = newRun(0);
  private cheats: CheatState = NO_CHEATS;
  /** Continues left in this run (M3.4). */
  private continues: number = CONTINUE.count;
  /** The run as it was when this room started (for Restart room). */
  private runAtStart: RunState | null = null;
  private back: Phaser.GameObjects.TileSprite | null = null;
  /** Parallax scenery from the map's image layers, with how fast each scrolls. */
  private scenery: { sprite: Phaser.GameObjects.TileSprite; factor: number }[] = [];
  /** The section's boss fight, if its map has one (M3.2). */
  private bossFight: BossFight | null = null;
  /** Runners sent in from the screen's edge (M3.14). */
  private spawners!: RunnerSpawners;
  /** Weapon blimps and their pickups (M4.1). */
  private blimps!: Blimps;

  constructor() {
    super('Level');
  }

  init(data: LevelSceneData): void {
    this.levelKey = data.level ?? DEFAULT_LEVEL;
    this.runAtStart = data.run ?? null;
    this.cheats = data.run?.cheats ?? NO_CHEATS;
    this.continues = data.run?.continues ?? CONTINUE.count;
    this.skipRoomOnResume = false;
    this.score = { ...newRun(SaveStore.load().bestScore), score: data.run?.score ?? 0 };
    // Thresholds already passed before this room don't award again.
    this.score.livesAwarded = SCORING.extraLifeAt.filter((t) => this.score.score >= t).length;
    this.elapsedMs = 0;
    this.airJumps = 0;
    this.exiting = false;
    this.gameOver = false;
    this.reachedX = 0;
  }

  create(): void {
    const level = LEVELS.find((l) => l.key === this.levelKey);
    if (!level) throw new Error(`unknown level ${this.levelKey}`);
    this.layout = readLevelLayout(
      this.cache.tilemap.get(level.key)?.data,
      ENEMY_TYPES,
      BOSS_TYPES,
      PICKUPS,
    );
    const { widthPx, heightPx } = this.layout;

    // Far background: fixed to the camera, scrolled slowly for depth.
    // (Fields outlive a scene restart, so clear what the previous map made.)
    this.back = null;
    this.scenery = this.layout.parallax.map(({ key, y, factor }) => ({
      sprite: this.add
        .tileSprite(0, y, GAME_WIDTH, this.textures.get(key).getSourceImage().height, key)
        .setOrigin(0)
        .setScrollFactor(0),
      factor,
    }));
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
    // Props (M4.3: the corridor's cryo pods, server racks…), then catwalks and pit edges.
    if (map.getLayer('props')) map.createLayer('props', tilesets);
    // Catwalks and pit edges, drawn over the room.
    if (map.getLayer('platforms')) map.createLayer('platforms', tilesets);

    // Collision rectangles become invisible static bodies. Catwalks (platforms) only block
    // from above. The marine and the enemies that walk stand on them; bullets, orbs and
    // flyers pass through.
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
      this.runAtStart?.weapon ?? 'rifle',
      this.runAtStart?.rapid ?? false,
    );
    this.player.invincible = this.cheats.invincible;
    this.player.onHurt = (result) =>
      GameSound.play(result === 'died' ? 'sfx-player-die' : 'sfx-hurt');
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
    // Bullets and enemy shots pass through terrain (M3.12): nothing here collides them with it.
    this.bullets = new Bullets(this);

    this.enemies = new Enemies(this, this.layout.enemies, (type, x, y) => {
      GameSound.play('sfx-enemy-die');
      this.effects.play(ENEMIES[type].deathEffect, x, y);
      this.addScore(ENEMIES[type].points);
    });
    this.physics.add.collider(this.enemies.group, solids);
    // Walkers the map puts on a walkway stay on it (flyers fly through).
    this.physics.add.collider(this.enemies.group, platforms, undefined, (enemy) =>
      this.enemies.standsOnPlatforms(enemy as Phaser.GameObjects.GameObject),
    );
    this.physics.add.overlap(this.bullets.group, this.enemies.group, (bullet, enemy) => {
      const tip = this.bullets.absorb(bullet as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody);
      if (!tip) return;
      const before = this.enemies.alive;
      this.enemies.damage(enemy as Phaser.GameObjects.GameObject, RIFLE_DAMAGE);
      // A hit that doesn't kill clanks; a kill plays the enemy's death sound instead.
      if (this.enemies.alive === before) GameSound.play('sfx-enemy-hit');
      this.effects.play('hit', tip.x, tip.y, tip.direction < 0);
    });

    // Touching a live enemy hurts the marine.
    this.physics.add.overlap(this.player.sprite, this.enemies.group, (_player, enemy) => {
      const damage = this.enemies.contactDamage(enemy as Phaser.GameObjects.GameObject);
      if (damage > 0) this.player.hurt(damage, (enemy as Phaser.GameObjects.Sprite).x);
    });
    // Enemy shots hurt the marine; a lobbed mortar shell bursts bigger where it was aimed.
    this.enemyShots = new EnemyShots(this, (x, y) => {
      GameSound.play('sfx-blast');
      this.effects.play('enemy-death', x, y);
    });
    type Orb = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    this.physics.add.overlap(this.player.sprite, this.enemyShots.group, (_player, orb) => {
      const o = orb as Orb;
      if (!o.active || this.player.dead) return;
      if (this.player.hurt(1, o.x) !== 'ignored') this.effects.play('hit', o.x, o.y);
      this.enemyShots.remove(o);
    });
    const step = stepFor(CAMPAIGN, this.levelKey);
    // Remember the furthest level reached, for the title's level select (M3.5). A cheated run
    // doesn't count, as it doesn't for the best score.
    if (!this.cheats.used) SaveStore.update((save) => reachLevel(save, step.stage));
    this.label = levelLabel(step);
    this.hud = new Hud(this, this.label);
    this.bannerVisible = true;
    showLevelBanner(this, this.label, step.name, () => (this.bannerVisible = false));
    this.bossFight = BossFight.create({
      scene: this,
      layout: this.layout,
      player: this.player,
      bullets: this.bullets,
      effects: this.effects,
      enemyShots: this.enemyShots,
      hud: this.hud,
      addScore: (points) => this.addScore(points),
      win: () => this.reachExit(),
      levelMusic: step.music as MusicKey | null,
    });
    this.spawners = new RunnerSpawners(this.layout, this.enemies);
    // The level's music; it keeps playing from one section to the next (M3.6).
    GameSound.loadMusic(this);
    GameSound.music(step.music as MusicKey | null);
    // Weapon blimps and the letters they drop (M4.1).
    this.blimps = new Blimps(this, this.layout.blimps, (x, y) => {
      GameSound.play('sfx-blast');
      this.effects.play('enemy-death', x, y);
      this.addScore(BLIMP.points);
    });
    this.physics.add.overlap(this.bullets.group, this.blimps.blimpGroup, (bullet, blimp) => {
      const tip = this.bullets.absorb(bullet as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody);
      if (!tip) return;
      this.blimps.damage(blimp as Phaser.GameObjects.GameObject, RIFLE_DAMAGE);
      this.effects.play('hit', tip.x, tip.y, tip.direction < 0);
    });
    this.physics.add.collider(this.blimps.pickupGroup, solids);
    this.physics.add.overlap(this.player.sprite, this.blimps.pickupGroup, (_player, pickup) => {
      if (this.player.dead) return;
      const carries = this.blimps.collect(pickup as Phaser.GameObjects.GameObject);
      if (!carries) return;
      // A health pickup restores full health (owner request 2026-10-19); R is rapid fire for
      // any weapon (M7.1); another letter is a weapon.
      if (carries === 'health') this.player.restoreHealth();
      else if (carries === 'rapid') this.player.rapid = true;
      else this.player.weaponType = carries;
      GameSound.play('sfx-extra-life');
    });

    // Reaching the exit shows this room's card, then the next room.
    const { exit } = this.layout;
    const exitZone = this.add.zone(
      exit.x + exit.width / 2,
      exit.y + exit.height / 2,
      exit.width,
      exit.height,
    );
    this.physics.add.existing(exitZone, true);
    // A boss section's exit opens only once the boss is destroyed.
    this.physics.add.overlap(this.player.sprite, exitZone, () => {
      if (!this.bossFight || this.bossFight.exitOpen) this.reachExit();
    });

    this.cameras.main.setBounds(0, 0, widthPx, heightPx);
    this.cameras.main.startFollow(this.player.sprite, true);
    this.cameras.main.fadeIn(DIALOGUE_CARD.fadeMs);
  }

  override update(_time: number, deltaMs: number): void {
    this.elapsedMs += deltaMs;
    const input = this.controls.frame();
    if (input.pressed.pause && !this.exiting && !this.gameOver && !this.player.dead) {
      this.scene.launch('Pause', { level: this.levelKey, scene: 'Level' });
      this.scene.pause();
      return;
    }
    const body = this.player.sprite.body;
    const ground = standingOn(
      { left: body.left, right: body.right, bottom: body.bottom },
      this.layout.colliders,
    );
    const { shot, airJump, event } = this.player.update(deltaMs, this.exiting ? NO_INPUT : input, {
      onPlatform: ground === 'platform',
    });
    if (shot && this.bullets.fire(shot)) GameSound.play('sfx-shot');
    if (airJump) {
      this.airJumps++;
      this.effects.play('air-jump-ring', airJump.x, airJump.y, false, 4, AIR_JUMP_RING_SQUASH);
    }
    if (!this.player.dead) this.reachedX = Math.max(this.reachedX, this.player.snapshot().x);
    if (event === 'respawn') {
      // Dying in the boss fight starts it again from the checkpoint before the arena.
      this.bossFight?.onRespawn();
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
    this.hud.update(
      p.hp,
      p.lives,
      this.score.score,
      this.score.best,
      this.cheats.used,
      p.weapon,
      p.rapid,
    );
    this.bullets.update();
    const p0 = this.player.snapshot();
    // Enemies aim at the middle of the marine's body.
    // Invisible (cheat): enemies can't see him to aim or dive.
    const target =
      p0.dead || this.cheats.invisible ? null : { x: p0.x, y: p0.feetY - PLAYER_BODY.height / 2 };
    const view = { left: this.cameras.main.scrollX, right: this.cameras.main.scrollX + GAME_WIDTH };
    for (const shot of this.enemies.update(deltaMs, target, view, this.layout.heightPx)) {
      if (this.enemyShots.fire(shot)) GameSound.play('sfx-enemy-shot');
    }
    this.spawners.update(deltaMs, view);
    this.blimps.update(deltaMs, view, this.layout.heightPx);
    this.bossFight?.update(deltaMs, target);
    this.enemyShots.update();
    const scrollX = this.cameras.main.scrollX;
    if (this.back) this.back.tilePositionX = scrollX * PARALLAX_BACK_FACTOR;
    for (const { sprite, factor } of this.scenery) sprite.tilePositionX = scrollX * factor;
  }

  private respawnAt(): { x: number; y: number } {
    return respawnPoint(this.layout.playerStart, this.layout.checkpoints, this.reachedX);
  }

  /** Out of lives: show GAME OVER, then the continue screen (M3.4). */
  private showGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    GameSound.music(null);
    showGameOverText(this);
    this.time.delayedCall(HEALTH.gameOverMs, () => {
      this.cameras.main.fadeOut(DIALOGUE_CARD.fadeMs);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        // Continuing restarts this section with full lives and the score back to zero.
        this.scene.start('Continue', {
          level: this.levelKey,
          left: this.continues,
          score: this.score.score,
        });
      });
    });
  }

  private reachExit(): void {
    if (this.exiting || this.player.dead) return;
    this.exiting = true;
    const { cards, nextLevel } = afterExit(CAMPAIGN, this.levelKey);
    this.cameras.main.fadeOut(DIALOGUE_CARD.fadeMs);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // Between sections of a level, go straight on; cards play only at a level's end.
      const [card, ...more] = cards;
      const run = this.run();
      if (card) this.scene.start('Dialogue', { card, more, nextLevel, run });
      else if (nextLevel) this.scene.start(sceneFor(nextLevel), { level: nextLevel, run });
      else this.scene.start('End', { score: run.score });
    });
  }

  /** Adds points, awards any extra lives, and saves a new best score. */
  addScore(points: number): void {
    const r = addPoints(this.score, points, SCORING.extraLifeAt);
    // A cheated run never sets a best score.
    const best = this.cheats.used ? this.score.best : r.state.best;
    const newBest = best > this.score.best;
    this.score = { ...r.state, best };
    if (r.extraLives > 0) {
      this.player.addLives(r.extraLives);
      GameSound.play('sfx-extra-life');
    }
    if (newBest) SaveStore.update((save) => ({ ...save, bestScore: this.score.best }));
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
      case 'next-weapon': {
        const weapon = nextWeapon(this.player.weaponType, WEAPON_TYPES);
        this.player.weaponType = weapon;
        return weapon.replace('-', ' ').toUpperCase();
      }
    }
  }

  /** The score, lives, health and cheats to carry into the next room. */
  run(): RunState {
    const p = this.player.snapshot();
    return {
      score: this.score.score,
      lives: p.lives,
      hp: p.hp,
      cheats: this.cheats,
      continues: this.continues,
      weapon: p.weapon,
      rapid: p.rapid,
    };
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

  /** Test hook: hurt the boss as if hit by bullets. */
  hurtBoss(damage: number): void {
    this.bossFight?.damage(damage);
  }

  /** Test hook: send a blimp carrying `carries` across from the right edge of the view. */
  spawnBlimp(carries: PickupKind, y: number): void {
    const left = this.cameras.main.scrollX;
    this.blimps.launch(carries, y, 'right', { left, right: left + GAME_WIDTH });
  }

  /** Test hook: put an enemy on the ground at x, as a map would. */
  placeEnemy(type: EnemyType, x: number): void {
    const y = groundAt(this.layout.colliders, x);
    if (y === null) throw new Error(`no ground at x ${x}`);
    this.enemies.place({ x, y, enemy: type });
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
        firedDown: this.bullets.firedDown,
        lastShot: this.bullets.lastShot && {
          x: Math.round(this.bullets.lastShot.x),
          y: Math.round(this.bullets.lastShot.y),
          aim: this.bullets.lastShot.aim,
        },
      },
      enemies: this.enemies.snapshot(),
      runnersSpawned: this.enemies.runnersSpawned,
      ...this.blimps.snapshot(),
      bulletsFired: this.bullets.bulletsFired,
      enemyShots: {
        active: this.enemyShots.active,
        fired: this.enemyShots.fired,
        landed: this.enemyShots.landed,
      },
      exiting: this.exiting,
      reachedX: this.reachedX,
      respawnAt: this.respawnAt(),
      gameOver: this.gameOver,
      continues: this.continues,
      score: { score: this.score.score, best: this.score.best },
      cheats: this.cheats,
      label: this.label,
      bannerVisible: this.bannerVisible,
      scenery: this.scenery.map((l) => l.sprite.texture.key),
      exitX: this.layout.exit.x,
      airJumps: this.airJumps,
      boss: this.bossFight?.snapshot() ?? null,
    };
  }
}
