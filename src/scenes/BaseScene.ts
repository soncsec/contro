import Phaser from 'phaser';
import type { MusicKey } from '../assets/manifest';
import {
  BASE,
  CHEAT_EXTRA_LIVES,
  CONTINUE,
  DIALOGUE_CARD,
  HEALTH,
  SCORING,
  TOUCH,
} from '../config/tuning';
import { BASE_STAGES, sceneFor, type BaseStage } from '../data/baseStages';
import { CAMPAIGN } from '../data/campaign';
import { ENEMIES } from '../data/enemies';
import { WEAPONS, WEAPON_TYPES, type WeaponType } from '../data/weapons';
import { Effects } from '../entities/Effects';
import { Hud } from '../entities/Hud';
import {
  fireShots,
  hitCore,
  incomingAt,
  initialMarine,
  initialRoom,
  initialShooter,
  project,
  shotX,
  stepIncoming,
  stepMarine,
  stepRoom,
  stepShooter,
  stepShot,
  stepWalker,
  type IncomingShot,
  type ShooterSpec,
  type ShooterState,
  type BaseMarine,
  type BaseShot,
  type BaseWalker,
  type RoomState,
  type Target,
} from '../logic/base';
import { afterExit, levelLabel, stepFor } from '../logic/campaign';
import { NO_CHEATS, applyCheat, type CheatId, type CheatState } from '../logic/cheats';
import {
  initialHealth,
  stepHealth,
  takeHit,
  visibleWhileInvulnerable,
  type HealthState,
} from '../logic/health';
import { nextWeapon, weaponAfterDeath, withRapid } from '../logic/pickups';
import { createRng, type Rng } from '../logic/rng';
import { reachLevel } from '../logic/save';
import { addPoints, newRun, type ScoreState } from '../logic/score';
import { weaponForFrame } from '../logic/touch';
import { initialWeapon, stepWeapon, type WeaponState } from '../logic/weapon';
import { GameSound } from '../systems/GameSound';
import { showGameOverText, showLevelBanner } from '../systems/LevelOverlays';
import { PlayerInput } from '../systems/PlayerInput';
import { SaveStore } from '../systems/SaveStore';
import type { LevelSceneData, RunState } from './LevelScene';

/** State the e2e test hook reads. */
export interface BaseSnapshot {
  section: string;
  label: string;
  timeMs: number;
  /** Room number from 1, and how many the stage has. */
  room: number;
  rooms: number;
  coreHp: number;
  cleared: boolean;
  marine: { x: number; h: number; crouching: boolean; dead: boolean };
  hp: number;
  lives: number;
  weapon: WeaponType;
  rapid: boolean;
  shots: { active: number; fired: number };
  walkers: { x: number; z: number }[];
  walkersSent: number;
  /** Wall turrets still standing in this room, and shots fired out at him (M5.6c). */
  turrets: number;
  incoming: { active: number; fired: number };
  score: { score: number; best: number };
  cheats: CheatState;
  exiting: boolean;
  gameOver: boolean;
}

const P = BASE.projection;
/** Walker sprite sheet, its frame, and where its feet are (the art's bottom row). */
const WALKER = ENEMIES['alien-walker'];
/** Screen y of the far wall's middle, where the core and barrier sit. */
const FAR_WALL_MID = project(P.centerX, 1, BASE.coreHeight, P);
/** The core sprite is drawn for a core this wide (half width, near-edge pixels). */
const CORE_DRAWN_HALF_WIDTH = 40;
/** How long a turret's eye stays lit after it fires. */
const TURRET_FLASH_MS = 150;

/** A gun on the far wall, while the room lasts: its spec, hits left and countdown. */
interface Gun {
  spec: ShooterSpec;
  hp: number;
  shooter: ShooterState;
  flashMs: number;
}

/**
 * An into-the-screen base stage (ADR-C11, M5.6): its rooms in order, each with a core to
 * destroy. Rules in src/logic/base.ts; this scene draws them and connects input, health,
 * score, sound and the campaign, like LevelScene does for side-scrolling sections.
 */
export class BaseScene extends Phaser.Scene {
  private section = '';
  private stage!: BaseStage;
  private roomIndex = 0;
  private room!: RoomState;
  private rng!: Rng;
  private marine!: BaseMarine;
  private health!: HealthState;
  private weapon: WeaponState = initialWeapon();
  private weaponType: WeaponType = 'rifle';
  /** R, rapid fire (M7.1): carried in, kept until a life is lost. */
  private rapid = false;
  private shots: BaseShot[] = [];
  private shotsFired = 0;
  private walkers: BaseWalker[] = [];
  private walkersSent = 0;
  private score: ScoreState = newRun(0);
  private cheats: CheatState = NO_CHEATS;
  private continues: number = CONTINUE.count;
  private runAtStart: RunState | null = null;
  private elapsedMs = 0;
  private exiting = false;
  private gameOver = false;
  private skipRoomOnResume = false;
  private label = '';
  /** He moved along the near edge this frame (for the running frames). */
  private running = false;
  /** This room's wall turrets and, in the last room, the core's own gun (M5.6c). */
  private turrets: Gun[] = [];
  private coreGun: Gun | null = null;
  private incoming: IncomingShot[] = [];
  private incomingFired = 0;

  private controls!: PlayerInput;
  private hud!: Hud;
  private effects!: Effects;
  private marineSprite!: Phaser.GameObjects.Sprite;
  private core!: Phaser.GameObjects.Sprite;
  private barrier!: Phaser.GameObjects.Sprite;
  private shotSprites!: Phaser.GameObjects.Group;
  private walkerSprites!: Phaser.GameObjects.Group;
  private incomingSprites!: Phaser.GameObjects.Group;
  private turretSprites: Phaser.GameObjects.Sprite[] = [];

  constructor() {
    super('Base');
  }

  init(data: LevelSceneData): void {
    this.section = data.level ?? 'hive-core';
    const stage = BASE_STAGES[this.section];
    if (!stage) throw new Error(`unknown base stage ${this.section}`);
    this.stage = stage;
    this.runAtStart = data.run ?? null;
    this.cheats = data.run?.cheats ?? NO_CHEATS;
    this.continues = data.run?.continues ?? CONTINUE.count;
    this.score = { ...newRun(SaveStore.load().bestScore), score: data.run?.score ?? 0 };
    this.score.livesAwarded = SCORING.extraLifeAt.filter((t) => this.score.score >= t).length;
    this.health = {
      ...initialHealth(HEALTH),
      lives: data.run?.lives ?? HEALTH.lives,
      hp: data.run?.hp ?? HEALTH.maxHp,
    };
    this.weaponType = data.run?.weapon ?? 'rifle';
    this.rapid = data.run?.rapid ?? false;
    this.weapon = initialWeapon();
    this.marine = initialMarine(P.centerX);
    this.shots = [];
    this.shotsFired = 0;
    this.incomingFired = 0;
    this.walkers = [];
    this.walkersSent = 0;
    this.elapsedMs = 0;
    this.exiting = false;
    this.gameOver = false;
    this.skipRoomOnResume = false;
    this.startRoom(0);
  }

  create(): void {
    this.add.image(0, 0, 'base-room').setOrigin(0);
    this.core = this.add.sprite(FAR_WALL_MID.x, FAR_WALL_MID.y, 'base-core').play('base-core');
    this.barrier = this.add
      .sprite(FAR_WALL_MID.x, FAR_WALL_MID.y, 'base-barrier')
      .play('base-barrier');
    this.walkerSprites = this.add.group({ defaultKey: WALKER.walkSheet, maxSize: 16 });
    this.shotSprites = this.add.group({ defaultKey: 'bullet', maxSize: 16 });
    this.incomingSprites = this.add.group({ defaultKey: 'enemy-shot', maxSize: 16 });
    // Enough turret sprites for the busiest room; each room shows the ones it has.
    const most = Math.max(...this.stage.rooms.map((r) => r.turrets?.length ?? 0), 0);
    this.turretSprites = Array.from({ length: most }, () =>
      this.add.sprite(0, 0, 'base-turret', 0).setVisible(false),
    );
    this.marineSprite = this.add.sprite(0, 0, 'marine-back', 0).setOrigin(0.5, 1).setDepth(5);
    this.effects = new Effects(this);
    this.controls = new PlayerInput(this);
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.controls.clear();
      if (this.skipRoomOnResume) {
        this.skipRoomOnResume = false;
        this.room = hitCore(this.room, this.room.coreHp);
        this.onCoreDestroyed();
      }
    });

    const step = stepFor(CAMPAIGN, this.section);
    if (!this.cheats.used) SaveStore.update((save) => reachLevel(save, step.stage));
    this.label = levelLabel(step);
    this.hud = new Hud(this, this.label);
    showLevelBanner(this, this.label, step.name, () => {});
    GameSound.loadMusic(this);
    GameSound.music(step.music as MusicKey | null);
    this.draw();
    this.cameras.main.fadeIn(DIALOGUE_CARD.fadeMs);
  }

  override update(_time: number, deltaMs: number): void {
    this.elapsedMs += deltaMs;
    const input = this.controls.frame();
    const dead = this.health.deadMs !== null;
    if (input.pressed.pause && !this.exiting && !this.gameOver && !dead) {
      this.scene.launch('Pause', { level: this.section, scene: 'Base' });
      this.scene.pause();
      return;
    }
    const controlled = !this.exiting && !dead && this.health.stunMs <= 0;
    const held = controlled ? input.held : null;
    const wasX = this.marine.x;
    this.marine = stepMarine(
      this.marine,
      {
        left: held?.left ?? false,
        right: held?.right ?? false,
        down: held?.down ?? false,
        jump: controlled && input.pressed.jump,
      },
      deltaMs,
      BASE.marine,
    );
    this.running = this.marine.x !== wasX;

    // Firing: the weapon's own rate (R and touch auto-fire), its bullets fanned into the room.
    const stats = WEAPONS[this.weaponType];
    const rules = weaponForFrame(
      withRapid(stats, this.rapid),
      input.autoFire === true,
      TOUCH.autoFireMs,
    );
    const w = stepWeapon(
      this.weapon,
      controlled && input.held.fire,
      controlled && input.pressed.fire,
      deltaMs,
      rules,
    );
    this.weapon = w.state;
    if (w.fired && this.shots.length + stats.bullets <= stats.maxBullets) {
      this.shots.push(...fireShots(this.marine, stats.bullets, BASE.shot));
      this.shotsFired++;
      GameSound.play('sfx-shot');
    }

    const h = stepHealth(this.health, deltaMs, HEALTH);
    this.health = h.state;
    if (h.event === 'respawn') {
      this.marine = initialMarine(P.centerX);
      this.weaponType = weaponAfterDeath();
      this.rapid = false;
    } else if (h.event === 'game-over') {
      this.showGameOver();
    }

    this.stepRoomAndWalkers(deltaMs);
    this.stepGuns(deltaMs);
    this.stepShots(deltaMs, stats.damage);
    if (this.room.clearedMs !== null && this.room.clearedMs >= BASE.clearMs) this.nextRoom();
    this.hud.update(
      this.health.hp,
      this.health.lives,
      this.score.score,
      this.score.best,
      this.cheats.used,
      this.weaponType,
      this.rapid,
    );
    this.draw();
  }

  private startRoom(index: number): void {
    this.roomIndex = index;
    const room = this.stage.rooms[index];
    if (!room) throw new Error(`${this.section} has no room ${index + 1}`);
    this.room = initialRoom(room);
    this.rng = createRng(BASE.seed + index);
    this.walkers = [];
    this.incoming = [];
    const gun = (spec: ShooterSpec, hp: number): Gun => ({
      spec,
      hp,
      shooter: initialShooter(spec),
      flashMs: 0,
    });
    this.turrets = (room.turrets ?? []).map((t) => gun(t, t.hp));
    this.coreGun = room.core.fire ? gun(room.core.fire, room.core.hp) : null;
  }

  /** The wall turrets and the last core fire at him; their shots fly out of the room. */
  private stepGuns(deltaMs: number): void {
    const live = this.room.clearedMs === null && this.health.deadMs === null;
    // Invisible (cheat): they can't see him to aim.
    const aim = live && !this.cheats.invisible ? this.marine.x : null;
    for (const gun of [...this.turrets, ...(this.coreGun ? [this.coreGun] : [])]) {
      gun.flashMs = Math.max(0, gun.flashMs - deltaMs);
      if (gun.hp <= 0 || aim === null) continue;
      const r = stepShooter(gun.shooter, gun.spec, aim, deltaMs);
      gun.shooter = r.shooter;
      if (r.shots.length > 0) {
        this.incoming.push(...r.shots);
        this.incomingFired += r.shots.length;
        gun.flashMs = TURRET_FLASH_MS;
        GameSound.play('sfx-enemy-shot');
      }
    }
    const next: IncomingShot[] = [];
    for (const shot of this.incoming) {
      const s = stepIncoming(shot, this.marine, BASE.marine.halfWidth, deltaMs, BASE.incoming);
      if (s.hit) this.hurt();
      if (!s.gone) next.push(s.shot);
    }
    this.incoming = next;
  }

  private get roomData() {
    const room = this.stage.rooms[this.roomIndex];
    if (!room) throw new Error(`${this.section} has no room ${this.roomIndex + 1}`);
    return room;
  }

  private stepRoomAndWalkers(deltaMs: number): void {
    const r = stepRoom(this.room, this.roomData, deltaMs, this.rng);
    this.room = r.room;
    if (r.spawn) {
      this.walkers.push(r.spawn);
      this.walkersSent++;
    }
    // Invisible (cheat): they don't steer at him, they just run out of the room.
    const target = this.cheats.invisible ? { ...this.marine, x: -1000 } : this.marine;
    const next: BaseWalker[] = [];
    for (const walker of this.walkers) {
      const s = stepWalker(walker, target, BASE.marine.halfWidth, deltaMs, BASE.walker);
      if (s.contact && !this.cheats.invisible) this.hurt();
      if (!s.gone) next.push(s.walker);
    }
    this.walkers = next;
  }

  private stepShots(deltaMs: number, damage: number): void {
    const coreUp = this.room.clearedMs === null;
    const next: BaseShot[] = [];
    for (const shot of this.shots) {
      const targets: Target[] = this.walkers.map((w) => ({
        x: w.x,
        z: w.z,
        halfWidth: BASE.walker.halfWidth,
      }));
      // Turrets on the far wall: one in front of the core shields it until it is destroyed.
      const turrets = coreUp ? this.turrets.filter((t) => t.hp > 0) : [];
      for (const t of turrets) {
        targets.push({ x: t.spec.x, z: 1, halfWidth: BASE.turret.halfWidth });
      }
      if (coreUp) targets.push({ x: P.centerX, z: 1, halfWidth: this.roomData.core.halfWidth });
      const s = stepShot(shot, deltaMs, targets, BASE.shot);
      if (s.hit >= 0 && s.hit < this.walkers.length) {
        this.hitWalker(s.hit, damage);
        continue;
      }
      const turret = turrets[s.hit - this.walkers.length];
      if (s.hit >= 0 && turret) {
        this.hitTurret(turret, damage);
        continue;
      }
      if (s.hit >= 0) {
        // The core: a flash where the shot struck.
        const at = project(shotX(s.shot, 1), 1, BASE.coreHeight, P);
        this.effects.play('hit', at.x, at.y);
        this.room = hitCore(this.room, damage);
        if (this.room.clearedMs !== null) this.onCoreDestroyed();
        continue;
      }
      if (!s.atWall) next.push(s.shot);
    }
    this.shots = next;
  }

  private hitWalker(index: number, damage: number): void {
    const w = this.walkers[index];
    if (!w) return;
    w.hp -= damage;
    if (w.hp > 0) return;
    this.walkers.splice(index, 1);
    const at = project(w.x, w.z, BASE.walker.height / 2, P);
    this.effects.play(WALKER.deathEffect, at.x, at.y);
    GameSound.play('sfx-enemy-die');
    this.addScore(WALKER.points);
  }

  private hitTurret(gun: Gun, damage: number): void {
    const at = project(gun.spec.x, 1, gun.spec.h, P);
    gun.hp = Math.max(0, gun.hp - damage);
    if (gun.hp > 0) {
      this.effects.play('hit', at.x, at.y);
      return;
    }
    this.effects.play('enemy-death', at.x, at.y);
    GameSound.play('sfx-enemy-die');
    this.addScore(BASE.turret.points);
  }

  /** The core blew up: the barrier drops, the room's walkers and turrets go with it. */
  private onCoreDestroyed(): void {
    GameSound.play('sfx-boss-blast');
    this.effects.play('ground-explosion', FAR_WALL_MID.x, FAR_WALL_MID.y);
    for (const w of this.walkers) {
      const at = project(w.x, w.z, BASE.walker.height / 2, P);
      this.effects.play(WALKER.deathEffect, at.x, at.y);
    }
    for (const t of this.turrets.filter((g) => g.hp > 0)) {
      const at = project(t.spec.x, 1, t.spec.h, P);
      this.effects.play('enemy-death', at.x, at.y);
      t.hp = 0;
    }
    this.walkers = [];
    this.incoming = [];
    this.addScore(BASE.corePoints);
  }

  /** Walks on into the next room, or out of the stage after the last one. */
  private nextRoom(): void {
    if (this.exiting) return;
    if (this.roomIndex + 1 < this.stage.rooms.length) {
      this.exiting = true;
      this.cameras.main.fadeOut(DIALOGUE_CARD.fadeMs);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.startRoom(this.roomIndex + 1);
        this.marine = initialMarine(P.centerX);
        this.shots = [];
        this.exiting = false;
        this.cameras.main.fadeIn(DIALOGUE_CARD.fadeMs);
      });
      return;
    }
    this.reachExit();
  }

  private reachExit(): void {
    if (this.exiting) return;
    this.exiting = true;
    const { cards, nextLevel } = afterExit(CAMPAIGN, this.section);
    this.cameras.main.fadeOut(DIALOGUE_CARD.fadeMs);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const [card, ...more] = cards;
      const run = this.run();
      if (card) this.scene.start('Dialogue', { card, more, nextLevel, run });
      else if (nextLevel) this.scene.start(sceneFor(nextLevel), { level: nextLevel, run });
      else this.scene.start('End', { score: run.score });
    });
  }

  private hurt(): void {
    if (this.cheats.invincible) return;
    const r = takeHit(this.health, 1, HEALTH);
    this.health = r.state;
    if (r.result !== 'ignored') {
      GameSound.play(r.result === 'died' ? 'sfx-player-die' : 'sfx-hurt');
    }
  }

  /** Out of lives: GAME OVER, then the continue screen (M3.4), as in a level. */
  private showGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    GameSound.music(null);
    showGameOverText(this);
    this.time.delayedCall(HEALTH.gameOverMs, () => {
      this.cameras.main.fadeOut(DIALOGUE_CARD.fadeMs);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('Continue', {
          level: this.section,
          left: this.continues,
          score: this.score.score,
        });
      });
    });
  }

  /** Adds points, awards any extra lives, and saves a new best score. */
  private addScore(points: number): void {
    const r = addPoints(this.score, points, SCORING.extraLifeAt);
    const best = this.cheats.used ? this.score.best : r.state.best;
    const newBest = best > this.score.best;
    this.score = { ...r.state, best };
    if (r.extraLives > 0) {
      this.health = { ...this.health, lives: this.health.lives + r.extraLives };
      GameSound.play('sfx-extra-life');
    }
    if (newBest) SaveStore.update((save) => ({ ...save, bestScore: this.score.best }));
  }

  /** A cheat was entered on the pause screen. Returns a short line confirming it. */
  applyCheat(id: CheatId): string {
    this.cheats = applyCheat(this.cheats, id);
    switch (id) {
      case 'extra-lives':
        this.health = { ...this.health, lives: this.health.lives + CHEAT_EXTRA_LIVES };
        return `+${CHEAT_EXTRA_LIVES} LIVES`;
      case 'invincible':
        return this.cheats.invincible ? 'INVINCIBLE ON' : 'INVINCIBLE OFF';
      case 'invisible':
        return this.cheats.invisible ? 'INVISIBLE ON' : 'INVISIBLE OFF';
      case 'skip-room':
        this.skipRoomOnResume = true;
        return 'SKIPPING ROOM';
      case 'next-weapon':
        this.weaponType = nextWeapon(this.weaponType, WEAPON_TYPES);
        return this.weaponType.replace('-', ' ').toUpperCase();
    }
  }

  /** The score, lives, health and cheats to carry into the next section. */
  run(): RunState {
    return {
      score: this.score.score,
      lives: this.health.lives,
      hp: this.health.hp,
      cheats: this.cheats,
      continues: this.continues,
      weapon: this.weaponType,
      rapid: this.rapid,
    };
  }

  /** The run this stage started with (null on a fresh run), for Restart room. */
  get startingRun(): RunState | null {
    return this.runAtStart;
  }

  /** Places every sprite where the rules put it this frame. */
  private draw(): void {
    const cleared = this.room.clearedMs !== null;
    // A bigger core is drawn bigger (the last room's): the sprite is drawn for a 40 px one.
    this.core.setVisible(!cleared).setScale(this.roomData.core.halfWidth / CORE_DRAWN_HALF_WIDTH);
    this.barrier.setVisible(!cleared);

    const m = project(this.marine.x, 0, this.marine.h, P);
    const dead = this.health.deadMs !== null;
    const moving = !this.marine.crouching && this.marine.h === 0 && this.running;
    const step = Math.floor(this.elapsedMs / 120) % 2;
    this.marineSprite
      .setPosition(Math.round(m.x), Math.round(m.y))
      .setFrame(this.marine.crouching ? 3 : moving ? 1 + step : 0)
      .setVisible(!dead && visibleWhileInvulnerable(this.health.invulnerableMs, HEALTH.blinkMs));

    // Pooled sprites: shown for each shot and walker, the rest hidden.
    this.layout(this.shotSprites, this.shots, (sprite, s) => {
      const at = project(shotX(s), s.z, s.h, P);
      sprite
        .setPosition(at.x, at.y)
        .setScale(Math.max(0.5, at.scale))
        .setDepth(3 - s.z);
    });
    this.turretSprites.forEach((sprite, i) => {
      const gun = this.turrets[i];
      sprite.setVisible(gun !== undefined && gun.hp > 0);
      if (!gun) return;
      const at = project(gun.spec.x, 1, gun.spec.h, P);
      sprite.setPosition(Math.round(at.x), Math.round(at.y)).setFrame(gun.flashMs > 0 ? 1 : 0);
    });
    this.layout(this.incomingSprites, this.incoming, (sprite, shot) => {
      const { x, h } = incomingAt(shot, BASE.incoming);
      const at = project(x, shot.z, h, P);
      sprite
        .setPosition(at.x, at.y)
        .setScale(Math.max(0.4, at.scale))
        .setDepth(4 - shot.z);
      if (!sprite.anims.isPlaying) sprite.play('enemy-shot');
    });
    this.layout(this.walkerSprites, this.walkers, (sprite, w) => {
      const feet = project(w.x, w.z, 0, P);
      const frameBottom = WALKER.body.offsetY + WALKER.body.height;
      sprite
        .setOrigin(0.5, frameBottom / WALKER.frame.height)
        .setPosition(feet.x, feet.y)
        .setScale(feet.scale)
        .setFlipX(w.x < this.marine.x === WALKER.facesLeftInArt)
        .setDepth(3 - w.z);
      if (!sprite.anims.isPlaying) sprite.play(WALKER.walkSheet);
    });
  }

  private layout<T>(
    group: Phaser.GameObjects.Group,
    items: readonly T[],
    place: (sprite: Phaser.GameObjects.Sprite, item: T) => void,
  ): void {
    const sprites = group.getChildren() as Phaser.GameObjects.Sprite[];
    while (sprites.length < items.length && !group.isFull()) {
      group.create(0, 0);
    }
    const all = group.getChildren() as Phaser.GameObjects.Sprite[];
    all.forEach((sprite, i) => {
      const item = items[i];
      sprite.setActive(item !== undefined).setVisible(item !== undefined);
      if (item !== undefined) place(sprite, item);
    });
  }

  snapshot(): BaseSnapshot {
    return {
      section: this.section,
      label: this.label,
      timeMs: Math.round(this.elapsedMs),
      room: this.roomIndex + 1,
      rooms: this.stage.rooms.length,
      coreHp: this.room.coreHp,
      cleared: this.room.clearedMs !== null,
      marine: {
        x: Math.round(this.marine.x),
        h: Math.round(this.marine.h),
        crouching: this.marine.crouching,
        dead: this.health.deadMs !== null,
      },
      hp: this.health.hp,
      lives: this.health.lives,
      weapon: this.weaponType,
      rapid: this.rapid,
      shots: { active: this.shots.length, fired: this.shotsFired },
      walkers: this.walkers.map((w) => ({ x: Math.round(w.x), z: Math.round(w.z * 100) / 100 })),
      walkersSent: this.walkersSent,
      turrets: this.turrets.filter((t) => t.hp > 0).length,
      incoming: { active: this.incoming.length, fired: this.incomingFired },
      score: { score: this.score.score, best: this.score.best },
      cheats: this.cheats,
      exiting: this.exiting,
      gameOver: this.gameOver,
    };
  }
}
